/*
tsx file for Favorites page, which displays the user's favorite 
recipes and allows them to view recipe details in a dialog.
*/

import { useEffect, useState } from 'react';
import type { RecipeResult, RecipeSummary } from '../lib/recipes';
import RecipeCard from '../components/RecipeCard';
import RecipeDialog from '../components/RecipeDialog';
import RecipeActions from '../components/RecipeActions';

type UserData = {
  favorites: string[];
};

export default function Favorites() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSummary | null>(
    null
  );
  const [message, setMessage] = useState('Loading favorites...');

  // Load the user's favorite recipes when the component mounts
  useEffect(() => {
    async function loadFavorites() {
      try {
        const userResponse = await fetch('/api/user');
        const recipesResponse = await fetch('/api/recipes?view=summary');

        if (!userResponse.ok || !recipesResponse.ok) {
          throw new Error('Could not load favorites.');
        }

        const userData: { user: UserData } = await userResponse.json();
        const recipeData: { recipes: RecipeSummary[] } =
          await recipesResponse.json();

        setFavoriteIds(userData.user.favorites);
        setRecipes(recipeData.recipes);
        setMessage('');
      } catch {
        setMessage('Could not load favorite recipes.');
      }
    }

    void loadFavorites();
  }, []);

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

      {message && <p>{message}</p>}

      {!message && favoriteRecipes.length === 0 && (
        <p>You have not saved any recipes yet.</p>
      )}

      <div className="recipe-grid">
        {favoriteRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onOpen={setSelectedRecipe}
          >
            <RecipeActions
              recipeId={recipe.id}
              recipeName={recipe.name}
              favoriteIds={favoriteIds}
              onFavoritesChange={setFavoriteIds}
            />
          </RecipeCard>
        ))}
      </div>

      {dialogResult && (
        <RecipeDialog
          result={dialogResult}
          onClose={() => setSelectedRecipe(null)}
          onRegenerate={() => setSelectedRecipe(null)}
        />
      )}
    </section>
  );
}
