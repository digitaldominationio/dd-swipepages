const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../../src/middleware/auth');

describe('auth middleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  function mockReqResNext(authHeader) {
    const req = { headers: { authorization: authHeader } };
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    return { req, res, next, wasNextCalled: () => nextCalled };
  }

  test('passes with valid Bearer token and attaches user', () => {
    const token = jwt.sign({ id: 'user-1', role: 'member' }, 'test-secret');
    const { req, res, next, wasNextCalled } = mockReqResNext(`Bearer ${token}`);
    authMiddleware(req, res, next);
    expect(wasNextCalled()).toBe(true);
    expect(req.user.id).toBe('user-1');
    expect(req.user.role).toBe('member');
  });

  test('rejects missing authorization header', () => {
    const { req, res, next, wasNextCalled } = mockReqResNext(undefined);
    authMiddleware(req, res, next);
    expect(wasNextCalled()).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  test('rejects invalid token', () => {
    const { req, res, next, wasNextCalled } = mockReqResNext('Bearer invalid.token.here');
    authMiddleware(req, res, next);
    expect(wasNextCalled()).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
