import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcrypt';
import session from 'express-session';
import UserModel from './userSchema.ts';
import { createApp } from './app.js';

const origin = 'http://localhost:3000';
const userId = '100000000000000000000001';
const password = 'test password for settings';
const passwordHash = await bcrypt.hash(password, 12);

// In-memory users built from the real Mongoose model, so schema defaults and
// validation run without a database.
async function fixture(t) {
  const users = new Map();
  function addUser(id = userId, fields = {}) {
    const user = new UserModel({
      _id: id,
      username: 'Test Cook',
      email: 'cook@example.test',
      password: passwordHash,
      ...fields,
    });
    user.save = async () => {
      await user.validate();
      return user;
    };
    users.set(id, user);
    return user;
  }
  const User = {
    findById: async (id) => users.get(String(id)) || null,
    findOne: ({ email }) => ({
      select: async () =>
        [...users.values()].find((user) => user.email === email) || null,
    }),
  };
  const server = createApp({
    User,
    Recipe: {},
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'settings-test-secret-at-least-32-bytes-long',
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
  const request = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login() {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'cook@example.test', password },
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  return { users, addUser, request, login };
}

test('settings endpoints require login', async (t) => {
  const api = await fixture(t);
  assert.equal((await api.request('/api/settings')).status, 401);
  const response = await api.request('/api/settings', {
    method: 'PUT',
    body: {},
  });
  assert.equal(response.status, 401);
});

test('a user with no saved settings gets the defaults', async (t) => {
  const api = await fixture(t);
  api.addUser();
  const cookie = await api.login();
  const response = await api.request('/api/settings', { cookie });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.settings, {
    servingSize: 2,
    location: '',
    unitSystem: 'us',
    preferredFilters: [],
    dietaryRestrictions: [],
    dislikes: [],
    allergies: [],
    notifications: {
      dailySuggestions: true,
      groceryItems: true,
      weeklySummary: false,
      marketing: false,
    },
  });
  assert.equal(payload.username, 'Test Cook');
  assert.equal(payload.email, 'cook@example.test');
});
