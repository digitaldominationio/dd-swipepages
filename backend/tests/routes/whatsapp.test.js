const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, prisma } = require('../../src/index');
const { cleanDatabase } = require('../setup');

jest.mock('../../src/services/walytic', () => ({
  sendWhatsApp: jest.fn(),
}));
const { sendWhatsApp } = require('../../src/services/walytic');

describe('POST /api/whatsapp/send', () => {
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

  test('sends a WhatsApp message', async () => {
    sendWhatsApp.mockResolvedValue({ status: 'sent', messageId: 'abc123' });

    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+919876543210', message: 'Hello from Swipe Toolkit!' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sent');
    expect(sendWhatsApp).toHaveBeenCalledWith(
      expect.anything(),
      '+919876543210',
      'Hello from Swipe Toolkit!'
    );
  });

  test('returns 400 for missing phone or message', async () => {
    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+919876543210' });

    expect(res.status).toBe(400);
  });

  test('returns 500 when service fails', async () => {
    sendWhatsApp.mockRejectedValue(new Error('Walytic API error: 403'));

    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+919876543210', message: 'Test' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Walytic');
  });
});
