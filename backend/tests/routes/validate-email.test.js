const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

jest.mock('../../src/services/reoon', () => ({
  validateEmail: jest.fn(),
}));
const { validateEmail } = require('../../src/services/reoon');

describe('POST /api/validate-email', () => {
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

  test('returns validation result', async () => {
    validateEmail.mockResolvedValue({
      email: 'check@example.com',
      status: 'valid',
      risk: 'low',
    });

    const res = await request(app)
      .post('/api/validate-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'check@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('valid');
    expect(validateEmail).toHaveBeenCalledWith(expect.anything(), 'check@example.com');
  });

  test('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/api/validate-email')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 500 when service fails', async () => {
    validateEmail.mockRejectedValue(new Error('Reoon API error: 401'));

    const res = await request(app)
      .post('/api/validate-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'fail@example.com' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Reoon');
  });
});
