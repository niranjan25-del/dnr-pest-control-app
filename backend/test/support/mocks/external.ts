// test/support/mocks/external.ts
//
// Centralized mocks for the external SDKs so no unit/integration test ever touches the
// network. Each export is a jest-friendly fake mirroring only the surface the backend uses.
//
//   • Stripe       — paymentIntents, refunds, customers, subscriptions, webhooks.constructEvent
//   • Firebase     — admin.auth().verifyIdToken + messaging().sendEachForMulticast
//   • AWS S3       — PutObject/GetObject/DeleteObject + presigner
//   • Google Maps  — Distance Matrix / Geocoding HTTP responses
//
// Usage: jest.mock('stripe', () => require('../support/mocks/external').stripeModuleMock())
// (or wire via DI overrides in integration tests — see setup-integration.ts).

export function createStripeMock() {
  return {
    paymentIntents: {
      create: jest.fn(async (args: any) => ({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        amount: args.amount,
        currency: args.currency ?? 'inr',
      })),
      retrieve: jest.fn(async (id: string) => ({ id, status: 'succeeded' })),
      confirm: jest.fn(async (id: string) => ({ id, status: 'succeeded' })),
    },
    refunds: {
      create: jest.fn(async (args: any) => ({ id: 're_test_1', status: 'succeeded', amount: args.amount })),
    },
    customers: {
      create: jest.fn(async () => ({ id: 'cus_test_1' })),
    },
    subscriptions: {
      create: jest.fn(async () => ({ id: 'sub_test_1', status: 'active', current_period_end: Date.now() / 1000 + 2592000 })),
      update: jest.fn(async (id: string, args: any) => ({ id, ...args, status: 'active' })),
      cancel: jest.fn(async (id: string) => ({ id, status: 'canceled' })),
    },
    paymentMethods: {
      list: jest.fn(async () => ({ data: [] })),
      attach: jest.fn(async (id: string) => ({ id })),
      detach: jest.fn(async (id: string) => ({ id })),
    },
    webhooks: {
      // Bypass signature verification in tests: return the pre-built event.
      constructEvent: jest.fn((_body: Buffer, _sig: string, _secret: string) => ({ id: 'evt_test', type: 'payment_intent.succeeded', data: { object: { id: 'pi_test_123' } } })),
    },
  };
}

/** Factory to feed `jest.mock('stripe', ...)` — the default export is a constructor. */
export function stripeModuleMock() {
  const instance = createStripeMock();
  const ctor = jest.fn(() => instance);
  return { __esModule: true, default: ctor, _instance: instance };
}

export function createFirebaseAdminMock() {
  return {
    apps: [{}], // pretend an app is already initialized (guard-init no-ops)
    initializeApp: jest.fn(),
    credential: { cert: jest.fn(() => ({})) },
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn(async (token: string) => ({
        uid: 'firebase_uid_test',
        email: token.includes('tech') ? 'tech@dnr.test' : 'customer@dnr.test',
        email_verified: true,
      })),
      createUser: jest.fn(async () => ({ uid: 'firebase_uid_test' })),
    })),
    messaging: jest.fn(() => ({
      sendEachForMulticast: jest.fn(async (msg: any) => ({
        successCount: msg.tokens?.length ?? 0,
        failureCount: 0,
        responses: (msg.tokens ?? []).map(() => ({ success: true })),
      })),
    })),
  };
}

export function createS3Mock() {
  return {
    send: jest.fn(async (command: any) => {
      const name = command?.constructor?.name ?? '';
      if (name.includes('GetObject')) return { Body: Buffer.from('test-bytes') };
      return {}; // Put/Delete return empty
    }),
  };
}

/** url string → fake presigned URL (deterministic, no AWS call). */
export const presignMock = jest.fn(async (key: string) => `https://cdn.test/${key}?sig=test`);

export function createGoogleMapsMock() {
  return {
    // Distance Matrix
    distancematrix: jest.fn(async () => ({
      data: { rows: [{ elements: [{ distance: { value: 5200 }, duration_in_traffic: { value: 600 }, status: 'OK' }] }] },
    })),
    // Geocoding
    geocode: jest.fn(async () => ({
      data: { results: [{ geometry: { location: { lat: 12.97, lng: 77.59 } }, formatted_address: 'Bengaluru, KA' }] },
    })),
  };
}
