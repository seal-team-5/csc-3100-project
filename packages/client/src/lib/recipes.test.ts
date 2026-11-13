import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultFor, getRecipeResult } from './recipes.ts';
import type { RecipeFilter, RecipeSummary } from './recipes.ts';

const recipe = (id: string, filters: RecipeFilter[]): RecipeSummary => ({
  id,
  name: id,
  image: '',
  filters,
});

const italian = { type: 'cuisine', name: 'Italian' };
const moroccan = { type: 'cuisine', name: 'Moroccan' };
const vegetarian = { type: 'category', name: 'Vegetarian' };
const beef = { type: 'category', name: 'Beef' };

const italianVeg = recipe('italian-veg', [italian, vegetarian]);
const moroccanBeef = recipe('moroccan-beef', [moroccan, beef]);
const frenchVeg = recipe('french-veg', [
  { type: 'cuisine', name: 'French' },
  vegetarian,
]);

test('no filters matches everything', () => {
  assert.equal(resultFor(italianVeg, []).exactMatch, true);
});

test('multiple cuisines are OR', () => {
  const filters = [italian, moroccan];
  assert.equal(resultFor(italianVeg, filters).exactMatch, true);
  assert.equal(resultFor(moroccanBeef, filters).exactMatch, true);
  assert.equal(resultFor(frenchVeg, filters).exactMatch, false);
});

test('non-cuisine filters are still AND', () => {
  assert.equal(resultFor(italianVeg, [vegetarian]).exactMatch, true);
  assert.equal(resultFor(italianVeg, [beef, vegetarian]).exactMatch, false);
});

test('cuisine OR combines with category AND', () => {
  const filters = [italian, moroccan, vegetarian];
  assert.equal(resultFor(italianVeg, filters).exactMatch, true);
  assert.equal(resultFor(moroccanBeef, filters).exactMatch, false); // wrong category
  assert.equal(resultFor(frenchVeg, filters).exactMatch, false); // wrong cuisine
});

test('changedFilters lists only the unmet filters', () => {
  const result = resultFor(frenchVeg, [italian, moroccan, vegetarian]);
  assert.deepEqual(result.changedFilters, [italian, moroccan]);
});

test('getRecipeResult prefers an exact match with multiple cuisines', () => {
  for (let i = 0; i < 20; i++) {
    const result = getRecipeResult(
      [italianVeg, moroccanBeef, frenchVeg],
      [italian, moroccan]
    );
    assert.equal(result?.exactMatch, true);
    assert.notEqual(result?.recipe.id, 'french-veg');
  }
});

test('getRecipeResult returns null with no recipes', () => {
  assert.equal(getRecipeResult([], [italian]), null);
});
