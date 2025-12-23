import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithUser } from './jwt-auth.guard.js';

/**
 * Guard that prevents GUEST users from accessing protected endpoints.
 *
 * GUEST users are users that belong to a company but cannot log their own time
 * (e.g., accountants, auditors with read-only access, or admins managing
 * other companies without being employees there).
 *
 * Note: GUEST users with ADMIN/OWNER role can still access admin endpoints
 * (they can manage others, just not log their own time).
 *
 * This guard should be applied after JwtAuthGuard to ensure req.user is populated.
 */
@Injectable()
export class NotGuestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    if (req.user?.relation === 'GUEST') {
      throw new ForbiddenException(
        'Los usuarios invitados no pueden realizar esta acción',
      );
    }

    return true;
  }
}
