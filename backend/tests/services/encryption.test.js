const { encrypt, decrypt } = require('../../src/services/encryption');

describe('encryption service', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  test('encrypts and decrypts a string', () => {
    const plaintext = 'sk-my-secret-api-key-12345';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test('produces different ciphertext for same input (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  test('decrypt fails on tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    parts[2] = 'ff' + parts[2].slice(2);
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
});
