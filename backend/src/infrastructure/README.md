# infrastructure/
Adapters to external systems, wrapped behind app-owned interfaces so feature modules
depend on abstractions, not vendors (and tests can mock them):
  • stripe/    — StripeService (PaymentIntents, webhooks/constructEvent, refunds)
  • firebase/  — FirebaseService (verifyIdToken) + messaging (FCM)
  • aws/       — StorageService (S3 presigned upload/download, CloudFront URLs)
  • mail/ sms/ — SendGrid / Twilio wrappers
Each is its own module exporting a typed service; swap a provider by changing only here.
