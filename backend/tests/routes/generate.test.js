const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

jest.mock('../../src/services/openai', () => ({
  generateText: jest.fn(),
}));
const { generateText } = require('../../src/services/openai');

describe('AI Generation Routes', () => {
  let token;
  let adminUser;
  let promptId;

  beforeEach(async () => {
    await cleanDatabase();
    const hash = await bcrypt.hash('pass', 12);
    adminUser = await prisma.user.create({
      data: { email: 'admin@test.com', name: 'Admin', passwordHash: hash, role: 'admin' },
    });

    const prompt = await prisma.prompt.create({
      data: {
        name: 'Cold Email',
        promptText: 'Write a professional cold email based on the following context:',
        category: 'email',
        createdBy: adminUser.id,
      },
    });
    promptId = prompt.id;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'pass' });
    token = loginRes.body.token;
  });

  describe('POST /api/generate', () => {
    test('generates text using a prompt', async () => {
      generateText.mockResolvedValue('Dear John, I noticed your company...');

      const res = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'John runs a SaaS company', promptId });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('Dear John, I noticed your company...');
    });

    test('returns 400 for missing content', async () => {
      const res = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ promptId });

      expect(res.status).toBe(400);
    });

    test('returns 404 for non-existent prompt', async () => {
      const res = await request(app)
        .post('/api/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'test', promptId: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/prompts', () => {
    test('lists prompts without prompt_text for non-admin view', async () => {
      const res = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Cold Email');
      expect(res.body[0].promptText).toBeUndefined();
    });
  });
});
