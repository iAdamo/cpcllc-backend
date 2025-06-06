import { Controller, Post, Body, Res } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { Response } from 'express';
import { LoginDto } from '@dto/login.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('auth')
@ApiTags('auth')
export class JwtController {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    const user = await this.jwtService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    return this.jwtService.login(user, res);
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('authentication');
    return res.status(200).json({
      message: 'Logout successful',
    });
  }

  @Post('send-code')
  async sendCode(@Body() body: { email: string }) {
    return this.jwtService.getVerificationCode(body.email);
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: { email: string; code: string }) {
    return this.jwtService.verifyEmail(body.code, body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; password: string }) {
    return this.jwtService.resetPassword(body.email, body.password);
  }
}
