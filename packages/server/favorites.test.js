import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { createApp } from './app.js';

const origin = 'http://localhost:3000';
const password = 'test password for favorites';
const passwordHash = await bcrypt.hash(password, 12);

const recipeA = '000000000000000000000001';
const recipeB = '000000000000000000000002';
const missingRecipe = '000000000000000000000099';

async function fixture(t) {
  const saves = { count: 0 };
  const users = new Map(
    [
      ['1', 'cook1@example.test', 'First Cook'],
      ['2', 'cook2@example.test', 'Second Cook'],
    ].map(([id, email, username]) => [
      id,
      {
        _id: id,
        username,
        email,
        password: passwordHash,
        favorites: [],
        async save() {
          saves.count++;
        },
      },
    ])
  );
  const User = {
    findById: async (id) => users.get(String(id)) || null,
    findOne: ({ email }) => ({
      select: async () =>
        [...users.values()].find((user) => user.email === email) || null,
    }),
  };
  const knownRecipes = new Set([recipeA, recipeB]);
  const Recipe = {
    findById: async (id) => (knownRecipes.has(String(id)) ? { _id: id } : null),
  };

  const server = createApp({
    User,
    Recipe,
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'favorites-test-secret-at-least-32-bytes',
    appOrigin: origin,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
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
    { method = 'GET', body, cookie, requestOrigin = origin } = {}
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

  // Logs in and returns the session cookie to send on later requests.
  async function login(email = 'cook1@example.test') {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }

  const toggle = (cookie, recipeId) =>
    request('/api/favorites', { method: 'POST', cookie, body: { recipeId } });

  return { request, login, toggle, users, saves };
}

// GET TESTS //

test('GET /api/user requires login', async (t) => {
  const { request } = await fixture(t);
  const response = await request('/api/user');
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Please log in.' });
});

test('GET /api/user returns the public user with empty favorites', async (t) => {
  const { request, login } = await fixture(t);
  const cookie = await login();
  const response = await request('/api/user', { cookie });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { user } = await response.json();
  assert.deepEqual(user, {
    id: '1',
    username: 'First Cook',
    email: 'cook1@example.test',
    favorites: [],
  });
  assert.equal('password' in user, false);
});

test('GET /api/user returns existing favorites', async (t) => {
  const { request, login, users } = await fixture(t);
  users.get('1').favorites = [recipeA, recipeB];
  const cookie = await login();
  const { user } = await (await request('/api/user', { cookie })).json();
  assert.deepEqual(user.favorites, [recipeA, recipeB]);
});

test('GET /api/user treats a missing favorites field as empty', async (t) => {
  const { request, login, users } = await fixture(t);
  delete users.get('1').favorites;
  const cookie = await login();
  const { user } = await (await request('/api/user', { cookie })).json();
  assert.deepEqual(user.favorites, []);
});

// POST TESTS //

test('POST /api/favorites requires login', async (t) => {
  const { toggle, saves } = await fixture(t);
  const response = await toggle(undefined, recipeA);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Please log in.' });
  assert.equal(saves.count, 0);
});

test('POST /api/favorites adds a recipe, then removes it on repeat', async (t) => {
  const { toggle, login, saves, users } = await fixture(t);
  const cookie = await login();

  const added = await toggle(cookie, recipeA);
  assert.equal(added.status, 200);
  assert.equal(added.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await added.json(), { favorites: [recipeA] });
  assert.deepEqual(users.get('1').favorites, [recipeA]);
  assert.equal(saves.count, 1);

  const removed = await toggle(cookie, recipeA);
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { favorites: [] });
  assert.deepEqual(users.get('1').favorites, []);
  assert.equal(saves.count, 2);
});

test('POST /api/favorites keeps other favorites when removing one', async (t) => {
  const { toggle, login } = await fixture(t);
  const cookie = await login();
  await toggle(cookie, recipeA);
  const both = await (await toggle(cookie, recipeB)).json();
  assert.deepEqual(both.favorites, [recipeA, recipeB]);
  const afterRemove = await (await toggle(cookie, recipeA)).json();
  assert.deepEqual(afterRemove.favorites, [recipeB]);
});

test('POST /api/favorites rejects invalid recipe IDs', async (t) => {
  const { request, toggle, login, saves } = await fixture(t);
  const cookie = await login();
  const invalidIds = [
    undefined,
    null,
    123,
    '',
    'short',
    recipeA.slice(1), // 23 characters
    recipeA + '0', // 25 characters
    'z'.repeat(24), // right length, not hex
    { $ne: null },
    [recipeA],
  ];
  for (const recipeId of invalidIds) {
    const response = await toggle(cookie, recipeId);
    assert.equal(response.status, 400, `expected 400 for ${String(recipeId)}`);
    assert.deepEqual(await response.json(), { error: 'Invalid recipe ID.' });
  }
  // No body at all
  const noBody = await request('/api/favorites', { method: 'POST', cookie });
  assert.equal(noBody.status, 400);
  assert.equal(saves.count, 0);
});

test('POST /api/favorites returns 404 for an unknown recipe', async (t) => {
  const { toggle, login, saves, users } = await fixture(t);
  const cookie = await login();
  const response = await toggle(cookie, missingRecipe);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Recipe not found.' });
  assert.deepEqual(users.get('1').favorites, []);
  assert.equal(saves.count, 0);
});

test('POST /api/favorites rejects a cross-origin request', async (t) => {
  const { request, login, saves } = await fixture(t);
  const cookie = await login();
  const response = await request('/api/favorites', {
    method: 'POST',
    cookie,
    body: { recipeId: recipeA },
    requestOrigin: 'http://evil.example',
  });
  assert.equal(response.status, 403);
  assert.equal(saves.count, 0);
});
