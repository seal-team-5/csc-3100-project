import { LOGIN_REQUIRED } from '../lib/auth';
import { useEffect, useRef, useState } from 'react';
import RecipeReview from './RecipeReview';
import RecipeCard from '../components/RecipeCard';
import RecipeDialog from '../components/RecipeDialog';
import type { RecipeSummary } from '../lib/recipes';

type GeneratedRecipe = {
  recipeId: string;
  recipeName: string;
  image: string;
  generatedAt: string;
};

type HistoryEntry = {
  recipeId?: string;
  recipeName: string;
  status: 'in-progress' | 'completed';
  startedAt: string;
  completedAt?: string;
};

export default function History() {
  const suggestionGrid = useRef<HTMLDivElement>(null);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [suggestionsPerRow, setSuggestionsPerRow] = useState(1);
  const [generated, setGenerated] = useState<GeneratedRecipe[]>([]);
  const [openedRecipe, setOpenedRecipe] = useState<RecipeSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [generatedError, setGeneratedError] = useState('');
  const [generatedLoading, setGeneratedLoading] = useState(true);
  const reviewPanel = useRef<HTMLElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recipeSummaries, setRecipeSummaries] = useState<RecipeSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/recipe-progress', {
        signal: controller.signal,
        cache: 'no-store',
      }),
      fetch('/api/recipes?view=summary', {
        signal: controller.signal,
        cache: 'no-store',
      }),
    ])
      .then(async ([response, summariesResponse]) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? LOGIN_REQUIRED
              : result.error || 'Unable to load history.'
          );
        if (!summariesResponse.ok)
          throw new Error('Unable to load recipe cards. Please try again.');
        const summaries: { recipes: RecipeSummary[] } =
          await summariesResponse.json();
        if (!controller.signal.aborted) {
          setRecipeSummaries(summaries.recipes);
          setHistory(result.recipeProgress);
          setError('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : 'Unable to load history.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/recipe-history', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? LOGIN_REQUIRED
              : 'Unable to load generated recipes.'
          );
        const data = await response.json();
        if (!controller.signal.aborted) {
          setGenerated(data.generatedRecipes);
          setGeneratedError('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setGeneratedError(
            error instanceof Error
              ? error.message
              : 'Unable to load generated recipes.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setGeneratedLoading(false);
      });
    fetch('/api/user', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted)
          setFavoriteIds(data.user.favorites || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [attempt]);

  // Match the collapsed list to one row at the current screen width.
  useEffect(() => {
    const grid = suggestionGrid.current;
    if (!grid) return;
    const updateRowSize = () => {
      const columns = getComputedStyle(grid).gridTemplateColumns;
      setSuggestionsPerRow(
        columns === 'none' ? 1 : columns.split(/\s+/).length
      );
    };
    const observer = new ResizeObserver(updateRowSize);
    observer.observe(grid);
    updateRowSize();
    return () => observer.disconnect();
  }, [generatedLoading, generatedError, generated.length]);

  // Keep the opened form visible, including in a long history list.
  useEffect(() => {
    if (!selected) return;
    reviewPanel.current?.focus({ preventScroll: true });
    reviewPanel.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const recipesById = new Map(
    recipeSummaries.map((recipe) => [recipe.id, recipe])
  );

  const groups: Record<string, HistoryEntry[]> = {
    Today: [],
    'Earlier this week': [],
    Older: [],
  };
  for (const entry of history.filter((item) => item.status === 'completed')) {
    const completed = entry.completedAt ? new Date(entry.completedAt) : null;
    if (!completed || Number.isNaN(completed.getTime())) {
      groups.Older.push(entry);
      continue;
    }
    const daysAgo = (today.getTime() - completed.getTime()) / 86400000;
    const group =
      completed.toDateString() === today.toDateString()
        ? 'Today'
        : daysAgo >= 0 && daysAgo < 7
          ? 'Earlier this week'
          : 'Older';
    groups[group].push(entry);
  }

  return (
    <section>
      <h1>Recipe History</h1>
      {openedRecipe && (
        <RecipeDialog
          result={{
            recipe: openedRecipe,
            exactMatch: true,
            changedFilters: [],
          }}
          onClose={() => setOpenedRecipe(null)}
          onRegenerate={() => setOpenedRecipe(null)}
          progress={history}
          onProgress={setHistory}
          favoriteIds={favoriteIds}
          onFavoritesChange={setFavoriteIds}
          showRegenerate={false}
        />
      )}
      <h2>Completed recipes</h2>
      {loading && <p role="status">Loading history…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Retry history
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        Object.entries(groups).map(([title, recipes]) => (
          <section className="recipe-section" key={title}>
            <h2>{title}</h2>
            {recipes.length === 0 ? (
              <p>No completed recipes.</p>
            ) : (
              <div className="recipe-grid">
                {recipes.map((item, index) => {
                  const recipe = item.recipeId
                    ? recipesById.get(item.recipeId)
                    : undefined;
                  return (
                    <div
                      className="history-recipe"
                      key={`${item.recipeId || item.recipeName}-${index}`}
                    >
                      {recipe ? (
                        <RecipeCard recipe={recipe} onOpen={setOpenedRecipe} />
                      ) : (
                        <article className="recipe-card history-unavailable">
                          <h3>{item.recipeName}</h3>
                          <p>
                            This recipe is no longer available or cannot be
                            identified uniquely.
                          </p>
                        </article>
                      )}
                      {item.completedAt &&
                        !Number.isNaN(new Date(item.completedAt).getTime()) && (
                          <p className="history-completed-date">
                            Completed{' '}
                            <time dateTime={item.completedAt}>
                              {new Date(item.completedAt).toLocaleDateString()}
                            </time>
                          </p>
                        )}
                      {recipe && (
                        <button
                          className="secondary-button"
                          type="button"
                          aria-expanded={selected?.id === recipe.id}
                          onClick={() =>
                            setSelected((current) =>
                              current?.id === recipe.id
                                ? null
                                : {
                                    id: recipe.id,
                                    name: recipe.name,
                                  }
                            )
                          }
                        >
                          Review recipe
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      {selected && (
        <section
          ref={reviewPanel}
          tabIndex={-1}
          className="history-review"
          aria-label="Review a past recipe"
        >
          <button
            type="button"
            className="text-button"
            onClick={() => setSelected(null)}
          >
            Close review
          </button>
          <h2>{selected.name}</h2>
          <RecipeReview
            initiallyOpen
            key={selected.id}
            recipeId={selected.id}
            recipeName={selected.name}
          />
        </section>
      )}
      <section
        className="recipe-section"
        aria-labelledby="generated-recipes-heading"
      >
        <h2 id="generated-recipes-heading">Previously generated recipes</h2>
        <p>Your latest 100 recipe suggestions, newest first.</p>
        {generatedLoading && <p role="status">Loading generated recipes…</p>}
        {generatedError && (
          <div role="alert">
            <p>{generatedError}</p>
            <button
              type="button"
              onClick={() => {
                setGeneratedLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              Retry generated recipes
            </button>
          </div>
        )}
        {!generatedLoading &&
          !generatedError &&
          (generated.length ? (
            <>
              <div
                className="recipe-grid"
                id="generated-recipe-list"
                ref={suggestionGrid}
              >
                {(suggestionsExpanded
                  ? generated
                  : generated.slice(0, suggestionsPerRow)
                ).map((item, index) => (
                  <RecipeCard
                    key={item.recipeId + '-' + index}
                    recipe={
                      recipesById.get(item.recipeId) ?? {
                        id: item.recipeId,
                        name: item.recipeName,
                        image: item.image,
                        filters: [],
                      }
                    }
                    onOpen={setOpenedRecipe}
                  />
                ))}
              </div>
              {generated.length > suggestionsPerRow && (
                <button
                  className="secondary-button history-suggestions-toggle"
                  type="button"
                  aria-expanded={suggestionsExpanded}
                  aria-controls="generated-recipe-list"
                  onClick={() => setSuggestionsExpanded((value) => !value)}
                >
                  {suggestionsExpanded
                    ? 'Show fewer recipes'
                    : 'Show all recipe suggestions'}
                </button>
              )}
            </>
          ) : (
            <p>
              No generated recipes yet. Choose “Show me a recipe!” on Home to
              get started.
            </p>
          ))}
      </section>
    </section>
  );
}
