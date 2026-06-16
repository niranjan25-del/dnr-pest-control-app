// test/integration/auth.integration-spec.ts
//
// Auth flow against the real app + Prisma test DB (external SDKs mocked). Covers success,
// validation, authorization, and error cases for register → login → me → refresh.
//
// Requires a Prisma test database. Skipped automatically if DATABASE_URL is unset so the
// pure-logic unit suite still runs green in environments without Postgres.

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, type TestApp } from '../support/app';
import type { PrismaService } from 'src/database/prisma.service';

const dbAvailable = Boolean(process.env.DATABASE_URL);
const d = dbAvailable ? describe : describe.skip;

d('Auth flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const base = '/api/v1/auth';
  const creds = { email: 'newcustomer@dnr.test', password: 'P@ssw0rd123', fullName: 'New Customer', phone: '+919800000001' };

  beforeAll(async () => {
    const t: TestApp = await createTestApp();
    app = t.app; prisma = t.prisma;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { await resetDb(prisma); });

  describe('POST /auth/register', () => {
    it('registers a customer and returns tokens (success)', async () => {
      const res = await request(app.getHttpServer()).post(`${base}/register`).send(creds);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
    });

    it('rejects a malformed email (validation)', async () => {
      const res = await request(app.getHttpServer()).post(`${base}/register`).send({ ...creds, email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a duplicate email (conflict)', async () => {
      await request(app.getHttpServer()).post(`${base}/register`).send(creds);
      const res = await request(app.getHttpServer()).post(`${base}/register`).send(creds);
      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => { await request(app.getHttpServer()).post(`${base}/register`).send(creds); });

    it('logs in with correct credentials (success)', async () => {
      const res = await request(app.getHttpServer()).post(`${base}/login`).send({ email: creds.email, password: creds.password });
      expect(res.status).toBe(201);
      expect(res.body.access_token).toBeDefined();
    });

    it('rejects a wrong password (authorization)', async () => {
      const res = await request(app.getHttpServer()).post(`${base}/login`).send({ email: creds.email, password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('requires a bearer token (authorization)', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/me`);
      expect(res.status).toBe(401);
    });

    it('returns the profile with a valid token (success)', async () => {
      const reg = await request(app.getHttpServer()).post(`${base}/register`).send(creds);
      const res = await request(app.getHttpServer()).get(`${base}/me`).set('Authorization', `Bearer ${reg.body.access_token}`);
      expect(res.status).toBe(200);
      expect(res.body.email ?? res.body.data?.email).toBe(creds.email);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates tokens with a valid refresh token (success)', async () => {
      const reg = await request(app.getHttpServer()).post(`${base}/register`).send(creds);
      const res = await request(app.getHttpServer()).post(`${base}/refresh`).send({ refresh_token: reg.body.refresh_token });
      expect(res.status).toBe(201);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).not.toBe(reg.body.refresh_token); // rotation
    });

    it('rejects an invalid refresh token (error)', async () => {
      const res = await request(app.getHttpServer()).post(`${base}/refresh`).send({ refresh_token: 'garbage' });
      expect(res.status).toBe(401);
    });
  });
});
