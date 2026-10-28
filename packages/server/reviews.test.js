import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import session from 'express-session';
import RecipeModel from './recipeSchema.ts';
import { createApp } from './app.js';

const origin = 'http://localhost:3000';
const recipeId = '000000000000000000000001';
const missingId = '000000000000000000000099';
const firstId = '100000000000000000000001';
const secondId = '100000000000000000000002';
const password = 'test password for reviews';
const passwordHash = await bcrypt.hash(password, 12);
const baseRecipe = {
  _id: recipeId,
  Name: 'Pasta',
  Image: '/pasta.jpg',
  Ingredients: ['pasta'],
  Instructions: ['Boil.'],
  Filters: [],
  Reviews: [],
  __v: 0,
};

// A persistent repository for HTTP tests, using real Mongoose schema validation.
// No real cluster credentials or network database writes are needed.
async function fixture(t) {
  const records = new Map([[recipeId, structuredClone(baseRecipe)]]);
  const users = new Map(
    [firstId, secondId].map((id, index) => [
      id,
      {
        _id: new mongoose.Types.ObjectId(id),
        username: index ? 'Second Cook' : 'First Cook',
        email: `cook${index + 1}@example.test`,
        password: passwordHash,
        recipeProgress: [],
        async save() {},
      },
    ])
  );
  const state = {
    records,
    users,
    forceConflict: false,
    offline: false,
    population: null,
  };
  const User = {
    findById: async (id) => users.get(String(id)) || null,
    findOne: ({ email }) => ({
      select: async () =>
        [...users.values()].find((user) => user.email === email) || null,
    }),
  };
  const Recipe = {
    findOne({ Name }) {
      const record = [...records.values()].find(
        (recipe) => recipe.Name === Name
      );
      return Recipe.findById(record ? String(record._id) : missingId);
    },
    findById(id) {
      const getRecord = () => {
        if (state.offline) throw new Error('private connection details');
        return records.get(String(id));
      };
      const getDocument = async () => {
        const record = getRecord();
        if (!record) return null;
        const doc = new RecipeModel(JSON.parse(JSON.stringify(record)));
        doc.save = async () => {
          await doc.validate();
          if (state.forceConflict || records.get(String(id)).__v !== doc.__v) {
            throw Object.assign(new Error('Simultaneous write'), {
              name: 'VersionError',
            });
          }
          doc.__v++;
          records.set(String(id), doc.toObject());
          return doc;
        };
        return doc;
      };
      let populated = false;
      return {
        select() {
          return this;
        },
        populate(path, fields) {
          state.population = { path, fields };
          populated = true;
          return this;
        },
        async lean() {
          const record = getRecord();
          if (!record) return null;
          const copy = structuredClone(record);
          if (populated)
            copy.Reviews = (record.Reviews || []).map((review) => ({
              ...review,
              userId: users.get(String(review.userId)) || null,
            }));
          return copy;
        },
        then(resolve, reject) {
          return getDocument().then(resolve, reject);
        },
      };
    },
    find(query) {
      return {
        select() {
          return this;
        },
        async lean() {
          return [...records.values()].filter((record) =>
            query.Name.$in.includes(record.Name)
          );
        },
      };
    },
  };
  const server = createApp({
    User,
    Recipe,
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'review-test-secret-at-least-32-bytes-long',
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
  async function login(index = 1) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: `cook${index}@example.test`, password },
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  return { ...state, state, request, login };
}

const reviewPath = `/api/recipes/${recipeId}/reviews`;

test('review schema validates stars, note size, user ID and defaults', async () => {
  const valid = new RecipeModel({
    ...baseRecipe,
    Reviews: [{ userId: firstId, rating: 4, note: '  Tasty!  ' }],
  });
  await valid.validate();
  assert.equal(valid.Reviews[0].note, 'Tasty!');
  assert.ok(valid.Reviews[0].createdAt instanceof Date);
  assert.equal(valid.Reviews[0]._id, undefined);
  assert.deepEqual(
    new RecipeModel({ ...baseRecipe, Reviews: undefined }).Reviews.toObject(),
    []
  );
  for (const rating of [0, 6, 2.5]) {
    await assert.rejects(
      new RecipeModel({
        ...baseRecipe,
        Reviews: [{ userId: firstId, rating }],
      }).validate()
    );
  }
  await assert.rejects(
    new RecipeModel({ ...baseRecipe, Reviews: [{ rating: 4 }] }).validate()
  );
  await assert.rejects(
    new RecipeModel({
      ...baseRecipe,
      Reviews: [{ userId: firstId, rating: 4, note: 'x'.repeat(2001) }],
    }).validate()
  );
  assert.equal(RecipeModel.schema.options.optimisticConcurrency, true);
});

test('review endpoints require login for writes and validate input', async (t) => {
  const api = await fixture(t);
  assert.equal(
    (await api.request(reviewPath, { method: 'PUT', body: { rating: 5 } }))
      .status,
    401
  );
  const cookie = await api.login();
  for (const body of [
    { rating: 0 },
    { rating: 6 },
    { rating: 2.5 },
    { rating: '5' },
    { rating: 5, note: {} },
    { rating: 5, note: 'x'.repeat(2001) },
  ]) {
    assert.equal(
      (await api.request(reviewPath, { method: 'PUT', cookie, body })).status,
      400
    );
  }
  for (const method of ['GET', 'PUT']) {
    assert.equal(
      (
        await api.request('/api/recipes/invalid/reviews', {
          method,
          cookie,
          ...(method === 'PUT' ? { body: { rating: 4 } } : {}),
        })
      ).status,
      400
    );
    assert.equal(
      (
        await api.request(`/api/recipes/${missingId}/reviews`, {
          method,
          cookie,
          ...(method === 'PUT' ? { body: { rating: 4 } } : {}),
        })
      ).status,
      404
    );
  }
  assert.equal(api.records.get(recipeId).Reviews.length, 0);
});

test('save, retrieve, update, average, identity protection and missing reviewers', async (t) => {
  const api = await fixture(t);
  const empty = await api.request(reviewPath);
  assert.deepEqual(await empty.json(), {
    reviews: [],
    reviewCount: 0,
    averageRating: null,
  });
  const cookie = await api.login();
  let response = await api.request(reviewPath, {
    method: 'PUT',
    cookie,
    body: { rating: 5, note: '  Great pasta!  ', userId: secondId },
  });
  assert.equal(response.status, 200);
  assert.equal(String(api.records.get(recipeId).Reviews[0].userId), firstId);
  response = await api.request(reviewPath, { cookie });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  let payload = await response.json();
  assert.equal(payload.averageRating, 5);
  assert.equal(payload.reviews[0].note, 'Great pasta!');
  assert.equal(payload.reviews[0].username, 'First Cook');
  assert.equal(payload.reviews[0].isOwn, true);
  assert.deepEqual(api.state.population, {
    path: 'Reviews.userId',
    fields: 'username',
  });
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes('password'), false);
  assert.equal(serialized.includes('email'), false);
  const createdAt = payload.reviews[0].createdAt;
  assert.equal(
    (
      await api.request(reviewPath, {
        method: 'PUT',
        cookie,
        body: { rating: 3, note: 'Less salt next time.' },
      })
    ).status,
    200
  );
  payload = await (await api.request(reviewPath, { cookie })).json();
  assert.equal(payload.reviewCount, 1);
  assert.equal(payload.reviews[0].createdAt, createdAt);
  const secondCookie = await api.login(2);
  await api.request(reviewPath, {
    method: 'PUT',
    cookie: secondCookie,
    body: { rating: 4 },
  });
  payload = await (await api.request(reviewPath)).json();
  assert.equal(payload.reviewCount, 2);
  assert.equal(payload.averageRating, 3.5);
  assert.ok(payload.reviews.every((review) => review.isOwn === false));
  api.users.delete(secondId);
  payload = await (await api.request(reviewPath)).json();
  assert.ok(
    payload.reviews.some((review) => review.username === 'Deleted user')
  );
  assert.equal(payload.averageRating, 3.5);
});

test('simultaneous saves retain both reviewers and one review per user', async (t) => {
  const api = await fixture(t);
  const firstCookie = await api.login();
  const secondCookie = await api.login(2);
  let responses = await Promise.all(
    [firstCookie, secondCookie].map((cookie) =>
      api.request(reviewPath, { method: 'PUT', cookie, body: { rating: 4 } })
    )
  );
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(api.records.get(recipeId).Reviews.length, 2);
  responses = await Promise.all(
    [2, 5].map((rating) =>
      api.request(reviewPath, {
        method: 'PUT',
        cookie: firstCookie,
        body: { rating },
      })
    )
  );
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(api.records.get(recipeId).Reviews.length, 2);
  api.state.forceConflict = true;
  assert.equal(
    (
      await api.request(reviewPath, {
        method: 'PUT',
        cookie: firstCookie,
        body: { rating: 1 },
      })
    ).status,
    409
  );
});

test('History resolves legacy names safely and stores IDs for new progress', async (t) => {
  const api = await fixture(t);
  const cookie = await api.login();
  api.records.set('000000000000000000000002', {
    ...baseRecipe,
    _id: '000000000000000000000002',
    Name: 'Soup',
  });
  api.records.set('000000000000000000000003', {
    ...baseRecipe,
    _id: '000000000000000000000003',
    Name: 'Soup',
  });
  const user = api.users.get(firstId);
  user.recipeProgress = [
    { recipeName: 'Pasta', status: 'completed', completedAt: new Date() },
    { recipeName: 'Soup', status: 'completed' },
    { recipeName: 'Deleted recipe', status: 'completed' },
  ];
  let payload = await (
    await api.request('/api/recipe-progress', { cookie })
  ).json();
  assert.equal(payload.recipeProgress[0].recipeId, recipeId);
  assert.equal(payload.recipeProgress[1].recipeId, undefined);
  assert.equal(payload.recipeProgress[2].recipeId, undefined);
  let response = await api.request('/api/recipe-progress', {
    method: 'POST',
    cookie,
    body: { recipeId, status: 'completed' },
  });
  assert.equal(response.status, 200);
  assert.equal(String(user.recipeProgress[0].recipeId), recipeId);
  assert.equal(user.recipeProgress.length, 3);
  response = await api.request('/api/recipe-progress', {
    method: 'POST',
    cookie,
    body: { recipeName: 'Pasta', status: 'in-progress' },
  });
  assert.equal(response.status, 200);
  assert.equal(user.recipeProgress[0].status, 'in-progress');
  assert.equal(user.recipeProgress[0].completedAt, undefined);
  assert.equal(
    (
      await api.request('/api/recipe-progress', {
        method: 'POST',
        cookie,
        body: { recipeId: 'invalid', status: 'completed' },
      })
    ).status,
    400
  );
});
