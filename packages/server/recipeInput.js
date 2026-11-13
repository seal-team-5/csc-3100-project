import { normalizeRecipeFilters } from '../shared/recipeFilters.ts';

// Accept only the fields used to create a recipe; clients cannot set IDs or reviews.
export function recipeInput(body = {}) {
  const { name, image = '', ingredients, instructions, filters = [] } = body;
  const text = (value, max) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const lines = (value, count, length) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= count &&
    value.every((line) => text(line, length));
  if (!text(name, 150))
    return { error: 'Enter a recipe name of at most 150 characters.' };
  if (!lines(ingredients, 50, 200))
    return { error: 'Add 1–50 ingredients, with at most 200 characters each.' };
  if (!lines(instructions, 30, 1000))
    return {
      error: 'Add 1–30 direction steps, with at most 1000 characters each.',
    };
  if (typeof image !== 'string' || image.length > 2000)
    return { error: 'Enter a valid HTTPS image URL.' };
  const imageUrl = image.trim();
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error();
    } catch {
      return { error: 'Enter a valid HTTPS image URL, or leave it blank.' };
    }
  }
  if (
    !Array.isArray(filters) ||
    filters.length > 30 ||
    !filters.every(
      (filter) => filter && text(filter.name, 60) && text(filter.type, 60)
    )
  ) {
    return { error: 'Choose at most 30 valid preference filters.' };
  }
  return {
    recipe: {
      Name: name.trim(),
      Image: imageUrl || '/design/recipe-placeholder.svg',
      Ingredients: ingredients.map((line) => line.trim()),
      Instructions: instructions.map((line) => line.trim()),
      Filters: normalizeRecipeFilters(filters),
      Reviews: [],
    },
  };
}
