const { adminMiddleware } = require('../../src/middleware/admin');

describe('admin middleware', () => {
  function mockReqResNext(role) {
    const req = { user: { id: 'user-1', role } };
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

  test('passes for admin role', () => {
    const { req, res, next, wasNextCalled } = mockReqResNext('admin');
    adminMiddleware(req, res, next);
    expect(wasNextCalled()).toBe(true);
  });

  test('rejects member role with 403', () => {
    const { req, res, next, wasNextCalled } = mockReqResNext('member');
    adminMiddleware(req, res, next);
    expect(wasNextCalled()).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
