import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from './jwt.service';
import { Response, Request } from 'express';
import { LoginDto } from '@dto/login.dto';
import { CreateUserDto } from '@dto/create-user.dto';
import { ApiTags } from '@nestjs/swagger';
import { SkipTerms, Public } from 'src/common/decorators/guard.decorator';

@Controller('auth')
@ApiTags('auth')
export class JwtController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('register')
  @Public()
  async createUser(
    @Body()
    userDto: CreateUserDto,
    @Query('tokenType')
    tokenType: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    return this.jwtService.createUser(userDto, tokenType, res, req);
  }

  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Query('tokenType') tokenType: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<any> {
    await this.jwtService.login(loginDto, tokenType, res, req);
  }

  @SkipTerms()
  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('authentication');
    return res.status(200).json({
      message: 'Logout successful',
    });
  }

  @Post('send-code')
  @Public()
  async sendCode(@Body() body: { email: string }) {
    return this.jwtService.getVerificationCode(body.email);
  }

  @Post('verify-email')
  @Public()
  async verifyEmail(@Body() body: { code: string }) {
    return this.jwtService.verifyEmail(body.code);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() body: { email: string; password: string }) {
    return this.jwtService.resetPassword(body.email, body.password);
  }
}
