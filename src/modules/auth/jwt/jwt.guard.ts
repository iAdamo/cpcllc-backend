import { AuthGuard } from '@nestjs/passport';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NestMiddleware,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { CacheService } from 'src/modules/cache/cache.service';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '@users/users.service';
import { AuthUser } from '@websocket/interfaces/websocket.interface';

interface AuthenticatedRequest extends Request {
  user: AuthUser["user"];
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // 1️⃣ Public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) return true;

    // 2️⃣ JWT validation (super handles it)
    const canActivate = (await super.canActivate(ctx)) as boolean;
    if (!canActivate) return false;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = req.user;

    if (!payload) return false;

    // 3️⃣ Admin bypass
    if (payload.role === 'Admin') return true;
    // const skip = this.reflector.get<boolean>('skipTerms', ctx.getHandler());

    // 4️⃣ Skip terms if requested
    const skipTerms = this.reflector.getAllAndOverride<boolean>('skipTerms', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (skipTerms) return true;

    // 5️⃣ Enforce latest terms + token invalidation
    const accepted = await this.usersService.hasAcceptedLatest(
      payload.userId,
      'general',
      payload.tokenIssuedAt, // JWT issued-at (seconds)
    );

    if (!accepted) {
      throw new ForbiddenException({
        code: 'TERMS_NOT_ACCEPTED',
        message: 'Latest terms not accepted',
      });
    }

    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user.role || user.role !== 'Admin') {
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
    console.log('I am hhhhhhhhhhhhhhhhere');

    const client = context.switchToWs().getClient();
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.split(' ')[1];
    if (!token) {
      return false;
    }
    try {
      // validate token using JwtService
      const payload = jwt.verify(token, process.env.JWT_SECRET) as AuthUser["user"];
      client.user = payload;
      (client as any).user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role || [],
        deviceId: payload.deviceId,
        sessionId: payload.sessionId,
      };
      return true;
    } catch (err) {
      return false;
    }
  }
}

// @Injectable()
// export class TermsGuard implements CanActivate {
//   constructor(
//     private usersService: UsersService,
//     private reflector: Reflector,
//   ) {}

//   async canActivate(ctx: ExecutionContext): Promise<boolean> {
//     const skip = this.reflector.get<boolean>('skipTerms', ctx.getHandler());
//     if (skip) return true;

//     const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
//     const payload = req.user as AuthUser;
//     console.log({ payload });
//     if (!payload) return true;

//     if (payload.role === 'Admin') return true;

//     const accepted = await this.usersService.hasAcceptedLatest(
//       payload.userId,
//       'general',
//       payload.tokenIssuedAt,
//     );

//     if (!accepted) {
//       throw new ForbiddenException({
//         code: 'TERMS_NOT_ACCEPTED',
//         message: 'Latest terms not accepted',
//       });
//     }

//     return true;
//   }
// }
