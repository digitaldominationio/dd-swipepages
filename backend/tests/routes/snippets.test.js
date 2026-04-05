const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

describe('Snippet Routes', () => {
  let token;
  let userId;
  let folderId;
  let tagId;

  beforeEach(async () => {
    await cleanDatabase();
    const hash = await bcrypt.hash('pass', 12);
    const user = await prisma.user.create({
      data: { email: 'user@test.com', name: 'User', passwordHash: hash, role: 'member' },
    });
    userId = user.id;

    const folder = await prisma.folder.create({
      data: { name: 'Test Folder', createdBy: userId },
    });
    folderId = folder.id;

    const tag = await prisma.tag.create({
      data: { name: 'important', color: '#ff0000' },
    });
    tagId = tag.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'pass' });
    token = loginRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('create snippet with tags', async () => {
    const res = await request(app)
      .post('/api/snippets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Welcome Email',
        content: 'Hello {{name}}, welcome!',
        type: 'template',
        folderId,
        tagIds: [tagId],
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Welcome Email');
    expect(res.body.tags).toHaveLength(1);
    expect(res.body.tags[0].tag.name).toBe('important');
  });

  test('list snippets with folder and tag filters', async () => {
    await request(app)
      .post('/api/snippets')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'S1', content: 'Content 1', type: 'snippet', folderId, tagIds: [tagId] });

    const byFolder = await request(app)
      .get(`/api/snippets?folder=${folderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(byFolder.status).toBe(200);
    expect(byFolder.body).toHaveLength(1);

    const byTag = await request(app)
      .get(`/api/snippets?tag=${tagId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(byTag.status).toBe(200);
    expect(byTag.body).toHaveLength(1);

    const bySearch = await request(app)
      .get('/api/snippets?search=Content')
      .set('Authorization', `Bearer ${token}`);

    expect(bySearch.status).toBe(200);
    expect(bySearch.body).toHaveLength(1);
  });

  test('update snippet', async () => {
    const createRes = await request(app)
      .post('/api/snippets')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Old', content: 'Old content', type: 'snippet', folderId });

    const updateRes = await request(app)
      .put(`/api/snippets/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Title', tagIds: [tagId] });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('New Title');
    expect(updateRes.body.tags).toHaveLength(1);
  });

  test('delete snippet', async () => {
    const createRes = await request(app)
      .post('/api/snippets')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Delete Me', content: 'x', type: 'snippet', folderId });

    const deleteRes = await request(app)
      .delete(`/api/snippets/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });
});
