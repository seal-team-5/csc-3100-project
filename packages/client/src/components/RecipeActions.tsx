import { useState } from 'react';
import type { RecipeProgress } from '../lib/recipes';

export default function RecipeActions({
  recipeId,
  recipeName,
  favoriteIds,
  onFavoritesChange,
  onProgress,
}: {
  recipeId: string;
  recipeName: string;
  favoriteIds: string[];
  onFavoritesChange: (favorites: string[]) => void;
  // Omit to hide the progress buttons, like on the Favorites page
  onProgress?: (progress: RecipeProgress[]) => void;
}) {
  const [savingProgress, setSavingProgress] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [message, setMessage] = useState('');
  const isFavorite = favoriteIds.includes(recipeId);

  async function updateProgress(status: RecipeProgress['status']) {
    if (!onProgress) return;
    setSavingProgress(true);
    setMessage('');
    try {
      const response = await fetch('/api/recipe-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, recipeName, status }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Please log in to track recipe progress.'
            : 'Could not update recipe progress. Please try again.'
        );
      const data: { recipeProgress: RecipeProgress[] } = await response.json();
      onProgress(data.recipeProgress);
      setMessage(
        status === 'completed'
          ? 'Recipe marked completed.'
          : 'Recipe added to Active Recipes.'
      );
    } catch (cause) {
      setMessage(
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
    setMessage('');
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
      setMessage(
        isFavorite
          ? 'Recipe removed from favorites.'
          : 'Recipe saved to favorites.'
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Could not update favorites.'
      );
    } finally {
      setSavingFavorite(false);
    }
  }

  return (
    <div className="recipe-card-actions">
      <div className="recipe-progress-actions">
        {onProgress && (
          <>
            <button
              className="secondary-button"
              disabled={savingProgress}
              onClick={() => void updateProgress('in-progress')}
              type="button"
            >
              Mark In Progress
            </button>
            <button
              className="primary-button"
              disabled={savingProgress}
              onClick={() => void updateProgress('completed')}
              type="button"
            >
              Mark Completed
            </button>
          </>
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
      <p role="status" className="progress-message">
        {message}
      </p>
    </div>
  );
}
