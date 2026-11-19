import { test } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import { createApp } from './app.js';

const origin = 'http://localhost:3000';
const clientId = 'test-client-id';

function idToken(claims) {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `header.${body}.signature`;
}

async function fixture(
  t,
  { configured = true, claims = {}, tokenOk = true } = {}
) {
  const records = [];
  const User = {
    async findOne(query) {
      const [key, value] = Object.entries(query)[0];
      const record = records.find((r) => r[key] === value);
      if (record) record.save ??= async () => {};
      return record || null;
    },
    async findById(id) {
      return records.find((r) => r._id === id) || null;
    },
    async create(data) {
      const record = { ...data, _id: String(records.length + 1) };
      records.push(record);
      return record;
    },
  };
  let nonce;
  const fetchImpl = async (_url, init) => {
    if (!tokenOk) return { ok: false };
    assert.ok(init.body.get('code_verifier'));
    return {
      ok: true,
      json: async () => ({
        id_token: idToken({
          iss: 'https://accounts.google.com',
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 600,
          sub: 'google-sub-1',
          email: 'Cook@Example.com',
          email_verified: true,
          name: 'Test Cook',
          nonce,
          ...claims,
        }),
      }),
    };
  };
  const server = createApp({
    User,
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'test-secret-only-with-more-than-32-bytes',
    appOrigin: origin,
    googleClientId: configured ? clientId : undefined,
    googleClientSecret: configured ? 'test-secret' : undefined,
    fetchImpl,
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
  const get = (path, cookie) =>
    fetch(base + path, {
      redirect: 'manual',
      headers: cookie ? { Cookie: cookie } : {},
    });
  // Start the flow and return what the browser would send back to the callback.
  async function start() {
    const response = await get('/api/auth/google');
    const location = new URL(response.headers.get('location'));
    nonce = location.searchParams.get('nonce');
    const cookie = response.headers.get('set-cookie').split(';')[0];
    return {
      response,
      location,
      cookie,
      state: location.searchParams.get('state'),
    };
  }
  return { get, start, records };
}

test('not configured: redirects back to login with an error', async (t) => {
  const { get } = await fixture(t, { configured: false });
  const response = await get('/api/auth/google');
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get('location'),
    '/login?error=google_unavailable'
  );
});

test('start redirects to Google with PKCE, state and nonce', async (t) => {
  const { start } = await fixture(t);
  const { response, location } = await start();
  assert.equal(response.status, 302);
  assert.equal(
    location.origin + location.pathname,
    'https://accounts.google.com/o/oauth2/v2/auth'
  );
  assert.equal(location.searchParams.get('client_id'), clientId);
  assert.equal(
    location.searchParams.get('redirect_uri'),
    `${origin}/api/auth/google/callback`
  );
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
});

test('callback creates a user, signs in, and a repeat login reuses it', async (t) => {
  const { get, start, records } = await fixture(t);
  const first = await start();
  const done = await get(
    `/api/auth/google/callback?code=abc&state=${first.state}`,
    first.cookie
  );
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), '/');
  assert.equal(records.length, 1);
  assert.equal(records[0].email, 'cook@example.com');
  assert.equal(records[0].googleId, 'google-sub-1');
  assert.equal(records[0].username, 'Test Cook');
  const sessionCookie = done.headers
    .getSetCookie()
    .find((c) => c.startsWith('recipeme.sid'))
    .split(';')[0];
  const me = await get('/api/auth/me', sessionCookie);
  assert.equal(me.status, 200);

  const second = await start();
  await get(
    `/api/auth/google/callback?code=abc&state=${second.state}`,
    second.cookie
  );
  assert.equal(records.length, 1);
});

test('callback links an existing account with the same verified email', async (t) => {
  const { get, start, records } = await fixture(t);
  records.push({
    _id: 'existing',
    email: 'cook@example.com',
    username: 'Old',
    save: async () => {},
  });
  const flow = await start();
  await get(
    `/api/auth/google/callback?code=abc&state=${flow.state}`,
    flow.cookie
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].googleId, 'google-sub-1');
});

test('callback rejects bad state, missing cookie, unverified email, wrong audience', async (t) => {
  const bad = '/login?error=google_failed';
  let f = await fixture(t);
  let flow = await f.start();
  assert.equal(
    (
      await f.get('/api/auth/google/callback?code=abc&state=wrong', flow.cookie)
    ).headers.get('location'),
    bad
  );
  assert.equal(
    (
      await f.get(`/api/auth/google/callback?code=abc&state=${flow.state}`)
    ).headers.get('location'),
    bad
  );
  const tampered = flow.cookie.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  assert.equal(
    (
      await f.get(
        `/api/auth/google/callback?code=abc&state=${flow.state}`,
        tampered
      )
    ).headers.get('location'),
    bad
  );

  for (const claims of [
    { email_verified: false },
    { aud: 'someone-else' },
    { nonce: 'wrong' },
  ]) {
    f = await fixture(t, { claims });
    flow = await f.start();
    const response = await f.get(
      `/api/auth/google/callback?code=abc&state=${flow.state}`,
      flow.cookie
    );
    assert.equal(response.headers.get('location'), bad);
    assert.equal(f.records.length, 0);
  }
  f = await fixture(t, { tokenOk: false });
  flow = await f.start();
  assert.equal(
    (
      await f.get(
        `/api/auth/google/callback?code=abc&state=${flow.state}`,
        flow.cookie
      )
    ).headers.get('location'),
    bad
  );
});

test('user cancelling on Google returns a friendly error', async (t) => {
  const { get, start } = await fixture(t);
  const flow = await start();
  const response = await get(
    `/api/auth/google/callback?error=access_denied&state=${flow.state}`,
    flow.cookie
  );
  assert.equal(
    response.headers.get('location'),
    '/login?error=google_cancelled'
  );
});