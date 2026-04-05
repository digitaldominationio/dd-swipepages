const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

describe('Tag Routes', () => {
  let token;

  beforeEach(async () => {
    await cleanDatabase();
    const hash = await bcrypt.hash('pass', 12);
    await prisma.user.create({
      data: { email: 'user@test.com', name: 'User', passwordHash: hash, role: 'member' },
    });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'pass' });
    token = loginRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('CRUD lifecycle', async () => {
    const createRes = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'urgent', color: '#ff0000' });

    expect(createRes.status).toBe(201);
    const tagId = createRes.body.id;

    const listRes = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe('urgent');

    const updateRes = await request(app)
      .put(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'important', color: '#00ff00' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('important');

    const deleteRes = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });

  test('rejects duplicate tag name', async () => {
    await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'dup', color: '#000000' });

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'dup', color: '#111111' });

    expect(res.status).toBe(409);
  });
});
