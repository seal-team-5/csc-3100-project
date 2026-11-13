import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.js';
import { getRecipeResult, resultFor } from '../client/src/lib/recipes.ts';

const documents = [
  {
    _id: '000000000000000000000001',
    Image: '/one.jpg',
    Name: 'Pasta',
    Ingredients: ['noodles'],
    Instructions: ['Boil water.'],
    Filters: [{ type: 'cuisine', name: 'Italian' }],
  },
  {
    _id: '000000000000000000000002',
    Image: '/two.jpg',
    Name: 'Soup',
    Ingredients: ['beans'],
    Instructions: ['Simmer.'],
    Filters: [{ type: 'category', name: 'Vegetarian' }],
    Reviews: [
      { userId: 'a', rating: 5, note: 'Great' },
      { userId: 'b', rating: 4, note: '' },
    ],
  },
];
async function fixture(t, unavailable = false) {
  let projection;
  let detailQueries = 0;
  const Recipe = {
    find() {
      return {
        select(value) {
          projection = value;
          return this;
        },
        async lean() {
          if (unavailable) throw new Error('offline');
          return projection
            ? documents.map(({ _id, Image, Name, Filters, Reviews }) => ({
                _id,
                Image,
                Name,
                Filters,
                Reviews,
              }))
            : documents;
        },
      };
    },
    findById(id) {
      detailQueries++;
      return {
        async lean() {
          if (unavailable) throw new Error('offline');
          return documents.find((recipe) => recipe._id === id) || null;
        },
      };
    },
  };
  const server = createApp({
    Recipe,
    sessionSecret: 'recipe-test-secret-with-at-least-32-bytes',
    appOrigin: 'http://localhost:3000',
  }).listen(0, '127.0.0.1');
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  await once(server, 'listening');
  return {
    request: (path) =>
      fetch(`http://127.0.0.1:${server.address().port}${path}`),
    projection: () => projection,
    detailQueries: () => detailQueries,
  };
}

test('recipe summaries project out details and expose stable IDs and filter groups', async (t) => {
  const api = await fixture(t);
  const response = await api.request('/api/recipes?view=summary');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(api.projection(), 'Image Name Filters Reviews');
  assert.deepEqual(payload.filterGroups, {
    cuisine: ['Italian'],
    category: ['Vegetarian'],
  });
  const { averageRating, reviewCount, ...summaryFields } = payload.recipes[0];
  assert.deepEqual(summaryFields, {
    id: documents[0]._id,
    image: '/one.jpg',
    name: 'Pasta',
    filters: documents[0].Filters,
  });
  assert.equal(averageRating, null);
  assert.equal(reviewCount, 0);
  assert.equal('Reviews' in payload.recipes[0], false);
  // Ratings are averaged on the server; individual reviews are not exposed.
  assert.equal(payload.recipes[1].averageRating, 4.5);
  assert.equal(payload.recipes[1].reviewCount, 2);
  assert.equal('Reviews' in payload.recipes[1], false);
  assert.equal('ingredients' in payload.recipes[0], false);
  assert.equal('instructions' in payload.recipes[0], false);
  const detail = await api.request(`/api/recipes/${payload.recipes[0].id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual((await detail.json()).recipe, {
    ...summaryFields,
    ingredients: ['noodles'],
    instructions: ['Boil water.'],
  });
});

test('the original full recipe list retains its response shape', async (t) => {
  const api = await fixture(t);
  const response = await api.request('/api/recipes');
  const { recipes } = await response.json();
  assert.equal(api.projection(), undefined);
  assert.deepEqual(recipes[0], {
    image: '/one.jpg',
    name: 'Pasta',
    filters: documents[0].Filters,
    ingredients: ['noodles'],
    instructions: ['Boil water.'],
  });
});

test('invalid IDs do not query the database; missing and unavailable recipes have distinct errors', async (t) => {
  const api = await fixture(t);
  assert.equal((await api.request('/api/recipes/not-an-id')).status, 400);
  assert.equal(api.detailQueries(), 0);
  assert.equal(
    (await api.request('/api/recipes/000000000000000000000099')).status,
    404
  );
  const unavailable = await fixture(t, true);
  assert.equal(
    (await unavailable.request('/api/recipes?view=summary')).status,
    503
  );
  assert.equal(
    (await unavailable.request(`/api/recipes/${documents[0]._id}`)).status,
    503
  );
});

const summaries = documents.map((recipe) => ({
  id: recipe._id,
  name: recipe.Name,
  image: recipe.Image,
  filters: recipe.Filters,
}));
test('matching preserves exact, closest, empty and unfiltered results', () => {
  assert.equal(getRecipeResult([], []), null);
  const italian = { type: 'cuisine', name: 'Italian' };
  assert.equal(getRecipeResult(summaries, [italian]).recipe.name, 'Pasta');
  const closest = getRecipeResult(summaries, [
    italian,
    { type: 'category', name: 'Dessert' },
  ]);
  assert.equal(closest.recipe.name, 'Pasta');
  assert.equal(closest.exactMatch, false);
  assert.deepEqual(closest.changedFilters, [
    { type: 'category', name: 'Dessert' },
  ]);
  assert.equal(
    getRecipeResult(summaries, [], summaries[0].id).recipe.id,
    summaries[1].id
  );
  assert.equal(
    getRecipeResult([summaries[0]], [], summaries[0].id).recipe.id,
    summaries[0].id
  );
  assert.deepEqual(resultFor(summaries[1], [italian]).changedFilters, [
    italian,
  ]);
});