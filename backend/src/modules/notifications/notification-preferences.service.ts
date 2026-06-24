// src/modules/notifications/notification-preferences.service.ts
//
// Notification preferences (enable/disable per type + channel).
//
// ⚠ SCHEMA GAP (flagged, important): the approved schema has NO storage for preferences — no
// NotificationPreference model and no Json column on User. So preferences cannot persist.
// This service returns DEFAULTS (everything enabled) and `update` validates but DOES NOT
// persist; it returns the requested view so the API contract is in place. The dispatcher calls
// `isEnabled`, which currently always returns true (default-on).
//
// TO MAKE REAL: add a `NotificationPreference { userId, type, push, inApp @@unique([userId,type]) }`
// table (or a `User.notificationPreferences Json`) and implement the reads/writes below. The
// rest of the module already routes through this service, so no caller changes are needed.

import { Injectable, Logger } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { ALL_TYPES, DEFAULT_CHANNEL_PREFS, NotificationChannel } from "./enums";
import { NotificationPreferenceDto } from "./dto";

export interface ResolvedPreference {
  type: NotificationType;
  push: boolean;
  inApp: boolean;
}

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  getPreferences(_userId: string): ResolvedPreference[] {
    return ALL_TYPES.map((type) => ({ type, ...DEFAULT_CHANNEL_PREFS }));
  }

  updatePreferences(
    userId: string,
    dto: NotificationPreferenceDto,
  ): { preferences: ResolvedPreference[]; persisted: boolean } {
    // Validation only — see schema-gap note above.
    const merged = this.getPreferences(userId).map((pref) => {
      const override = dto.preferences.find((p) => p.type === pref.type);
      return override
        ? {
            type: pref.type,
            push: override.push ?? pref.push,
            inApp: override.inApp ?? pref.inApp,
          }
        : pref;
    });
    this.logger.warn(
      `Preference update for ${userId} not persisted (no preferences store in schema)`,
    );
    return { preferences: merged, persisted: false };
  }

  // Default-on until a preferences store exists.
  isEnabled(
    _userId: string,
    _type: NotificationType,
    _channel: NotificationChannel,
  ): boolean {
    return true;
  }
}
