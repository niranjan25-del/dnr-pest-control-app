// src/modules/auth/strategies/firebase.strategy.ts
//
// Custom Passport strategy that reads a Firebase ID token from the request body (idToken)
// or Authorization header, verifies it via FirebaseService, and attaches the verified
// identity. The controller/service then finds-or-provisions the app user and issues JWTs.

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-custom';
import { FirebaseIdentity, FirebaseService } from 'src/infrastructure/firebase/firebase.service';

@Injectable()
export class FirebaseStrategy extends PassportStrategy(Strategy, 'firebase') {
  constructor(private readonly firebase: FirebaseService) {
    super();
  }

  async validate(req: Request): Promise<FirebaseIdentity> {
    const fromHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const idToken = (req.body?.idToken as string) || fromHeader;
    if (!idToken) {
      throw new UnauthorizedException({ code: 'INVALID_FIREBASE_TOKEN', message: 'Missing Firebase ID token' });
    }
    try {
      return await this.firebase.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_FIREBASE_TOKEN', message: 'Invalid Firebase ID token' });
    }
  }
}
