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
    roles: 'Client' | 'Provider' | 'Admin';
    deviceId: string | unknown;
    sessionId: string;
  }): Promise<{
    userId: string;
    email: string;
    phoneNumber?: string;
    roles: 'Client' | 'Provider' | 'Admin';
    deviceId: string | unknown;
    sessionId: string;
  }> {
    return {
      userId: payload.sub,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      roles: payload.roles,
      deviceId: payload.deviceId,
      sessionId: payload.sessionId,
    };
  }
}
