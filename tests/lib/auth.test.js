import { describe, expect, it } from 'vitest';

describe('lib/auth', () => {
  it('hashPassword / verifyPassword roundtrip', async () => {
    // Import after env setup (JWT_SECRET is set in tests/setup/env.js)
    const { hashPassword, verifyPassword } = await import('../../lib/auth.js');
    const hash = await hashPassword('secret123');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('createAccessToken / verifyToken roundtrip', async () => {
    const { createAccessToken, verifyToken } = await import('../../lib/auth.js');
    const token = createAccessToken('u1', 'u1@example.com', 'U One');
    const payload = verifyToken(token);
    expect(payload).toBeTruthy();
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('u1@example.com');
    expect(payload.name).toBe('U One');
    expect(payload.type).toBe('access');
  });

  it('getUserFromRequest reads cookie access_token', async () => {
    const { createAccessToken, getUserFromRequest } = await import('../../lib/auth.js');
    const token = createAccessToken('u2', 'u2@example.com', 'U Two');

    const req = {
      cookies: {
        get(name) {
          if (name === 'access_token') return { value: token };
          return undefined;
        }
      },
      headers: {
        get() {
          return null;
        }
      }
    };

    const user = await getUserFromRequest(req);
    expect(user).toBeTruthy();
    expect(user.sub).toBe('u2');
  });

  it('getUserFromRequest reads Authorization: Bearer', async () => {
    const { createAccessToken, getUserFromRequest } = await import('../../lib/auth.js');
    const token = createAccessToken('u3', 'u3@example.com', 'U Three');

    const req = {
      cookies: { get: () => undefined },
      headers: {
        get(name) {
          if (name === 'Authorization') return `Bearer ${token}`;
          return null;
        }
      }
    };

    const user = await getUserFromRequest(req);
    expect(user).toBeTruthy();
    expect(user.sub).toBe('u3');
  });
});

