import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from './app.js';
import { hashPassword } from './password.js';
import RecipeModel from './recipeSchema.ts';
import { recipeInput } from './recipeInput.js';

const valid = {
  name: ' Tomato pasta ',
  ingredients: [' 200 g pasta '],
  instructions: [' Boil and serve. '],
  filters: [{ name: 'Italian', type: 'cuisine' }],
};
test('recipe input rejects malformed content and strips client-controlled IDs and reviews', () => {
  for (const body of [
    null,
    {},
    { ...valid, name: ' ' },
    { ...valid, name: 'x'.repeat(151) },
    { ...valid, ingredients: [] },
    { ...valid, ingredients: [42] },
    { ...valid, instructions: [' '] },
    { ...valid, instructions: Array(31).fill('step') },
    { ...valid, image: 'javascript:alert(1)' },
    { ...valid, image: 'http://example.com/image.jpg' },
    { ...valid, filters: [null] },
  ]) {
    assert.ok(recipeInput(body || {}).error);
  }
  const input = recipeInput({
    ...valid,
    _id: 'forged',
    Reviews: [{ rating: 5 }],
    userId: 'another-user',
  });
  assert.equal(input.recipe.Name, 'Tomato pasta');
  assert.deepEqual(input.recipe.Ingredients, ['200 g pasta']);
  assert.equal(input.recipe.Image, '/design/recipe-placeholder.svg');
  assert.equal(input.recipe._id, undefined);
  assert.deepEqual(input.recipe.Reviews, []);
});

test('recipe creation requires authentication, validates input, persists the recipe and handles database failure', async (t) => {
  const records = [];
  const password = 'a recipe creation password';
  const user = {
    _id: '100000000000000000000001',
    username: 'Cook',
    email: 'cook@example.test',
    password: await hashPassword(password),
  };
  let offline = false;
  const User = {
    findById: async () => user,
    findOne: () => ({ select: async () => user }),
  };
  const Recipe = {
    async create(data) {
      if (offline) throw new Error('private database connection details');
      const doc = new RecipeModel(data);
      await doc.validate();
      records.push(doc.toObject());
      return doc;
    },
    findById(id) {
      return {
        lean: async () =>
          records.find((item) => String(item._id) === id) || null,
      };
    },
  };
  const origin = 'http://localhost:3000';
  const server = createApp({
    User,
    Recipe,
    appOrigin: origin,
    sessionSecret: 'recipe-creation-secret-longer-than-32-bytes',
    sessionStore: new session.MemoryStore(),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  const request = (path, body, cookie, method = 'POST') =>
    fetch('http://127.0.0.1:' + server.address().port + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await request('/api/recipes', valid)).status, 401);
  const login = await request('/api/auth/login', {
    email: user.email,
    password,
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await request('/api/recipes', { ...valid, ingredients: [] }, cookie))
      .status,
    400
  );
  assert.equal(records.length, 0);
  const response = await request(
    '/api/recipes',
    {
      ...valid,
      Reviews: [{ rating: 5 }],
      image: 'https://example.com/pasta.jpg',
    },
    cookie
  );
  assert.equal(response.status, 201);
  const { recipe } = await response.json();
  assert.equal(recipe.name, 'Tomato pasta');
  assert.equal(recipe.image, 'https://example.com/pasta.jpg');
  assert.deepEqual(recipe.ingredients, ['200 g pasta']);
  assert.equal(recipe.reviewCount, 0);
  assert.deepEqual(records[0].Reviews, []);
  const detail = await (
    await request('/api/recipes/' + recipe.id, undefined, undefined, 'GET')
  ).json();
  assert.equal(detail.recipe.name, recipe.name);
  // Valid multiline recipes can exceed the smaller authentication request limit.
  assert.equal(
    (
      await request(
        '/api/recipes',
        { ...valid, instructions: Array(20).fill('x'.repeat(500)) },
        cookie
      )
    ).status,
    201
  );
  offline = true;
  const failed = await request('/api/recipes', valid, cookie);
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).error.includes('private'), false);
});

test('new recipe filters use the same canonical categories as PR 79', () => {
  const input = recipeInput({
    ...valid,
    filters: [
      { type: 'category', name: 'Vegetarian' },
      { type: 'tag', name: 'BBQ' },
      { type: 'diet', name: 'Vegetarian' },
    ],
  });
  assert.deepEqual(input.recipe.Filters, [
    { type: 'diet', name: 'Vegetarian' },
    { type: 'method', name: 'Grilling' },
  ]);
});
