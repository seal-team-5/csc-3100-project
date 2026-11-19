/*
tsx file for Favorites page, which displays the user's favorite 
recipes and allows them to view recipe details in a dialog.
*/

import { useEffect, useState } from 'react';
import type {
  RecipeProgress,
  RecipeResult,
  RecipeSummary,
} from '../lib/recipes';
import RecipeCard from '../components/RecipeCard';
import RecipeDialog from '../components/RecipeDialog';
import {
  EmptyState,
  EmptyStateLink,
  ErrorState,
  LoginPrompt,
  RecipeGridSkeleton,
} from '../components/PageState';

type UserData = {
  favorites: string[];
};

export default function Favorites() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSummary | null>(
    null
  );
  const [progress, setProgress] = useState<RecipeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggedOut, setLoggedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Load the user's favorite recipes on mount and whenever Retry is pressed
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadFavorites() {
      setLoading(true);
      setError('');
      setLoggedOut(false);
      try {
        const [userResponse, recipesResponse] = await Promise.all([
          fetch('/api/user', { signal }),
          fetch('/api/recipes?view=summary', { signal }),
        ]);

        if (userResponse.status === 401) {
          setLoggedOut(true);
          return;
        }
        if (!userResponse.ok || !recipesResponse.ok) {
          throw new Error('Could not load favorites.');
        }

        const userData: { user: UserData } = await userResponse.json();
        const recipeData: { recipes: RecipeSummary[] } =
          await recipesResponse.json();

        if (signal.aborted) return;
        setFavoriteIds(userData.user.favorites);
        setRecipes(recipeData.recipes);

        // Progress is optional: it only decides which progress button to show.
        const progressResponse = await fetch('/api/recipe-progress', {
          signal,
        });
        if (progressResponse.ok) {
          const progressData: { recipeProgress: RecipeProgress[] } =
            await progressResponse.json();
          if (!signal.aborted) setProgress(progressData.recipeProgress);
        }
      } catch {
        if (!signal.aborted) setError('Could not load your favorite recipes.');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void loadFavorites();
    return () => controller.abort();
  }, [attempt]);

  // Filter the recipes to only include those that are in the user's favorites
  const favoriteRecipes = recipes.filter((recipe) =>
    favoriteIds.includes(recipe.id)
  );

  // Prepare the dialog result for the selected recipe, if any
  const dialogResult: RecipeResult | null = selectedRecipe
    ? {
        recipe: selectedRecipe,
        exactMatch: true,
        changedFilters: [],
      }
    : null;

  return (
    <section className="favorites-page">
      <h1>Favorite Recipes</h1>

      {loading && <RecipeGridSkeleton label="Loading favorites…" />}

      {!loading && loggedOut && (
        <LoginPrompt message="Log in to see the recipes you have saved." />
      )}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
      )}

      {!loading && !error && !loggedOut && favoriteRecipes.length === 0 && (
        <EmptyState
          title="No favorites yet"
          message="Tap Favorite on any recipe and it will show up here."
        >
          <EmptyStateLink to="/">Find a recipe</EmptyStateLink>
        </EmptyState>
      )}

      {!loading && !error && !loggedOut && (
        <div className="recipe-grid">
          {favoriteRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onOpen={setSelectedRecipe}
            />
          ))}
        </div>
      )}

      {dialogResult && (
        <RecipeDialog
          result={dialogResult}
          onClose={() => setSelectedRecipe(null)}
          onRegenerate={() => setSelectedRecipe(null)}
          progress={progress}
          onProgress={setProgress}
          favoriteIds={favoriteIds}
          onFavoritesChange={setFavoriteIds}
        />
      )}
    </section>
  );
}
