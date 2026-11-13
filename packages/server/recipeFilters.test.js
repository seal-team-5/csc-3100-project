import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecipeFilters } from '../shared/recipeFilters.ts';

test('Pregnancy survives legacy tag cleanup and saved preference normalization', () => {
  const expected = [{ type: 'life_stage', name: 'Pregnancy' }];
  assert.deepEqual(
    normalizeRecipeFilters([
      { type: 'tag', name: 'Pregnancy' },
      { type: 'category', name: ' pregnant ' },
      { type: 'tag', name: 'Pregnancy-friendly' },
    ]),
    expected
  );
  assert.deepEqual(normalizeRecipeFilters(expected), expected);
});

test('legacy API labels are categorized, normalized and deduplicated', () => {
  const filters = normalizeRecipeFilters([
    { type: 'cuisine', name: ' italian ' },
    { type: 'category', name: 'Chicken' },
    { type: 'tag', name: 'chicken, BBQ, Barbecue, Side, Soup' },
    { type: 'category', name: 'Vegetarian' },
    { type: 'tag', name: 'vegetarian' },
  ]);
  assert.deepEqual(filters, [
    { type: 'cuisine', name: 'Italian' },
    { type: 'protein', name: 'Chicken' },
    { type: 'meal', name: 'Side dish' },
    { type: 'diet', name: 'Vegetarian' },
    { type: 'method', name: 'Grilling' },
    { type: 'dish', name: 'Soup' },
  ]);
  assert.deepEqual(normalizeRecipeFilters(filters), filters);
});

test('irrelevant tags and malformed labels are excluded without inventing dietary claims', () => {
  assert.deepEqual(
    normalizeRecipeFilters([
      null,
      {},
      { type: 'tag', name: null },
      { type: 'tag', name: ' , , ' },
      {
        type: 'tag',
        name: 'Delicious, Favourite, DateNight, LowCalorie, GlutenFree',
      },
      { type: 'category', name: 'Miscellaneous' },
      { type: 'cuisine', name: 'Unknown' },
      { type: 'unexpected', name: 'Chicken' },
    ]),
    []
  );
  assert.deepEqual(normalizeRecipeFilters(null), []);
});
