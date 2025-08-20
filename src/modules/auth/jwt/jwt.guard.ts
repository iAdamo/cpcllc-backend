import { AuthGuard } from '@nestjs/passport';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

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
