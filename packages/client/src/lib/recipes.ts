import { PREGNANCY_FILTER } from '../../../shared/recipeFilters.ts';

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
  startedAt: string;
  completedAt?: string;
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
  const cuisineFilters = filters.filter((f) => f.type === 'cuisine');
  const otherFilters = filters.filter((f) => f.type !== 'cuisine');

  // switch cuisines to OR instead of AND: one match is enough (or no cuisine selected at all)
  const cuisineSatisfied =
    cuisineFilters.length === 0 ||
    cuisineFilters.some((filter) => filterMatches(recipe, filter));

  const changedFilters = [
    ...(cuisineSatisfied ? [] : cuisineFilters),
    ...otherFilters.filter((filter) => !filterMatches(recipe, filter)),
  ];

  return { recipe, exactMatch: changedFilters.length === 0, changedFilters };
}

export function getRecipeResult(
  recipes: RecipeSummary[],
  filters: RecipeFilter[],
  previousId?: string
): RecipeResult | null {
  // Keep Pregnancy selected even when relaxing other preferences for a closest match.
  const pregnancySelected = filters.some(
    (filter) =>
      filter.type === PREGNANCY_FILTER.type &&
      filter.name === PREGNANCY_FILTER.name
  );
  const eligible = pregnancySelected
    ? recipes.filter((recipe) => filterMatches(recipe, PREGNANCY_FILTER))
    : recipes;
  if (!eligible.length) return null;
  const ranked = eligible.map((recipe) => resultFor(recipe, filters));
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
