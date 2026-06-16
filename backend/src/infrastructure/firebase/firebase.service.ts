// src/infrastructure/firebase/firebase.service.ts
//
// Wraps Firebase Admin: initializes the app once from validated config and verifies inbound
// ID tokens (signature, audience=project, issuer, expiry). Used by the Firebase strategy for
// social/IdP login and reusable for FCM later. Tests mock this service.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FirebaseIdentity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  signInProvider?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app!: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  private initialized = false;

  onModuleInit(): void {
    if (admin.apps.length) {
      this.app = admin.apps[0]!;
      this.initialized = true;
      return;
    }
    const projectId = this.config.get<string>('firebase.projectId');
    const clientEmail = this.config.get<string>('firebase.clientEmail');
    const privateKey = this.config.get<string>('firebase.privateKey');

    // Skip Firebase init when credentials are placeholders (local dev without Firebase).
    if (!projectId || projectId === 'replace-me' || !privateKey || privateKey.includes('REPLACE_ME')) {
      this.logger.warn('Firebase credentials not configured — Firebase auth disabled (JWT-only mode)');
      return;
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey } as admin.ServiceAccount),
    });
    this.initialized = true;
    this.logger.log('Firebase Admin initialized');
  }

  async verifyIdToken(idToken: string): Promise<FirebaseIdentity> {
    if (!this.initialized) {
      throw new Error('Firebase is not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
    }
    const decoded = await this.app.auth().verifyIdToken(idToken, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      name: decoded.name,
      picture: decoded.picture,
      signInProvider: decoded.firebase?.sign_in_provider,
    };
  }
}
