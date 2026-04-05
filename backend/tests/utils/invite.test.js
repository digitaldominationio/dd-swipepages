const { createInviteToken, verifyInviteToken } = require('../../src/utils/invite');

describe('invite token utility', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-invites';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  test('creates a token string for an email', () => {
    const token = createInviteToken('user@example.com');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  test('verifies a valid token and returns the email', () => {
    const token = createInviteToken('user@example.com');
    const payload = verifyInviteToken(token);
    expect(payload.email).toBe('user@example.com');
  });

  test('throws on an invalid token', () => {
    expect(() => verifyInviteToken('garbage')).toThrow();
  });
});
