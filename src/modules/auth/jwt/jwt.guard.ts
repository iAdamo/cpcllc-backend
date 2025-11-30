import { AuthGuard } from '@nestjs/passport';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CacheService } from 'src/modules/cache/cache.service';
import * as jwt from 'jsonwebtoken';

interface AuthUser {
  userId: string;
  sub?: string;
  email: string;
  roles: 'Client' | 'Provider' | 'Admin';
  deviceId: string | unknown;
  sessionId: string;
}
interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || user.roles !== 'Admin') {
      throw new ForbiddenException('Access denied. Admins only.');
    }

    return true;
  }
}

@Injectable()
export class ProfileViewOnceGuard implements CanActivate {
  constructor(private readonly cacheService: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const profileId = req.params.id;
    const userId = req.user?.userId ?? '__guest__';

    const cacheKey = `profile_viewed:${profileId}:${userId}`;
    const hasViewed = await this.cacheService.get<boolean>(cacheKey);

    if (hasViewed) {
      if (!req.user.userId) {
        res
          .status(401)
          .json({ message: 'Authentication required to view this profile.' });
        return false;
      }
    } else {
      await this.cacheService.set(cacheKey, true, 86400); // 24 hours
    }
    return true;
  }
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor() {}
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.split(' ')[1];
    if (!token) {
      return false;
    }
    try {
      // validate token using JwtService
      const payload = jwt.verify(token, process.env.JWT_SECRET) as AuthUser;
      client.user = payload;
      (client as any).user = {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
        deviceId:
          (client.handshake.headers['device-id'] as string) || 'unknown',
        sessionId:
          (client.handshake.headers['session-id'] as string) || client.id,
      };
      return true;
    } catch (err) {
      return false;
    }
  }
}
