import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import connectDB from '../database.ts';
import Recipe from '../recipeSchema.ts';
import User from '../userSchema.ts';
import { createApp } from '../app.js';

// Read-only integration check: use actual MongoDB recipes, with no seed or fixtures.
test('the combined API serves the actual MongoDB recipe collection', async (t) => {
  t.after(() => mongoose.disconnect());
  await connectDB();
  const server = createApp({
    User,
    Recipe,
    sessionSecret: randomBytes(32).toString('hex'),
    appOrigin: 'http://127.0.0.1:5173',
  }).listen(0, '127.0.0.1');
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/recipes`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  const documents = await Recipe.find({}).lean();
  const expected = documents.map((recipe) => ({
    image: recipe.Image,
    name: recipe.Name,
    ingredients: recipe.Ingredients,
    instructions: recipe.Instructions,
    filters: recipe.Filters.map(({ name, type }) => ({ name, type })),
  }));
  const byName = (a, b) => a.name.localeCompare(b.name);
  assert.deepEqual(payload.recipes.sort(byName), expected.sort(byName));
  assert.equal((await fetch(`${base}/api/auth/me`)).status, 401);
  assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  const page = await fetch(`${base}/recipes`);
  assert.equal(page.status, 200);
  assert.match(
    page.headers.get('content-security-policy'),
    /img-src 'self' https:/
  );
  t.diagnostic(
    `Verified ${documents.length} real MongoDB recipes; no database writes.`
  );
});
