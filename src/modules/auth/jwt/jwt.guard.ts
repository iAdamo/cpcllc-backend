import { AuthGuard } from '@nestjs/passport';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { CacheService } from 'src/modules/cache/cache.service';
import { UsersService } from '@users/service/users.service';
import { TermsService } from '@users/service/terms.service';
import { AuthUser } from '@websocket/interfaces/websocket.interface';

interface AuthenticatedRequest extends Request {
  user: AuthUser['user'];
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
    private termsService: TermsService,
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    /* ───────────── PUBLIC ROUTES ───────────── */
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    /* ───────────── JWT AUTH ───────────── */
    const canActivate = (await super.canActivate(ctx)) as boolean;
    if (!canActivate) return false;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = req.user;
    if (!payload) return false;

    /* ───────────── ROLE CHECK ───────────── */
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(payload.role)
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    /* ───────────── ADMIN BYPASS TERMS ───────────── */
    if (payload.role === 'Admin') return true;

    /* ───────────── SKIP TERMS IF MARKED ───────────── */
    const skipTerms = this.reflector.getAllAndOverride<boolean>('skipTerms', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skipTerms) return true;

    /* ───────────── TERMS + SESSION INVALIDATION ───────────── */
    const result = await this.termsService.hasAcceptedLatest(
      payload.userId,
      ['service', 'privacy'],
      payload.tokenIssuedAt,
    );

    if (!result.ok) {
      throw new ForbiddenException({
        code: 'TERMS_NOT_ACCEPTED',
        reason: result.reason,
        requiredTerms: result.requiredTerms,
      });
    }

    return true;
  }
}

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   constructor(
//     private reflector: Reflector,
//     private usersService: UsersService,
//   ) {
//     super();
//   }

//   async canActivate(ctx: ExecutionContext): Promise<boolean> {
//     // 1️⃣ Public routes
//     const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
//       ctx.getHandler(),
//       ctx.getClass(),
//     ]);

//     if (isPublic) return true;

//     // 2️⃣ JWT validation (super handles it)
//     const canActivate = (await super.canActivate(ctx)) as boolean;
//     if (!canActivate) return false;

//     const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
//     const payload = req.user;

//     if (!payload) return false;

//     // 3️⃣ Admin bypass
//     if (payload.role === 'Admin') return true;
//     // const skip = this.reflector.get<boolean>('skipTerms', ctx.getHandler());

//     // 4️⃣ Skip terms if requested
//     const skipTerms = this.reflector.getAllAndOverride<boolean>('skipTerms', [
//       ctx.getHandler(),
//       ctx.getClass(),
//     ]);

//     if (skipTerms) return true;

//     // 5️⃣ Enforce latest terms + token invalidation
//     const accepted = await this.usersService.hasAcceptedLatest(
//       payload.userId,
//       'general',
//       payload.tokenIssuedAt, // JWT issued-at (seconds)
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
