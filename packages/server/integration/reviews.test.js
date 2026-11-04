import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import session from 'express-session';
import UserModel from '../userSchema.ts';
import RecipeModel from '../recipeSchema.ts';
import { hashPassword } from '../password.js';
import { createApp } from '../app.js';

test('MongoDB reviews survive backend restart, update without duplication, and open from History', async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URL;
  assert.ok(uri, 'Set MONGO_URI or MONGODB_URL to run this integration test.');
  // A separate connection prevents the regular models from creating indexes or collections.
  const connection = await mongoose
    .createConnection(uri, {
      serverSelectionTimeoutMS: 10000,
      autoCreate: false,
      autoIndex: false,
    })
    .asPromise();
  const suffix = randomBytes(8).toString('hex');
  const collections = [
    `codex_review_check_users_${suffix}`,
    `codex_review_check_recipes_${suffix}`,
  ];
  const userModelName = 'User';
  const userSchema = UserModel.schema.clone();
  const recipeSchema = RecipeModel.schema.clone();
  recipeSchema.path('Reviews').schema.path('userId').options.ref =
    userModelName;
  const User = connection.model(userModelName, userSchema, collections[0]);
  const Recipe = connection.model(
    `ReviewCheckRecipe_${suffix}`,
    recipeSchema,
    collections[1]
  );
  let server;
  let base;
  const origin = 'http://localhost:3000';
  const password = randomBytes(18).toString('hex');
  async function startServer() {
    server = createApp({
      User,
      Recipe,
      sessionStore: new session.MemoryStore(),
      sessionSecret: randomBytes(32).toString('hex'),
      appOrigin: origin,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stopServer() {
    if (server)
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    server = null;
  }
  const request = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login(email) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  try {
    await User.createCollection();
    await Recipe.createCollection();
    const hash = await hashPassword(password);
    const user = await User.create({
      username: 'Isolated Review Test Cook',
      email: `review-${suffix}@example.test`,
      password: hash,
      recipeProgress: [
        {
          recipeName: `Review test pasta ${suffix}`,
          status: 'completed',
          completedAt: new Date(),
        },
      ],
    });
    const secondUser = await User.create({
      username: 'Second Test Cook',
      email: `review-second-${suffix}@example.test`,
      password: hash,
    });
    const recipe = await Recipe.create({
      Name: `Review test pasta ${suffix}`,
      Image: '/test.jpg',
      Ingredients: ['pasta'],
      Instructions: ['Boil.'],
      Filters: [],
    });
    const path = `/api/recipes/${recipe._id}/reviews`;
    await startServer();
    let cookie = await login(user.email);
    assert.deepEqual(await (await request(path)).json(), {
      reviews: [],
      reviewCount: 0,
      averageRating: null,
    });
    assert.equal(
      (
        await request(path, {
          method: 'PUT',
          cookie,
          body: { rating: 4, note: 'Initial isolated test note.' },
        })
      ).status,
      200
    );
    let result = await (await request(path, { cookie })).json();
    assert.equal(result.reviewCount, 1);
    assert.equal(result.averageRating, 4);
    assert.equal(result.reviews[0].isOwn, true);
    assert.equal(result.reviews[0].username, user.username);
    const stored = await Recipe.collection.findOne({ _id: recipe._id });
    assert.equal(stored.Reviews[0].note, 'Initial isolated test note.');
    const rolls = await Promise.all(
      [0, 1].map(() =>
        request('/api/recipe-history', {
          method: 'POST',
          cookie,
          body: { recipeId: String(recipe._id) },
        })
      )
    );
    assert.ok(rolls.every((response) => response.status === 201));
    const savedRolls = await User.collection.findOne({ _id: user._id });
    assert.equal(savedRolls.generatedRecipes.length, 2);
    // Close the app and its session store; reviews must be loaded from MongoDB again.
    await stopServer();
    await startServer();
    cookie = await login(user.email);
    const generated = await (
      await request('/api/recipe-history', { cookie })
    ).json();
    assert.equal(generated.generatedRecipes.length, 2);
    assert.equal(generated.generatedRecipes[0].recipeId, String(recipe._id));
    assert.equal(generated.generatedRecipes[0].recipeName, recipe.Name);
    result = await (await request(path, { cookie })).json();
    assert.equal(result.reviews[0].note, 'Initial isolated test note.');
    assert.equal(
      (
        await request(path, {
          method: 'PUT',
          cookie,
          body: { rating: 5, note: 'Updated isolated test note.' },
        })
      ).status,
      200
    );
    const secondCookie = await login(secondUser.email);
    const responses = await Promise.all([
      request(path, {
        method: 'PUT',
        cookie,
        body: { rating: 5, note: 'Final note.' },
      }),
      request(path, {
        method: 'PUT',
        cookie: secondCookie,
        body: { rating: 3, note: 'Second user note.' },
      }),
    ]);
    assert.ok(responses.every((response) => response.status === 200));
    result = await (await request(path, { cookie })).json();
    assert.equal(result.reviewCount, 2);
    assert.equal(result.averageRating, 4);
    assert.equal(result.reviews.filter((review) => review.isOwn).length, 1);
    const history = await (
      await request('/api/recipe-progress', { cookie })
    ).json();
    assert.equal(history.recipeProgress[0].recipeId, String(recipe._id));
    assert.equal(
      (
        await request('/api/recipe-progress', {
          method: 'POST',
          cookie,
          body: { recipeId: String(recipe._id), status: 'completed' },
        })
      ).status,
      200
    );
    const updatedUser = await User.findById(user._id);
    assert.equal(
      String(updatedUser.recipeProgress[0].recipeId),
      String(recipe._id)
    );
  } finally {
    await stopServer();
    try {
      // Never drop the database or regular users/recipes collections.
      for (const name of collections) {
        assert.ok(
          /^codex_review_check_(users|recipes)_[a-f0-9]{16}$/.test(name)
        );
        try {
          await connection.dropCollection(name);
        } catch (error) {
          if (error.code !== 26) throw error;
        }
      }
    } finally {
      await connection.close();
    }
  }
});
