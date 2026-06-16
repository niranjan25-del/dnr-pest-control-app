// src/infrastructure/firebase/firebase.module.ts
//
// Exposes FirebaseService. Global so both auth (IdP login) and notifications (FCM) can
// inject it without re-importing.

import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
