import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

type RecipeFilter = {
  name: string;
  type: string;
};

type Recipe = {
  image: string;
  name: string;
  ingredients: string[];
  instructions: string[];
  filters: RecipeFilter[];
};

type RecipeResult = {
  recipe: Recipe;
  exactMatch: boolean;
  changedFilters: RecipeFilter[];
};

function getFilterGroups(recipes: Recipe[]) {
  const groups = recipes.reduce<Record<string, string[]>>((groups, recipe) => {
    recipe.filters.forEach((filter) => {
      groups[filter.type] = groups[filter.type] || [];
      if (!groups[filter.type].includes(filter.name)) {
        groups[filter.type].push(filter.name);
      }
    });
    return groups;
  }, {});

  Object.values(groups).forEach((filters) => filters.sort());
  return groups;
}

const randomFrom = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

function filterMatches(recipe: Recipe, selectedFilter: RecipeFilter) {
  return recipe.filters.some(
    (filter) =>
      filter.type === selectedFilter.type && filter.name === selectedFilter.name
  );
}

function getRecipeResult(
  recipes: Recipe[],
  selectedFilters: RecipeFilter[]
): RecipeResult | null {
  if (recipes.length === 0) return null;

  if (selectedFilters.length === 0) {
    return {
      recipe: randomFrom(recipes),
      exactMatch: true,
      changedFilters: [],
    };
  }

  const matchingRecipes = recipes.filter((recipe) =>
    selectedFilters.every((filter) => filterMatches(recipe, filter))
  );

  if (matchingRecipes.length > 0) {
    return {
      recipe: randomFrom(matchingRecipes),
      exactMatch: true,
      changedFilters: [],
    };
  }

  const rankedRecipes = recipes
    .map((recipe) => ({
      recipe,
      exactMatch: false,
      changedFilters: selectedFilters.filter(
        (filter) => !filterMatches(recipe, filter)
      ),
    }))
    .sort((a, b) => a.changedFilters.length - b.changedFilters.length);

  const oneOrTwoChanged = rankedRecipes.filter(
    (result) =>
      result.changedFilters.length >= 1 && result.changedFilters.length <= 2
  );
  const fallbackPool =
    oneOrTwoChanged.length > 0 ? oneOrTwoChanged : rankedRecipes;
  const closestChangeCount = fallbackPool[0].changedFilters.length;
  const closestRecipes = fallbackPool.filter(
    (result) => result.changedFilters.length === closestChangeCount
  );

  return randomFrom(closestRecipes);
}

function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const filterGroups = getFilterGroups(recipes);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecipes() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/recipes', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Unable to load recipes. Please try again.');
        }
        const data: { recipes: Recipe[] } = await response.json();
        if (!controller.signal.aborted) setRecipes(data.recipes);
      } catch {
        if (!controller.signal.aborted) {
          setRecipes([]);
          setError('Unable to load recipes. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRecipes();
    return () => controller.abort();
  }, [reload]);

  const [selectedFilters, setSelectedFilters] = useState<RecipeFilter[]>([]);
  const [recipeResult, setRecipeResult] = useState<RecipeResult | null>(null);

  const toggleFilter = (filter: RecipeFilter) => {
    setSelectedFilters((currentFilters) => {
      const isSelected = currentFilters.some(
        (selected) =>
          selected.type === filter.type && selected.name === filter.name
      );

      if (isSelected) {
        return currentFilters.filter(
          (selected) =>
            selected.type !== filter.type || selected.name !== filter.name
        );
      }

      return [...currentFilters, filter];
    });
  };

  const showRecipe = () => {
    setRecipeResult(getRecipeResult(recipes, selectedFilters));
  };

  return (
    <section className="home-page">
      <div className="home-intro">
        <p className="eyebrow">RecipeMe</p>
        <h1>Find a recipe that fits the way you want to eat.</h1>
        <p>
          Choose filters by type, then RecipeMe will pick a random recipe that
          matches them. If there is not an exact match, it will suggest the
          closest recipe instead.
        </p>
      </div>

      <section className="filter-panel" aria-labelledby="filter-heading">
        <div className="filter-panel-header">
          <div>
            <h2 id="filter-heading">Filters</h2>
            <p>Mix and match options from each filter type.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => setSelectedFilters([])}
            type="button"
          >
            Clear
          </button>
        </div>

        {loading && <p role="status">Loading recipes…</p>}
        {error && (
          <div role="alert">
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
        {!loading && !error && recipes.length === 0 && (
          <p role="status">No recipes are available yet.</p>
        )}

        <div className="filter-groups">
          {Object.entries(filterGroups).map(([type, filters]) => (
            <fieldset className="filter-group" key={type}>
              <legend>{type}</legend>
              <div className="filter-options">
                {filters.map((name) => {
                  const isSelected = selectedFilters.some(
                    (filter) => filter.type === type && filter.name === name
                  );

                  return (
                    <label
                      className={`filter-pill ${isSelected ? 'selected' : ''}`}
                      key={`${type}-${name}`}
                    >
                      <input
                        checked={isSelected}
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

        <button
          className="primary-button"
          disabled={loading || !!error || recipes.length === 0}
          onClick={showRecipe}
          type="button"
        >
          Show me a recipe
        </button>
      </section>

      {recipeResult && (
        <div className="modal-backdrop">
          <article
            aria-labelledby="recipe-title"
            aria-modal="true"
            className="recipe-modal"
            role="dialog"
          >
            <button
              aria-label="Close recipe"
              className="close-button"
              onClick={() => setRecipeResult(null)}
              type="button"
            >
              x
            </button>

            <img src={recipeResult.recipe.image} alt="" />

            <div className="recipe-content">
              <p className="match-note">
                {recipeResult.exactMatch
                  ? 'Matches your filters'
                  : `Closest match with ${
                      recipeResult.changedFilters.length
                    } changed ${
                      recipeResult.changedFilters.length === 1
                        ? 'filter'
                        : 'filters'
                    }`}
              </p>
              <h2 id="recipe-title">{recipeResult.recipe.name}</h2>

              {!recipeResult.exactMatch && (
                <p className="similar-note">
                  No recipe matched everything, so this suggestion changes{' '}
                  {recipeResult.changedFilters
                    .map((filter) => `${filter.type}: ${filter.name}`)
                    .join(', ')}
                  .
                </p>
              )}

              <div className="recipe-tags">
                {recipeResult.recipe.filters.map((filter) => (
                  <span key={`${filter.type}-${filter.name}`}>
                    {filter.name}
                  </span>
                ))}
              </div>

              <h3>Ingredients</h3>
              <ul>
                {recipeResult.recipe.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>

              <h3>Instructions</h3>
              <ol>
                {recipeResult.recipe.instructions.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <button
                className="primary-button"
                disabled={loading || !!error || recipes.length === 0}
                onClick={showRecipe}
                type="button"
              >
                Regenerate
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}

function App() {
  const pages = ['Home', 'Recipes', 'History', 'Favorites', 'Login'];

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setUser((await response.json()).user);
      })
      .catch(() => {
        /* Guests can still view the home page. */
      });
    return () => controller.abort();
  }, []);
  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
      setUser(null);
      navigate('/login', { replace: true });
    } catch {
      setError('Unable to sign out. Please try again.');
    }
  }
  return (
    <>
      <h1>Home</h1>
      <RecipeReview /> {/*temporary review button till we get a recipe card*/}
      {user && (
        <>
          <p>Welcome, {user.username}.</p>
          <button onClick={logout}>Sign out</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function Layout() {
  const pages = ['Home', 'Recipes', 'History', 'Favorites', 'Login'];
  return (
    <>
      <nav className="navbar">
        <h2>RecipeMe</h2>
        <div className="nav-links">
          {pages.map((page) => (
            <Link
              key={page}
              to={page === 'Home' ? '/' : `/${page.toLowerCase()}`}
            >
              {page}
            </Link>
          ))}
        </div>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </>
  );
}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<h1>Recipes</h1>} />
          <Route path="/history" element={<h1>History</h1>} />
          <Route path="/favorites" element={<h1>Favorites</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
