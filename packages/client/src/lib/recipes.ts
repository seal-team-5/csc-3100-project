export type RecipeFilter = { name: string; type: string };
export type RecipeSummary = {
  id: string;
  image: string;
  name: string;
  filters: RecipeFilter[];
  averageRating?: number | null;
  reviewCount?: number;
};
export type Recipe = RecipeSummary & {
  ingredients: string[];
  instructions: string[];
};
export type RecipeResult = {
  recipe: RecipeSummary;
  exactMatch: boolean;
  changedFilters: RecipeFilter[];
};
export type RecipeProgress = {
  recipeId?: string;
  recipeName: string;
  status: 'in-progress' | 'completed';
};
// Highest average rating first. Unrated recipes go last. Ties favor more
// reviews, then alphabetical order so the order is stable.
export function compareByRating(a: RecipeSummary, b: RecipeSummary) {
  const left = a.averageRating ?? -1;
  const right = b.averageRating ?? -1;
  return (
    right - left ||
    (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
    a.name.localeCompare(b.name)
  );
}
export function filterMatches(recipe: RecipeSummary, selected: RecipeFilter) {
  return recipe.filters.some(
    (filter) => filter.type === selected.type && filter.name === selected.name
  );
}
export function resultFor(
  recipe: RecipeSummary,
  filters: RecipeFilter[]
): RecipeResult {
  const changedFilters = filters.filter(
    (filter) => !filterMatches(recipe, filter)
  );
  return { recipe, exactMatch: changedFilters.length === 0, changedFilters };
}
export function getRecipeResult(
  recipes: RecipeSummary[],
  filters: RecipeFilter[],
  previousId?: string
): RecipeResult | null {
  if (!recipes.length) return null;
  const ranked = recipes.map((recipe) => resultFor(recipe, filters));
  const fewestChanges = Math.min(
    ...ranked.map((result) => result.changedFilters.length)
  );
  const closest = ranked.filter(
    (result) => result.changedFilters.length === fewestChanges
  );
  const alternatives = closest.filter(
    (result) => result.recipe.id !== previousId
  );
  const pool = alternatives.length ? alternatives : closest;
  return pool[Math.floor(Math.random() * pool.length)];
}