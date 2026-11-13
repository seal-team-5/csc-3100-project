import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { createApp } from './app.js';

const origin = 'http://localhost:3000';
const password = 'test password for progress';
const passwordHash = await bcrypt.hash(password, 12);
const pasta = '000000000000000000000001';
const soup = '000000000000000000000002';

async function fixture(t, recipeProgress) {
  const user = {
    _id: '1',
    username: 'Cook',
    email: 'cook@example.test',
    password: passwordHash,
    recipeProgress,
    async save() {},
  };
  const User = {
    findById: async (id) => (String(id) === '1' ? user : null),
    findOne: ({ email }) => ({
      select: async () => (email === user.email ? user : null),
    }),
  };
  const names = { [pasta]: 'Pasta', [soup]: 'Soup' };
  const Recipe = {
    findById: async (id) =>
      names[String(id)] ? { _id: id, Name: names[String(id)] } : null,
  };
  const server = createApp({
    User,
    Recipe,
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'progress-test-secret-at-least-32-bytes!!',
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
  const request = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const login = async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password },
    });
    return response.headers.get('set-cookie').split(';')[0];
  };
  return { request, login, user };
}

test('DELETE /api/recipe-progress/:id requires login', async (t) => {
  const { request } = await fixture(t, []);
  const response = await request(`/api/recipe-progress/${pasta}`, {
    method: 'DELETE',
  });
  assert.equal(response.status, 401);
});

test('DELETE /api/recipe-progress/:id rejects invalid IDs', async (t) => {
  const { request, login } = await fixture(t, []);
  const cookie = await login();
  const response = await request('/api/recipe-progress/not-an-id', {
    method: 'DELETE',
    cookie,
  });
  assert.equal(response.status, 400);
});

test('DELETE removes only that recipe, including legacy name-only entries', async (t) => {
  const { request, login, user } = await fixture(t, [
    { recipeId: pasta, recipeName: 'Pasta', status: 'completed' },
    { recipeId: soup, recipeName: 'Soup', status: 'in-progress' },
  ]);
  const cookie = await login();
  let response = await request(`/api/recipe-progress/${pasta}`, {
    method: 'DELETE',
    cookie,
  });
  assert.equal(response.status, 200);
  const { recipeProgress } = await response.json();
  assert.deepEqual(
    recipeProgress.map((item) => item.recipeName),
    ['Soup']
  );
  assert.equal(user.recipeProgress.length, 1);

  // legacy entry saved before recipeId existed.
  user.recipeProgress = [{ recipeName: 'Soup', status: 'completed' }];
  response = await request(`/api/recipe-progress/${soup}`, {
    method: 'DELETE',
    cookie,
  });
  assert.deepEqual((await response.json()).recipeProgress, []);
});

test('DELETE for a recipe with no progress is a harmless no-op', async (t) => {
  const { request, login } = await fixture(t, [
    { recipeId: soup, recipeName: 'Soup', status: 'completed' },
  ]);
  const cookie = await login();
  const response = await request(`/api/recipe-progress/${pasta}`, {
    method: 'DELETE',
    cookie,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).recipeProgress.length, 1);
});
