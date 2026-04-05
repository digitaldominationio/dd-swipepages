const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');
const { createInviteToken } = require('../../src/utils/invite');

describe('Auth Routes', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    test('returns JWT for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 12);
      await prisma.user.create({
        data: { email: 'admin@test.com', name: 'Admin', passwordHash: hash, role: 'admin' },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    test('rejects invalid password with 401', async () => {
      const hash = await bcrypt.hash('password123', 12);
      await prisma.user.create({
        data: { email: 'user@test.com', name: 'User', passwordHash: hash, role: 'member' },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    test('rejects non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'x' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/accept-invite', () => {
    test('creates account from valid invite token', async () => {
      const token = createInviteToken('new@test.com');
      await prisma.inviteToken.create({
        data: {
          token,
          email: 'new@test.com',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      const res = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token, name: 'New User', password: 'securepass123' });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('new@test.com');
      expect(res.body.user.role).toBe('member');
    });

    test('rejects already-used invite token', async () => {
      const token = createInviteToken('used@test.com');
      await prisma.inviteToken.create({
        data: {
          token,
          email: 'used@test.com',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          usedAt: new Date(),
        },
      });

      const res = await request(app)
        .post('/api/auth/accept-invite')
        .send({ token, name: 'User', password: 'pass123' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns current user with valid JWT', async () => {
      const hash = await bcrypt.hash('pass', 12);
      await prisma.user.create({
        data: { email: 'me@test.com', name: 'Me', passwordHash: hash, role: 'member' },
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'me@test.com', password: 'pass' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@test.com');
      expect(res.body.name).toBe('Me');
    });
  });
});
