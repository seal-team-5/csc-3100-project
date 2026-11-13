
import { useEffect, useState } from 'react';

type RecipeProgress = {
  recipeName: string;
  status: 'in-progress' | 'completed';
};

type Recipe = {
  name: string;
  ingredients: string[];
};

export default function GroceryList() {
  const [ingredients, setIngredients] = useState<string[]>([]);
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

        const groceryItems = [
          ...new Set(
            allRecipes
              .filter((recipe) => inProgressNames.has(recipe.name))
              .flatMap((recipe) => recipe.ingredients ?? [])
              .map((ingredient) => ingredient.trim())
              .filter(Boolean)
          ),
        ];

        setIngredients(groceryItems);
        setChecked([]);
      } catch {
        setError('Could not load your grocery list. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadGroceryList();
  }, [reload]);

  function toggleIngredient(ingredient: string) {
    setChecked((previous) =>
      previous.includes(ingredient)
        ? previous.filter((item) => item !== ingredient)
        : [...previous, ingredient]
    );
  }

  const remaining = ingredients.length - checked.length;
  const progress = ingredients.length
    ? (checked.length / ingredients.length) * 100
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
              {ingredients.length} {ingredients.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {ingredients.length === 0 ? (
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
                  aria-valuemax={ingredients.length}
                >
                  <div
                    className="grocery-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <ul className="grocery-items">
                {ingredients.map((ingredient) => {
                  const isChecked = checked.includes(ingredient);

                  return (
                    <li className="grocery-item" key={ingredient}>
                      <label className={isChecked ? 'checked' : ''}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleIngredient(ingredient)}
                        />
                        <span>{ingredient}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>

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
