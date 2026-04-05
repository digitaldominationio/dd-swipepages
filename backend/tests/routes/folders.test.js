const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

describe('Folder Routes', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await cleanDatabase();
    const hash = await bcrypt.hash('pass', 12);
    const user = await prisma.user.create({
      data: { email: 'user@test.com', name: 'User', passwordHash: hash, role: 'member' },
    });
    userId = user.id;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'pass' });
    token = loginRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('CRUD lifecycle', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Emails', sortOrder: 1 });

    expect(createRes.status).toBe(201);
    const folderId = createRes.body.id;
    expect(createRes.body.name).toBe('Emails');

    // Create nested
    const childRes = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cold Emails', parentId: folderId, sortOrder: 1 });

    expect(childRes.status).toBe(201);
    const childId = childRes.body.id;
    expect(childRes.body.parentId).toBe(folderId);

    // List
    const listRes = await request(app)
      .get('/api/folders')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(2);

    // Update
    const updateRes = await request(app)
      .put(`/api/folders/${folderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Emails' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe('Updated Emails');

    // Delete child first to avoid FK constraint (no cascade on self-relation)
    const deleteChildRes = await request(app)
      .delete(`/api/folders/${childId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteChildRes.status).toBe(200);

    // Delete parent
    const deleteRes = await request(app)
      .delete(`/api/folders/${folderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/folders');
    expect(res.status).toBe(401);
  });

  test('returns 400 when name is missing on create', async () => {
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ sortOrder: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name required');
  });
});
