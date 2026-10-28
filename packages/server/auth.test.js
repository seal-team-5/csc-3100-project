import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import session from 'express-session';
import bcrypt from 'bcrypt';
import UserModel from './userSchema.ts';
import { createApp } from './app.js';
import { hashPassword, validPassword } from './password.js';

const origin = 'http://localhost:3000';
const password = 'a long test password 123';
const secret = 'test-secret-only-with-more-than-32-bytes';

async function fixture(t, appOrigin = origin) {
  const clientDirectory = await mkdtemp(join(tmpdir(), 'recipeme-auth-test-'));
  await writeFile(
    join(clientDirectory, 'index.html'),
    '<!doctype html><title>Recipe Me test</title>'
  );
  t.after(() => rm(clientDirectory, { recursive: true, force: true }));
  const records = [];
  const User = {
    async create(data) {
      if (records.some((record) => record.email === data.email)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const record = { ...data, _id: String(records.length + 1) };
      records.push(record);
      return record;
    },
    findOne({ email }) {
      return {
        select: async () =>
          records.find((record) => record.email === email) || null,
      };
    },
    async findById(id) {
      return records.find((record) => record._id === id) || null;
    },
  };
  const server = createApp({
    User,
    sessionStore: new session.MemoryStore(),
    sessionSecret: secret,
    appOrigin,
    clientDirectory,
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (
    path,
    { method = 'GET', body, cookie, requestOrigin = appOrigin } = {}
  ) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { request, records, base };
}

const registration = {
  username: 'Test Cook',
  email: 'COOK@example.com',
  phone: '555-0100',
  password,
};

test('bcrypt hashes and verifies, with byte-aware password limits', async () => {
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(bcrypt.getRounds(hash), 12);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.equal(await bcrypt.compare('wrong password', hash), false);
  assert.equal(validPassword('short'), false);
  assert.equal(validPassword('1234567'), false);
  assert.equal(validPassword('12345678'), true);
  const eightCharacterHash = await hashPassword('12345678');
  assert.equal(await bcrypt.compare('12345678', eightCharacterHash), true);
  assert.equal(validPassword('x'.repeat(73)), false);
  assert.equal(validPassword('🙂'.repeat(19)), false);
  assert.equal(validPassword('x'.repeat(72)), true);
  const doc = new UserModel({ ...registration, password: hash });
  await doc.validate();
  assert.equal('password' in doc.toJSON(), false);
  await assert.rejects(new UserModel(registration).validate(), (error) =>
    Boolean(error.errors.password)
  );
});

test('registration, login, session rotation, current user, and logout', async (t) => {
  const { request, records } = await fixture(t);
  assert.equal((await request('/')).status, 200);
  assert.equal((await request('/login')).status, 200);
  assert.equal((await request('/grocery-list')).status, 200);
  assert.equal((await request('/recipes')).status, 404);
  assert.equal((await request('/src/App.tsx')).status, 404);
  assert.equal((await request('/api/unknown')).status, 404);
  assert.equal((await request('/api/auth/me')).status, 401);
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: registration,
  });
  assert.equal(registered.status, 201);
  assert.equal('password' in (await registered.json()).user, false);
  assert.equal(records[0].email, 'cook@example.com');
  assert.equal(await bcrypt.compare(password, records[0].password), true);
  assert.equal(
    (
      await request('/api/auth/register', {
        method: 'POST',
        body: registration,
      })
    ).status,
    409
  );
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: ' COOK@example.com ', password },
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const shortExpiry = new Date(/Expires=([^;]+)/i.exec(setCookie)[1]);
  assert.ok(shortExpiry.getTime() - Date.now() <= 8 * 60 * 60 * 1000);
  let cookie = setCookie.split(';')[0];
  assert.equal('password' in (await login.json()).user, false);
  const me = await request('/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal('password' in (await me.json()).user, false);
  const loginAgain = await request('/api/auth/login', {
    method: 'POST',
    body: { email: registration.email, password, rememberMe: true },
    cookie,
  });
  const rememberedCookie = loginAgain.headers.get('set-cookie');
  const longExpiry = new Date(/Expires=([^;]+)/i.exec(rememberedCookie)[1]);
  assert.ok(longExpiry.getTime() - Date.now() > 29 * 24 * 60 * 60 * 1000);
  const newCookie = rememberedCookie.split(';')[0];
  assert.notEqual(newCookie, cookie);
  assert.equal((await request('/api/auth/me', { cookie })).status, 401);
  cookie = newCookie;
  assert.equal(
    (await request('/api/auth/logout', { method: 'POST', cookie })).status,
    204
  );
  assert.equal((await request('/api/auth/me', { cookie })).status, 401);
});

test('invalid credentials use the same error and repeated failures are limited', async (t) => {
  const { request } = await fixture(t);
  await request('/api/auth/register', { method: 'POST', body: registration });
  const wrong = await request('/api/auth/login', {
    method: 'POST',
    body: { email: registration.email, password: 'incorrect' },
  });
  const absent = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'absent@example.com', password },
  });
  assert.equal(wrong.status, 401);
  assert.equal(absent.status, 401);
  assert.deepEqual(await wrong.json(), await absent.json());
  for (let i = 0; i < 8; i++) {
    assert.equal(
      (
        await request('/api/auth/login', {
          method: 'POST',
          body: { email: 'bad' },
        })
      ).status,
      401
    );
  }
  assert.equal(
    (await request('/api/auth/login', { method: 'POST', body: {} })).status,
    429
  );
});

test('rejects cross-origin writes, bad registration, and malformed JSON', async (t) => {
  const { request, base } = await fixture(t);
  assert.equal(
    (
      await request('/api/auth/register', {
        method: 'POST',
        body: registration,
        requestOrigin: 'https://other.example',
      })
    ).status,
    403
  );
  for (const invalid of ['short', 'x'.repeat(73), '🙂'.repeat(19)]) {
    assert.equal(
      (
        await request('/api/auth/register', {
          method: 'POST',
          body: { ...registration, password: invalid },
        })
      ).status,
      400
    );
  }
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.throws(() => createApp({ sessionSecret: 'short', appOrigin: origin }));
  assert.throws(() =>
    createApp({ sessionSecret: secret, appOrigin: origin, production: true })
  );
});

// The preview URL and Origin must match exactly; localhost and 127.0.0.1 differ.
test('accepts the configured preview origin and rejects a different host alias', async (t) => {
  const { request } = await fixture(t, 'http://127.0.0.1:5173');
  const accepted = await request('/api/auth/register', {
    method: 'POST',
    body: registration,
  });
  assert.equal(accepted.status, 201);
  const rejected = await request('/api/auth/login', {
    method: 'POST',
    body: { email: registration.email, password },
    requestOrigin: 'http://localhost:5173',
  });
  assert.equal(rejected.status, 403);
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: registration.email, password },
  });
  assert.equal(login.status, 200);
});
