import { useEffect, useState } from 'react';
import type { RecipeResult, RecipeSummary } from '../lib/recipes';
import RecipeCard from '../components/RecipeCard';
import RecipeDialog from '../components/RecipeDialog';

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

  useEffect(() => {
    async function loadFavorites() {
      try {
        const userResponse = await fetch('/api/user');
        const recipesResponse = await fetch('/api/recipes');

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

  const favoriteRecipes = recipes.filter((recipe) =>
    favoriteIds.includes(recipe.id)
  );

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
          />
        ))}
      </div>

      {dialogResult && (
        <RecipeDialog
          result={dialogResult}
          onClose={() => setSelectedRecipe(null)}
          onRegenerate={() => setSelectedRecipe(null)}
          onProgress={() => {}}
          favoriteIds={favoriteIds}
          onFavoritesChange={setFavoriteIds}
        />
      )}
    </section>
  );
}
