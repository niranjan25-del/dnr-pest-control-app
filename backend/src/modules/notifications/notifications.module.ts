// src/modules/notifications/notifications.module.ts
//
// Exports NotificationDispatcherService so other modules (bookings, payments, subscriptions,
// chat) can trigger notifications via its on* event methods. FirebaseService is @Global
// (Step 3), so no import is needed for the admin app; FcmService reuses it.

import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { FcmService } from './fcm.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDispatcherService, NotificationPreferencesService, FcmService],
  exports: [NotificationDispatcherService],
})
export class NotificationsModule {}
