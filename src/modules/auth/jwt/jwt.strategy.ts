import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          return request?.cookies?.authentication;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }
  async validate(payload: {
    sub: string;
    email: string;
    phoneNumber?: string;
    admin: boolean;
  }): Promise<{
    userId: string;
    email: string;
    phoneNumber?: string;
    admin?: boolean;
  }> {
    return {
      userId: payload.sub,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      admin: payload.admin,
    };
  }
}
