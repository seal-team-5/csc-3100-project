import { useEffect, useRef, useState } from 'react';
import type { Recipe, RecipeProgress, RecipeResult } from '../lib/recipes';
import RecipeReview from '../pages/RecipeReview';
import { RecipeImage } from './RecipeCard';

export default function RecipeDialog({
  result,
  onClose,
  onRegenerate,
  onProgress,
  favoriteIds = [],
  onFavoritesChange,
}: {
  result: RecipeResult;
  onClose: () => void;
  onRegenerate: () => void;
  onProgress: (progress: RecipeProgress[]) => void;
  favoriteIds?: string[];
  onFavoritesChange: (favorites: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [loaded, setLoaded] = useState<{
    id: string;
    retry: number;
    recipe: Recipe | null;
    error: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [progressFeedback, setProgressFeedback] = useState({
    id: '',
    text: '',
  });
  const { id } = result.recipe;
  const [savingFavorite, setSavingFavorite] = useState(false);
  const isFavorite = favoriteIds.includes(id);
  const loading = loaded?.id !== id || loaded.retry !== retry;
  const detail = loading ? null : loaded.recipe;
  const error = loading ? '' : loaded.error;
  const progressMessage =
    progressFeedback.id === id ? progressFeedback.text : '';
  const setProgressMessage = (text: string) =>
    setProgressFeedback({ id, text });

  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'This recipe is no longer available. Try another recipe.'
              : 'Unable to load this recipe. Please try again.'
          );
        const data: { recipe: Recipe } = await response.json();
        if (!controller.signal.aborted)
          setLoaded({ id, retry, recipe: data.recipe, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted)
          setLoaded({
            id,
            retry,
            recipe: null,
            error:
              cause instanceof Error
                ? cause.message
                : 'Unable to load this recipe.',
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);

  async function updateProgress(status: RecipeProgress['status']) {
    if (!detail) return;
    setSaving(true);
    setProgressMessage('');
    try {
      const response = await fetch('/api/recipe-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeName: detail.name, status }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Please log in to track recipe progress.'
            : 'Could not update recipe progress. Please try again.'
        );
      const data: { recipeProgress: RecipeProgress[] } = await response.json();
      onProgress(data.recipeProgress);
      setProgressMessage(
        status === 'completed'
          ? 'Recipe marked completed.'
          : 'Recipe added to Active Recipes.'
      );
    } catch (cause) {
      setProgressMessage(
        cause instanceof Error
          ? cause.message
          : 'Could not update recipe progress.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite() {
    setSavingFavorite(true);
    setProgressMessage('');

    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: id }),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Please log in to save favorite recipes.'
            : 'Could not update favorites. Please try again.'
        );
      }

      const data: { favorites: string[] } = await response.json();
      onFavoritesChange(data.favorites);

      setProgressMessage(
        isFavorite
          ? 'Recipe removed from favorites.'
          : 'Recipe saved to favorites.'
      );
    } catch (cause) {
      setProgressMessage(
        cause instanceof Error ? cause.message : 'Could not update favorites.'
      );
    } finally {
      setSavingFavorite(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="recipe-modal"
      aria-labelledby="recipe-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
          )
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="recipe-dialog-card">
        <div className="recipe-banner">
          <RecipeImage
            key={id}
            loading="eager"
            image={result.recipe.image}
            name={result.recipe.name}
          />
          <button
            autoFocus
            aria-label="Close recipe"
            className="close-button"
            onClick={onClose}
            type="button"
          >
            <img src="/design/close.svg" alt="" width="14" height="14" />
          </button>
        </div>
        <div className="recipe-content" aria-busy={loading}>
          <header>
            <p
              className={`match-note ${result.exactMatch ? '' : 'closest-match'}`}
            >
              {result.exactMatch ? 'Matches your filters' : 'Closest match'}
            </p>
            <h2 id="recipe-title">{result.recipe.name}</h2>
            {!result.exactMatch && (
              <p className="similar-note">
                This recipe does not match:{' '}
                {result.changedFilters
                  .map((filter) => `${filter.type}: ${filter.name}`)
                  .join(', ')}
                .
              </p>
            )}
            <div className="recipe-tags">
              {result.recipe.filters.map((filter) => (
                <span key={`${filter.type}-${filter.name}`}>{filter.name}</span>
              ))}
            </div>
          </header>
          {loading && <p role="status">Loading ingredients and directions…</p>}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                className="secondary-button"
                onClick={() => setRetry((value) => value + 1)}
                type="button"
              >
                Retry
              </button>
            </div>
          )}
          {detail && (
            <>
              <section className="recipe-detail-section">
                <h3>Ingredients</h3>
                <ul>
                  {detail.ingredients.map((ingredient, index) => (
                    <li key={index}>{ingredient}</li>
                  ))}
                </ul>
              </section>
              <section className="recipe-detail-section">
                <h3>Directions</h3>
                <ol>
                  {detail.instructions.map((step, index) => (
                    <li key={index}>
                      <span className="step-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="recipe-detail-section">
                <RecipeReview key={id} recipeName={detail.name} />
              </section>
              <section className="recipe-detail-section">
                <div className="recipe-progress-actions">
                  <button
                    className="secondary-button"
                    disabled={saving}
                    onClick={() => void updateProgress('in-progress')}
                    type="button"
                  >
                    Mark In Progress
                  </button>
                  <button
                    className="primary-button"
                    disabled={saving}
                    onClick={() => void updateProgress('completed')}
                    type="button"
                  >
                    Mark Completed
                  </button>
                  <button
                    className="secondary-button"
                    disabled={savingFavorite}
                    onClick={() => void toggleFavorite()}
                    type="button"
                  >
                    {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  </button>
                </div>
                <p role="status" className="progress-message">
                  {progressMessage}
                </p>
              </section>
            </>
          )}
          <button
            className="regenerate-button secondary-button"
            onClick={onRegenerate}
            disabled={saving}
            type="button"
          >
            Show me another recipe
          </button>
        </div>
      </article>
    </dialog>
  );
}
