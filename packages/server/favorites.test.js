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

