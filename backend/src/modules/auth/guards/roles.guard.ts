// src/modules/auth/guards/roles.guard.ts
//
// Enforces @Roles and @Permissions metadata against the authenticated user (set by
// JwtAuthGuard/JwtStrategy). Rules:
//   • If @Roles present: user.role must be in the allowed set.
//   • If @Permissions present: user.permissions must include ALL required permissions
//     (SUPER_ADMIN bypasses permission checks).
//   • No metadata → allow (authn already handled by JwtAuthGuard).
// Always apply AFTER JwtAuthGuard so `request.user` exists.

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AdminRole, UserRole } from "@prisma/client";
import { PERMISSIONS_KEY, ROLES_KEY } from "../constants/auth.constants";
import { AuthenticatedUser } from "../interfaces/auth.interfaces";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const user = context.switchToHttp().getRequest().user as
      | AuthenticatedUser
      | undefined;
    if (!user)
      throw new ForbiddenException({
        code: "FORBIDDEN_ROLE",
        message: "Access denied",
      });

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: "FORBIDDEN_ROLE",
        message: "Your role cannot access this resource",
      });
    }

    if (requiredPermissions?.length) {
      const isSuperAdmin =
        user.role === UserRole.ADMIN &&
        user.adminRole === AdminRole.SUPER_ADMIN;
      const hasAll = requiredPermissions.every((p) =>
        user.permissions.includes(p),
      );
      if (!isSuperAdmin && !hasAll) {
        throw new ForbiddenException({
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Missing required permission",
        });
      }
    }

    return true;
  }
}
