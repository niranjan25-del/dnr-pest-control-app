// src/modules/auth/decorators/index.ts
//
// RBAC + ergonomics decorators:
//   @Roles(...UserRole)        — allowed roles for a handler (read by RolesGuard)
//   @Permissions(...string)    — fine-grained permission requirement (admin capability matrix)
//   @Public()                  — marks a route as not requiring auth (if a global guard is used)
//   @CurrentUser()             — injects the request-bound AuthenticatedUser (or one property)

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../constants/auth.constants';
import { AuthenticatedUser } from '../interfaces/auth.interfaces';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    return data ? user?.[data] : user;
  },
);
