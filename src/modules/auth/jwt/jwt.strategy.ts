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
  async validate(payload: any): Promise<{
    userId: string;
    email: string;
    phoneNumber?: string;
    role: 'Client' | 'Provider' | 'Admin';
    tokenIssuedAt: Date;
    deviceId: string | unknown;
    sessionId: string;
  }> {
    return {
      userId: payload.userId,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      role: payload.role,
      tokenIssuedAt: payload.iat as any,
      deviceId: payload.deviceId,
      sessionId: payload.sessionId,
    };
  }
}
