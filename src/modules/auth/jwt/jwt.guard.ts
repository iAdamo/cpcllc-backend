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

interface AuthUser {
  id: string;
  email: string;
  admin: boolean;
}
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.admin) {
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
    const userId = req.user?.id ?? '__guest__';

    const cacheKey = `profile_viewed:${profileId}:${userId}`;
    const hasViewed = await this.cacheService.get<boolean>(cacheKey);
    console.log('ProfileViewOnceGuard:', { profileId, userId, hasViewed });

    if (hasViewed) {
      if (!req.user) {
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
