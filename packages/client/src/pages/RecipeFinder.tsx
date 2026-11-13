import { useEffect, useMemo, useState } from 'react';
import RecipeCard from '../components/RecipeCard';
import RecipeDialog from '../components/RecipeDialog';
import { getRecipeResult, resultFor } from '../lib/recipes';
import type {
  RecipeFilter,
  RecipeProgress,
  RecipeResult,
  RecipeSummary,
} from '../lib/recipes';

type SummaryResponse = {
  recipes: RecipeSummary[];
  filterGroups: Record<string, string[]>;
};
const filterLabel = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1);

export default function RecipeFinder({ username }: { username?: string }) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [filterGroups, setFilterGroups] = useState<Record<string, string[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedFilters, setSelectedFilters] = useState<RecipeFilter[]>([]);
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [recipeResult, setRecipeResult] = useState<RecipeResult | null>(null);
  const [progress, setProgress] = useState<RecipeProgress[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    async function loadFavoriteIds() {
      const response = await fetch('/api/user');

      if (!response.ok) return;

      const data = await response.json();
      setFavoriteIds(data.user.favorites || []);
    }

    void loadFavoriteIds();
  }, []);

  useEffect(() => {
    async function loadPreferredFilters() {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) return; // guests or logged-out users: no preselection
        const data = await response.json();
        const saved: RecipeFilter[] = data.settings?.preferredFilters ?? [];
        // Don't override anything the user already toggled while this loaded.
        setSelectedFilters((current) => (current.length ? current : saved));
      } catch {
        /* preferences are optional */
      }
    }
    void loadPreferredFilters();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRecipes() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/recipes?view=summary', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error('Unable to load recipes. Please try again.');
        const data: SummaryResponse = await response.json();
        if (!controller.signal.aborted) {
          setRecipes(data.recipes);
          setFilterGroups(data.filterGroups);
        }
      } catch {
        if (!controller.signal.aborted) {
          setRecipes([]);
          setFilterGroups({});
          setError('Unable to load recipes. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRecipes();
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/recipe-progress', { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const data: { recipeProgress: RecipeProgress[] } =
            await response.json();
          if (!controller.signal.aborted) setProgress(data.recipeProgress);
        }
      })
      .catch(() => {
        /* Progress is optional; guests can browse recipes. */
      });
    return () => controller.abort();
  }, []);

  // A recipe matches if resultFor says so: cuisine filters are OR,
  // all other filter types are AND for now.

  const matches = useMemo(
    () =>
      recipes.filter((recipe) => resultFor(recipe, selectedFilters).exactMatch),
    [recipes, selectedFilters]
  );

  const activeRecipes = recipes.filter((recipe) =>
    progress.some(
      (item) => item.recipeName === recipe.name && item.status === 'in-progress'
    )
  );
  const toggleFilter = (filter: RecipeFilter) =>
    setSelectedFilters((current) =>
      current.some(
        (item) => item.type === filter.type && item.name === filter.name
      )
        ? current.filter(
            (item) => item.type !== filter.type || item.name !== filter.name
          )
        : [...current, filter]
    );
  const openRecipe = (recipe: RecipeSummary) =>
    setRecipeResult(resultFor(recipe, selectedFilters));
  const showRecipe = () => {
    const result = getRecipeResult(
      recipes,
      selectedFilters,
      recipeResult?.recipe.id
    );
    setRecipeResult(result);
    setHistoryError('');
    if (!result) return;
    void fetch('/api/recipe-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId: result.recipe.id }),
    })
      .then((response) => {
        if (response.status === 401) {
          setHistoryError('Sign in to save generated recipes to History.');
        } else if (!response.ok) {
          setHistoryError('This recipe could not be saved to History.');
        }
      })
      .catch(() =>
        setHistoryError('This recipe could not be saved to History.')
      );
  };

  return (
    <section className="home-page">
      {historyError && <p role="status">{historyError}</p>}
      <div className="home-intro">
        <h1>
          {username ? `Hello, ${username}!` : 'Find your next favorite recipe'}
        </h1>
        <button
          className="primary-button show-recipe-button"
          disabled={loading || !!error || !recipes.length}
          onClick={showRecipe}
          type="button"
        >
          Show me a recipe!
        </button>
      </div>
      <section className="filter-panel" aria-labelledby="filter-heading">
        <div className="filter-panel-header">
          <div>
            <h2 id="filter-heading">Preferences</h2>
            <p>Quickly update the filters that shape your recipe matches.</p>
          </div>
          {!!selectedFilters.length && (
            <button
              className="text-button"
              onClick={() => setSelectedFilters([])}
              type="button"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="filter-toolbar">
          <button
            className="filter-toggle"
            aria-expanded={expandedFilters}
            aria-controls="recipe-filter-options"
            onClick={() => setExpandedFilters((value) => !value)}
            disabled={loading || !!error || !recipes.length}
            type="button"
          >
            <img src="/design/filter.png" alt="" width="28" height="28" />
            {expandedFilters ? 'Hide filters' : 'Add Filter…'}
            {!!selectedFilters.length && (
              <span className="filter-count">{selectedFilters.length}</span>
            )}
          </button>
          {selectedFilters.map((filter) => (
            <button
              className="selected-filter"
              key={`${filter.type}-${filter.name}`}
              onClick={() => toggleFilter(filter)}
              aria-label={`Remove ${filter.type}: ${filter.name}`}
              type="button"
            >
              {filterLabel(filter.type)}: {filter.name}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
        <div
          className="filter-groups"
          id="recipe-filter-options"
          hidden={!expandedFilters}
        >
          {Object.entries(filterGroups).map(([type, names]) => (
            <fieldset className="filter-group" key={type}>
              <legend>{filterLabel(type)}</legend>
              <div className="filter-options">
                {names.map((name) => {
                  const selected = selectedFilters.some(
                    (filter) => filter.type === type && filter.name === name
                  );
                  return (
                    <label
                      className={`filter-pill ${selected ? 'selected' : ''}`}
                      key={name}
                    >
                      <input
                        checked={selected}
                        onChange={() => toggleFilter({ type, name })}
                        type="checkbox"
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </section>
      {loading && (
        <p role="status" className="recipe-state">
          Loading recipes…
        </p>
      )}
      {error && (
        <div role="alert" className="recipe-state">
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
        <>
          {activeRecipes.length > 0 && (
            <section
              className="recipe-section"
              aria-labelledby="active-recipes-heading"
            >
              <div className="recipe-section-heading">
                <h2 id="active-recipes-heading">Active Recipes</h2>
                <span>
                  {activeRecipes.length}{' '}
                  {activeRecipes.length === 1 ? 'recipe' : 'recipes'}
                </span>
              </div>
              <div className="recipe-grid">
                {activeRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onOpen={openRecipe}
                  />
                ))}
              </div>
            </section>
          )}
          <section
            className="recipe-section"
            aria-labelledby="recipe-grid-heading"
          >
            <div className="recipe-section-heading">
              <h2 id="recipe-grid-heading">
                {selectedFilters.length
                  ? 'Matching Recipes'
                  : 'Discover Recipes'}
              </h2>
              <span role="status">
                {matches.length} {matches.length === 1 ? 'recipe' : 'recipes'}
              </span>
            </div>
            {!recipes.length ? (
              <p className="recipe-state">No recipes are available yet.</p>
            ) : !matches.length ? (
              <div className="recipe-state">
                <p>
                  No recipes match every filter. Clear a filter to browse more,
                  or choose “Show me a recipe” for the closest match.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedFilters([])}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="recipe-grid">
                {matches.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onOpen={openRecipe}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {recipeResult && (
        <RecipeDialog
          result={recipeResult}
          onClose={() => setRecipeResult(null)}
          onRegenerate={showRecipe}
          onProgress={setProgress}
          favoriteIds={favoriteIds}
          onFavoritesChange={setFavoriteIds}
        />
      )}
    </section>
  );
}
