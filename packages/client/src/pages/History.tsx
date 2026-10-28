import { useEffect, useRef, useState } from 'react';
import RecipeReview from './RecipeReview';

type HistoryEntry = {
  recipeId?: string;
  recipeName: string;
  status: 'in-progress' | 'completed';
  startedAt: string;
  completedAt?: string;
};

export default function History() {
  const reviewPanel = useRef<HTMLElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/recipe-progress', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? 'Please log in to view your history.'
              : result.error || 'Unable to load history.'
          );
        if (!controller.signal.aborted) {
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

  // Keep the opened form visible, including in a long history list.
  useEffect(() => {
    if (!selected) return;
    reviewPanel.current?.focus({ preventScroll: true });
    reviewPanel.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

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
          <section key={title}>
            <h2>{title}</h2>
            {recipes.length === 0 ? (
              <p>No completed recipes.</p>
            ) : (
              <ul>
                {recipes.map((item, index) => (
                  <li
                    className="history-recipe"
                    key={`${item.recipeId || item.recipeName}-${index}`}
                  >
                    <span>{item.recipeName}</span>
                    {item.recipeId ? (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() =>
                          setSelected({
                            id: item.recipeId!,
                            name: item.recipeName,
                          })
                        }
                      >
                        Review recipe
                      </button>
                    ) : (
                      <p>
                        This recipe is no longer available or cannot be
                        identified uniquely.
                      </p>
                    )}
                    {selected && selected.id === item.recipeId && (
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
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
    </section>
  );
}
