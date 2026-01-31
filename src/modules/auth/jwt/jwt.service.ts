import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { UsersService } from '@users/service/users.service';
import { User, UserDocument } from '@modules/schemas/user.schema';
import { Provider, ProviderDocument } from '@modules/schemas/provider.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { Model, Types } from 'mongoose';
import { MailtrapClient } from 'mailtrap';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '@modules/dto/login.dto';
import { AuthUser } from '@websocket/interfaces/websocket.interface';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
    private readonly usersService: UsersService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  private async authResponse(
    accessToken: string,
    tokenType: string,
    res: any,
    userId: Types.ObjectId,
  ) {
    if (tokenType === 'Bearer') {
      return res.status(200).json({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
        ...(await this.usersService.userProfile(userId.toString())),
      });
    }
    res.cookie('authentication', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 90 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      domain:
        process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN,
      path: '/',
    });
    return res.status(200).json({
      ...(await this.usersService.userProfile(userId.toString())),
    });
  }

  private async validateUser(
    emailOrPhone: string,
    password: string,
  ): Promise<User> {
    if (!emailOrPhone || !password)
      throw new BadRequestException(
        'Email or Phone number and password are required',
      );

    const user = await this.userModel
      .findOne({
        $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
      })
      .exec();
    if (!user) throw new UnauthorizedException('Account does not exist');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Password is incorrect');

    return user;
  }

  /**
   * Create a new user.
   * @param createUsersDto User data
   * @returns Created user
   */
  async createUser(
    createUsersDto: CreateUserDto,
    tokenType: string,
    res: any,
  ): Promise<User> {
    const { email, phoneNumber, password } = createUsersDto;

    if (!email || !phoneNumber || !password) {
      throw new BadRequestException(this.ERROR_MESSAGES.EMAIL_REQUIRED);
    }

    const userWithEmail = await this.userModel.findOne({ email });
    if (userWithEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const userWithPhone = await this.userModel.findOne({ phoneNumber });
    if (userWithPhone) {
      throw new ConflictException('User with this phone number already exists');
    }

    const providerWithEmail = await this.providerModel.findOne({
      providerEmail: email,
    });
    if (providerWithEmail) {
      throw new ConflictException('Provider with this email already exists');
    }

    const providerWithPhone = await this.providerModel.findOne({
      providerPhoneNumber: phoneNumber,
    });
    if (providerWithPhone) {
      throw new ConflictException(
        'Provider with this phone number already exists',
      );
    }

    const user = await this.userModel.create(createUsersDto);
    const userId = user['_id'];
    const payload = {
      sub: userId as Types.ObjectId,
      email: user.email,
      phoneNumber: user.phoneNumber,
      admin: user.activeRole === 'Admin' || false,
    };
    const accessToken = this.jwtService.sign(payload);

    // safely send verification email, but don't block user creation if it fails
    await this.getVerificationCode(email).catch((err) => {
      // Optionally log the error, but don't block the response
      console.error('Failed to send verification email:', err);
    });

    return await this.authResponse(accessToken, tokenType, res, userId);
  }

  /**
   * Generate a login token for a user.
   * @param loginData Login DTO
   * @returns JWT access token
   */
  async login(
    loginData: LoginDto,
    tokenType: string,
    res: Response,
    req: Request,
  ): Promise<any> {
    const user = await this.validateUser(loginData.email, loginData.password);
    const userId = user['_id'] as Types.ObjectId;
    const payload = {
      userId: userId.toString(),
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.activeRole,
      deviceId: req.headers['x-device-id'] as string,
      sessionId: req.headers['x-session-id'] as string,
    };
    const accessToken = this.jwtService.sign(payload);

    return await this.authResponse(accessToken, tokenType, res, userId);
  }

  /**
   * Send a verification code to the user's email.
   * @param email User email
   * @returns Confirmation message
   */
  async getVerificationCode(email: string): Promise<{ message: string }> {
    if (!email) throw new BadRequestException('Email is required');

    const code = Math.floor(100000 + Math.random() * 900000);
    const codeAt = new Date();

    const user = await this.userModel
      .findOneAndUpdate(
        { email },
        { code, codeAt },
        { new: true, upsert: false },
      )
      .exec();

    if (!user) throw new NotFoundException('Account does not exist');

    const client = new MailtrapClient({
      token: process.env.HOST_PASS,
    });

    try {
      await client.send({
        from: {
          email: process.env.COMPANY_EMAIL,
          name: process.env.COMPANY_NAME,
        },
        to: [{ email }],
        template_uuid: process.env.VERIFICATION_TEMPLATE_UUID,
        template_variables: {
          company_info_name: process.env.COMPANY_NAME,
          first_name: user.email,
          last_name: code.toString(),
          company_info_country: process.env.COMPANY_COUNTRY,
          company_info_phone: process.env.COMPANY_PHONE,
          email: process.env.COMPANY_EMAIL,
        },
      });
      return { message: 'Verification code sent' };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new BadRequestException('Failed to send verification cde');
    }
  }

  /**
   * Verify the user's email using the code.
   * @param code Verification code
   * @param email User email
   * @returns Confirmation message
   */
  async verifyEmail(code: string): Promise<{ message: string }> {
    if (!code) throw new BadRequestException('Code is required');

    const user = await this.userModel.findOne({ code }).exec();
    if (!user) throw new BadRequestException('Invalid verification code');

    if (user.codeAt) {
      const now = new Date();
      const codeAgeInMinutes =
        Math.abs(now.getTime() - user.codeAt.getTime()) / (1000 * 60);
      if (codeAgeInMinutes > 30)
        throw new BadRequestException('Code has expired');
    }

    await this.userModel
      .findByIdAndUpdate(
        user._id,
        {
          code: null,
          codeAt: null,
          isEmailVerified: true,
          forgetPassword: true,
        },
        { new: true, upsert: false },
      )
      .exec();

    return { message: 'Code verified' };
  }

  /**
   * Reset the user's password.
   * @param email User email
   * @param password New password
   * @returns Confirmation message
   */
  async resetPassword(
    email: string,
    password: string,
  ): Promise<{ message: string }> {
    if (!email || !password)
      throw new BadRequestException('Email and password are required');
    const user = await this.userModel.findOne({ email });
    if (!user || !user.forgetPassword)
      throw new BadRequestException('Invalid reset request');

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userModel.findByIdAndUpdate(
      user._id,
      {
        password: hashedPassword,
        forgetPassword: false,
      },
      { new: true, upsert: false },
    );

    return { message: 'Password reset successful' };
  }
}
