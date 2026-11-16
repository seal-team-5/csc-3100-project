import { useEffect, useState } from 'react';

type RecipeProgress = {
  recipeName: string;
  status: 'in-progress' | 'completed';
};

type Recipe = {
  name: string;
  ingredients: string[];
};

type RecipeGroup = {
  name: string;
  ingredients: string[];
};

export default function GroceryList() {
  const [recipeGroups, setRecipeGroups] = useState<RecipeGroup[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function loadGroceryList() {
      setLoading(true);
      setError('');

      try {
        const [progressResponse, recipesResponse] = await Promise.all([
          fetch('/api/recipe-progress'),
          fetch('/api/recipes'),
        ]);

        if (!progressResponse.ok || !recipesResponse.ok) {
          throw new Error('Could not load your grocery list.');
        }

        const progressData: { recipeProgress: RecipeProgress[] } =
          await progressResponse.json();
        const recipesData = await recipesResponse.json();

        const inProgressNames = new Set(
          progressData.recipeProgress
            .filter((item) => item.status === 'in-progress')
            .map((item) => item.recipeName)
        );

        const allRecipes: Recipe[] = recipesData.recipes ?? recipesData;

        const groups: RecipeGroup[] = allRecipes
          .filter((recipe) => inProgressNames.has(recipe.name))
          .map((recipe) => ({
            name: recipe.name,
            ingredients: [
              ...new Set(
                (recipe.ingredients ?? [])
                  .map((ingredient) => ingredient.trim())
                  .filter(Boolean)
              ),
            ],
          }))
          .filter((recipe) => recipe.ingredients.length > 0);

        setRecipeGroups(groups);
        setChecked([]);
      } catch {
        setError('Could not load your grocery list. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadGroceryList();
  }, [reload]);

  function getIngredientId(recipeName: string, ingredient: string) {
    return `${recipeName}::${ingredient}`;
  }

  function toggleIngredient(recipeName: string, ingredient: string) {
    const id = getIngredientId(recipeName, ingredient);

    setChecked((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  const totalIngredients = recipeGroups.reduce(
    (total, recipe) => total + recipe.ingredients.length,
    0
  );

  const remaining = totalIngredients - checked.length;

  const progress = totalIngredients
    ? (checked.length / totalIngredients) * 100
    : 0;

  return (
    <section className="home-page">
      <div className="home-intro">
        <h1>Grocery List</h1>
        <p>Everything you need for your in-progress recipes.</p>
      </div>

      {loading && (
        <p className="recipe-state" role="status">
          Loading your grocery list…
        </p>
      )}

      {error && (
        <div className="recipe-state" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => setReload((value) => value + 1)}
            type="button"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <section className="recipe-section" aria-labelledby="grocery-heading">
          <div className="recipe-section-heading">
            <h2 id="grocery-heading">Your Ingredients</h2>
            <span>
              {totalIngredients} {totalIngredients === 1 ? 'item' : 'items'}
            </span>
          </div>

          {recipeGroups.length === 0 ? (
            <p className="recipe-state">
              No ingredients yet. Mark a recipe as in progress to start your
              grocery list!
            </p>
          ) : (
            <>
              <div className="grocery-progress">
                <div className="grocery-progress-label">
                  <span>{checked.length} completed</span>
                  <span>{remaining} remaining</span>
                </div>

                <div
                  className="grocery-progress-track"
                  role="progressbar"
                  aria-label="Grocery list completion"
                  aria-valuenow={checked.length}
                  aria-valuemin={0}
                  aria-valuemax={totalIngredients}
                >
                  <div
                    className="grocery-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {recipeGroups.map((recipe) => (
                <div className="grocery-recipe-group" key={recipe.name}>
                  <h3>{recipe.name}</h3>

                  <ul className="grocery-items">
                    {recipe.ingredients.map((ingredient) => {
                      const id = getIngredientId(recipe.name, ingredient);
                      const isChecked = checked.includes(id);

                      return (
                        <li className="grocery-item" key={id}>
                          <label className={isChecked ? 'checked' : ''}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                toggleIngredient(recipe.name, ingredient)
                              }
                            />
                            <span>{ingredient}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {checked.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => setChecked([])}
                  type="button"
                >
                  Uncheck all
                </button>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
