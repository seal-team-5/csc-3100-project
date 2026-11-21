import { LOGIN_REQUIRED } from '../lib/auth';
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import './RecipeReview.css';

type SavedReview = {
  username: string;
  rating: number;
  note: string;
  createdAt: string;
  isOwn: boolean;
};
type ReviewResponse = {
  reviews: SavedReview[];
  reviewCount: number;
  averageRating: number | null;
};

export default function RecipeReview({
  recipeId,
  recipeName,
  initiallyOpen = false,
}: {
  recipeId: string;
  recipeName?: string;
  initiallyOpen?: boolean;
}) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Reload after saving and when this component opens for a recipe.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/recipes/${encodeURIComponent(recipeId)}/reviews`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || 'Unable to load reviews.');
        if (controller.signal.aborted) return;
        setData(result);
        const ownReview = (result as ReviewResponse).reviews.find(
          (review) => review.isOwn
        );
        setRating(ownReview?.rating ?? 5);
        setNote(ownReview?.note ?? '');
        setLoadError('');
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : 'Unable to load reviews.'
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [recipeId, attempt]);

  function reloadReviews() {
    setLoading(true);
    setLoadError('');
    setAttempt((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading) return;
    setSaving(true);
    setMessage('');
    setSaveError('');
    try {
      const response = await fetch(
        `/api/recipes/${encodeURIComponent(recipeId)}/reviews`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, note: note.trim() }),
        }
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? LOGIN_REQUIRED
            : result.error || 'Unable to save your review.'
        );
      setMessage('Review saved.');
      setIsOpen(false);
      reloadReviews();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Unable to save your review.'
      );
    } finally {
      setSaving(false);
    }
  }

  const hasOwnReview = data?.reviews.some((review) => review.isOwn);
  return (
    <section aria-label={`Reviews${recipeName ? ` for ${recipeName}` : ''}`}>
      <h3>Reviews and ratings</h3>
      {loading && <p role="status">Loading reviews…</p>}
      {loadError && (
        <div role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={reloadReviews}
          >
            Retry loading reviews
          </button>
        </div>
      )}
      {!loading && !loadError && data && (
        <>
          <p className="review-average">
            {data.averageRating === null
              ? 'No ratings yet.'
              : `${data.averageRating}/5 · ${data.reviewCount} ${data.reviewCount === 1 ? 'review' : 'reviews'}`}
          </p>
          {data.reviews.length > 0 && (
            <ul className="review-list">
              {data.reviews.map((review, index) => (
                <li key={`${review.createdAt}-${index}`}>
                  <strong>
                    {review.username}
                    {review.isOwn ? ' (you)' : ''}
                  </strong>
                  <p aria-label={`${review.rating} out of 5 stars`}>
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)} · {review.rating}/5
                  </p>
                  {review.note && <p className="review-note">{review.note}</p>}
                  <time dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <button
        className="secondary-button"
        type="button"
        disabled={loading || saving}
        aria-expanded={isOpen}
        aria-controls={`${formId}-form`}
        onClick={() => {
          setIsOpen((open) => !open);
          setSaveError('');
          setMessage('');
        }}
      >
        {hasOwnReview ? 'Edit your review' : 'Write a review'}
      </button>
      {isOpen && (
        <form
          id={`${formId}-form`}
          className="review-form"
          onSubmit={handleSubmit}
          aria-busy={saving}
        >
          <h4>{hasOwnReview ? 'Edit your review' : 'Review this recipe'}</h4>
          {recipeName && <p>{recipeName}</p>}
          <fieldset className="review-rating" disabled={saving || loading}>
            <legend>Your rating out of 5</legend>
            <div className="review-stars">
              {[1, 2, 3, 4, 5].map((score) => (
                <label className="review-star" key={score}>
                  <input
                    type="radio"
                    name={`${formId}-rating`}
                    value={score}
                    checked={rating === score}
                    onChange={() => setRating(score)}
                    aria-label={`${score} ${score === 1 ? 'star' : 'stars'}`}
                  />
                  <img
                    src={
                      score <= rating
                        ? '/design/star-filled.png'
                        : '/design/star-empty.png'
                    }
                    width="38"
                    height="38"
                    alt=""
                  />
                </label>
              ))}
              <span>{rating}/5</span>
            </div>
          </fieldset>
          <label htmlFor={`${formId}-note`}>Review note (optional)</label>
          <textarea
            id={`${formId}-note`}
            rows={4}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={saving || loading}
          />
          {saveError && <p role="alert">{saveError}</p>}
          <button
            className="primary-button"
            type="submit"
            disabled={saving || loading}
          >
            {saving ? 'Saving…' : 'Submit review'}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={saving}
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
