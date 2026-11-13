import { useState } from 'react';
import type { RecipeProgress } from '../lib/recipes';

export default function RecipeActions({
  recipeId,
  recipeName,
  favoriteIds,
  onFavoritesChange,
  progress = [],
  onProgress,
  onMessage,
}: {
  recipeId: string;
  recipeName: string;
  favoriteIds: string[];
  onFavoritesChange: (favorites: string[]) => void;
  /** The user's current progress entries, used to pick the right button. */
  progress?: RecipeProgress[];
  /** Omit to hide the progress button (e.g. on the Favorites page). */
  onProgress?: (progress: RecipeProgress[]) => void;
  /** Receives status text such as "Recipe saved to favorites." */
  onMessage: (message: string) => void;
}) {
  const [savingProgress, setSavingProgress] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const isFavorite = favoriteIds.includes(recipeId);
  const status = progress.find((item) => item.recipeId === recipeId)?.status;

  type StatusChoice = RecipeProgress['status'] | 'none';

  // Saves the status picked in the dropdown. "none" removes the progress entry.
  async function changeStatus(next: StatusChoice) {
    if (!onProgress) return;
    setSavingProgress(true);
    onMessage('');
    try {
      const response = await fetch(
        next === 'none'
          ? `/api/recipe-progress/${encodeURIComponent(recipeId)}`
          : '/api/recipe-progress',
        next === 'none'
          ? { method: 'DELETE' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipeId, recipeName, status: next }),
            }
      );
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Please log in to track recipe progress.'
            : 'Could not update recipe progress. Please try again.'
        );
      const data: { recipeProgress: RecipeProgress[] } = await response.json();
      onProgress(data.recipeProgress);
      onMessage(
        next === 'completed'
          ? 'Recipe marked completed.'
          : next === 'in-progress'
            ? 'Recipe added to Active Recipes.'
            : 'Recipe removed from your progress.'
      );
    } catch (cause) {
      onMessage(
        cause instanceof Error
          ? cause.message
          : 'Could not update recipe progress.'
      );
    } finally {
      setSavingProgress(false);
    }
  }

  async function toggleFavorite() {
    setSavingFavorite(true);
    onMessage('');
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Please log in to save favorite recipes.'
            : 'Could not update favorites. Please try again.'
        );
      const data: { favorites: string[] } = await response.json();
      onFavoritesChange(data.favorites);
      onMessage(
        isFavorite
          ? 'Recipe removed from favorites.'
          : 'Recipe saved to favorites.'
      );
    } catch (cause) {
      onMessage(
        cause instanceof Error ? cause.message : 'Could not update favorites.'
      );
    } finally {
      setSavingFavorite(false);
    }
  }

  return (
    <div className="recipe-dialog-actions">
      <div className="recipe-progress-actions">
        {onProgress && (
          <label className="status-select">
            <span>Status</span>
            <select
              disabled={savingProgress}
              value={status ?? 'none'}
              onChange={(event) =>
                void changeStatus(event.target.value as StatusChoice)
              }
            >
              <option value="none">Not started</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        )}
        <button
          className="secondary-button"
          disabled={savingFavorite}
          aria-pressed={isFavorite}
          onClick={() => void toggleFavorite()}
          type="button"
        >
          {isFavorite ? 'Unfavorite' : 'Favorite'}
        </button>
      </div>
    </div>
  );
}
