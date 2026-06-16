# modules/
Feature modules (one folder per bounded context), each self-contained with its own
controller(s), service(s), dto/, enums/, interfaces/:
  auth, users, profiles, services, service-categories, service-packages, bookings,
  technician-assignment (dispatch), addresses, service-areas, payments, invoices,
  subscriptions, coupons, promotions, notifications, chat, location, service-reports,
  reviews, media, analytics, admin, health.
Modules depend on common/ + shared/ + infrastructure/ and on PrismaService; they do not
import each other's internals — cross-feature needs go through exported services.
