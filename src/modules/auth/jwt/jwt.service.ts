import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { UsersService } from '@modules/users.service';
import { User, UserDocument } from '@modules/schemas/user.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { Model, Types } from 'mongoose';
import { MailtrapClient } from 'mailtrap';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '@modules/dto/login.dto';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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

  /**
   * Retrieve all users.
   * @returns List of users
   */
  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
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

    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    if (existingUser) {
      throw new ConflictException('Email or phone number already exists');
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

    return this.authResponse(accessToken, tokenType, res, userId);
  }

  /**
   * Generate a login token for a user.
   * @param loginData Login DTO
   * @returns JWT access token
   */
  async login(loginData: LoginDto, tokenType: string, res: any): Promise<any> {
    const user = await this.validateUser(loginData.email, loginData.password);
    const userId = user['_id'];
    const payload = {
      sub: userId as Types.ObjectId,
      email: user.email,
      phoneNumber: user.phoneNumber,
      admin: user.activeRole === 'Admin' || false,
    };
    const accessToken = this.jwtService.sign(payload);

    return this.authResponse(accessToken, tokenType, res, userId);
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
      throw new BadRequestException('Failed to send verification code');
    }
  }

  /**
   * Verify the user's email using the code.
   * @param code Verification code
   * @param email User email
   * @returns Confirmation message
   */
  async verifyEmail(code: string, email: string): Promise<{ message: string }> {
    if (!code || !email)
      throw new BadRequestException('Code and email are required');

    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new NotFoundException('Account does not exist');

    if (user.codeAt) {
      const now = new Date();
      const codeAgeInMinutes =
        Math.abs(now.getTime() - user.codeAt.getTime()) / (1000 * 60);
      if (codeAgeInMinutes > 30)
        throw new BadRequestException('Code has expired');
    }

    if (user.code !== code) throw new BadRequestException('Code is invalid');

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

    const user = await this.userModel.findOne({ email }).exec();
    if (!user || !user.forgetPassword)
      throw new BadRequestException('Invalid reset request');

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userModel
      .findByIdAndUpdate(
        user._id,
        {
          password: hashedPassword,
          forgetPassword: true,
        },
        { new: true, upsert: false },
      )
      .exec();

    return { message: 'Password reset successful' };
  }
}
