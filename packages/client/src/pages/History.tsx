import { useEffect, useState } from 'react';

type RecipeProgress = {
  recipeName: string;
  status: 'in-progress' | 'completed';
  startedAt: string;
  completedAt?: string;
};

export default function History() {
  const [history, setHistory] = useState<RecipeProgress[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/recipe-progress')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Please log in to view your history.');
        }
        const data = await response.json();
        setHistory(data.recipeProgress);
      })
      .catch((err) => setError(err.message));
  }, []);

  const completed = history.filter((item) => item.status === 'completed');

  const groups = {
    Today: completed.filter(
      (item) =>
        item.completedAt &&
        new Date(item.completedAt).toDateString() === new Date().toDateString()
    ),
    'Earlier this week': completed.filter((item) => {
      if (!item.completedAt) return false;
      const date = new Date(item.completedAt);
      const daysAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo >= 1 && daysAgo < 7;
    }),
    Older: completed.filter((item) => {
      if (!item.completedAt) return false;
      const daysAgo =
        (Date.now() - new Date(item.completedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return daysAgo >= 7;
    }),
  };

  return (
    <section>
      <h1>Recipe History</h1>
      {error && <p role="alert">{error}</p>}
      {Object.entries(groups).map(([title, recipes]) => (
        <section key={title}>
          <h2>{title}</h2>
          {recipes.length === 0 ? (
            <p>No completed recipes.</p>
          ) : (
            <ul>
              {recipes.map((item, index) => (
                <li key={`${item.recipeName}-${index}`}>{item.recipeName}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}