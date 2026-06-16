// src/modules/auth/guards/firebase-auth.guard.ts
//
// Activates the custom 'firebase' Passport strategy (verifies a Firebase ID token). Applied
// only to the firebase-login route; downstream the controller exchanges the verified
// identity for app JWTs.

import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase') {
  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException({ code: 'INVALID_FIREBASE_TOKEN', message: 'Invalid Firebase token' });
    }
    return user;
  }
}
