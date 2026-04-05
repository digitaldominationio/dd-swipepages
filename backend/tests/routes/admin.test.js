const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

describe('Admin Routes', () => {
  let adminToken;
  let adminUser;

  beforeEach(async () => {
    await cleanDatabase();
    const hash = await bcrypt.hash('admin123', 12);
    adminUser = await prisma.user.create({
      data: { email: 'admin@test.com', name: 'Admin', passwordHash: hash, role: 'admin' },
    });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });
    adminToken = loginRes.body.token;
  });

  describe('POST /api/admin/invite', () => {
    test('creates an invite token', async () => {
      const res = await request(app)
        .post('/api/admin/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'new@test.com' });

      expect(res.status).toBe(201);
      expect(res.body.inviteToken).toBeDefined();
      expect(res.body.email).toBe('new@test.com');
    });

    test('rejects non-admin', async () => {
      const hash = await bcrypt.hash('pass', 12);
      await prisma.user.create({
        data: { email: 'member@test.com', name: 'Member', passwordHash: hash, role: 'member' },
      });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'member@test.com', password: 'pass' });

      const res = await request(app)
        .post('/api/admin/invite')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .send({ email: 'x@test.com' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/users', () => {
    test('returns all users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].email).toBe('admin@test.com');
      expect(res.body[0].passwordHash).toBeUndefined();
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    test('deletes a team member', async () => {
      const hash = await bcrypt.hash('pass', 12);
      const member = await prisma.user.create({
        data: { email: 'del@test.com', name: 'Delete Me', passwordHash: hash, role: 'member' },
      });

      const res = await request(app)
        .delete(`/api/admin/users/${member.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const users = await prisma.user.findMany();
      expect(users).toHaveLength(1);
    });

    test('prevents deleting self', async () => {
      const res = await request(app)
        .delete(`/api/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('Settings', () => {
    test('PUT then GET settings (masked)', async () => {
      const putRes = await request(app)
        .put('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ settings: { reoon_api_key: 'my-secret-reoon-key-12345' } });

      expect(putRes.status).toBe(200);

      const getRes = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.reoon_api_key).toMatch(/^\*+.{4}$/);
    });
  });

  describe('Prompts CRUD', () => {
    test('creates, lists, updates, and deletes a prompt', async () => {
      const createRes = await request(app)
        .post('/api/admin/prompts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cold Email', promptText: 'Write a cold email...', category: 'email', sortOrder: 1 });

      expect(createRes.status).toBe(201);
      const promptId = createRes.body.id;

      const listRes = await request(app)
        .get('/api/admin/prompts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].name).toBe('Cold Email');

      const updateRes = await request(app)
        .put(`/api/admin/prompts/${promptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Cold Email' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Updated Cold Email');

      const deleteRes = await request(app)
        .delete(`/api/admin/prompts/${promptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);

      const finalList = await request(app)
        .get('/api/admin/prompts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(finalList.body).toHaveLength(0);
    });
  });
});
