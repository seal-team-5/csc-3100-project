import { useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import "./App.css";

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

const recipes: Recipe[] = [
  {
    image: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg",
    name: "Teriyaki Chicken Rice Bowl",
    ingredients: [
      "chicken thighs",
      "teriyaki sauce",
      "brown rice",
      "broccoli",
      "carrots",
    ],
    instructions: [
      "Bake the chicken with teriyaki sauce until cooked through.",
      "Steam the broccoli and carrots while the rice warms.",
      "Slice the chicken and serve everything together with extra sauce.",
    ],
    filters: [
      { name: "Japanese", type: "Cuisine" },
      { name: "Chicken", type: "Protein" },
      { name: "Dinner", type: "Meal" },
      { name: "Balanced", type: "Goal" },
    ],
  },
  {
    image: "https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg",
    name: "Vegetable Pasta Bake",
    ingredients: [
      "penne pasta",
      "tomato sauce",
      "zucchini",
      "bell pepper",
      "mozzarella",
    ],
    instructions: [
      "Boil the pasta until just tender.",
      "Mix the pasta with tomato sauce, vegetables, and cheese.",
      "Bake until the top is bubbling and golden.",
    ],
    filters: [
      { name: "Italian", type: "Cuisine" },
      { name: "Vegetarian", type: "Diet" },
      { name: "Dinner", type: "Meal" },
      { name: "Comfort", type: "Goal" },
    ],
  },
  {
    image: "https://www.themealdb.com/images/media/meals/1549542877.jpg",
    name: "Beef Taco Bowls",
    ingredients: [
      "ground beef",
      "rice",
      "black beans",
      "corn",
      "salsa",
      "avocado",
    ],
    instructions: [
      "Brown the beef with taco seasoning.",
      "Layer rice, beans, corn, beef, and salsa in bowls.",
      "Top with avocado before serving.",
    ],
    filters: [
      { name: "Mexican", type: "Cuisine" },
      { name: "Beef", type: "Protein" },
      { name: "Dinner", type: "Meal" },
      { name: "Quick", type: "Time" },
    ],
  },
  {
    image: "https://www.themealdb.com/images/media/meals/ytpstt1511814614.jpg",
    name: "Chickpea Curry",
    ingredients: [
      "chickpeas",
      "coconut milk",
      "curry powder",
      "tomatoes",
      "spinach",
      "rice",
    ],
    instructions: [
      "Simmer chickpeas, tomatoes, coconut milk, and spices.",
      "Fold in spinach until wilted.",
      "Serve over rice.",
    ],
    filters: [
      { name: "Indian", type: "Cuisine" },
      { name: "Vegetarian", type: "Diet" },
      { name: "Dinner", type: "Meal" },
      { name: "One Pot", type: "Time" },
    ],
  },
  {
    image: "https://www.themealdb.com/images/media/meals/1520084413.jpg",
    name: "Berry Yogurt Parfait",
    ingredients: ["greek yogurt", "berries", "granola", "honey"],
    instructions: [
      "Layer yogurt, berries, and granola in a glass.",
      "Drizzle with honey and serve chilled.",
    ],
    filters: [
      { name: "American", type: "Cuisine" },
      { name: "Vegetarian", type: "Diet" },
      { name: "Breakfast", type: "Meal" },
      { name: "Quick", type: "Time" },
    ],
  },
  {
    image: "https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg",
    name: "Salmon Rice Plate",
    ingredients: ["salmon", "rice", "cucumber", "soy sauce", "sesame seeds"],
    instructions: [
      "Roast salmon until flaky.",
      "Serve over rice with cucumber and sesame seeds.",
      "Finish with soy sauce.",
    ],
    filters: [
      { name: "Japanese", type: "Cuisine" },
      { name: "Seafood", type: "Protein" },
      { name: "Dinner", type: "Meal" },
      { name: "Balanced", type: "Goal" },
    ],
  },
];

const filterGroups = recipes.reduce<Record<string, string[]>>((groups, recipe) => {
  recipe.filters.forEach((filter) => {
    groups[filter.type] = groups[filter.type] || [];

    if (!groups[filter.type].includes(filter.name)) {
      groups[filter.type].push(filter.name);
    }
  });

  return groups;
}, {});

Object.values(filterGroups).forEach((filters) => filters.sort());

const randomFrom = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

function filterMatches(recipe: Recipe, selectedFilter: RecipeFilter) {
  return recipe.filters.some(
    (filter) =>
      filter.type === selectedFilter.type && filter.name === selectedFilter.name
  );
}

function getRecipeResult(selectedFilters: RecipeFilter[]): RecipeResult {
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
  const fallbackPool = oneOrTwoChanged.length > 0 ? oneOrTwoChanged : rankedRecipes;
  const closestChangeCount = fallbackPool[0].changedFilters.length;
  const closestRecipes = fallbackPool.filter(
    (result) => result.changedFilters.length === closestChangeCount
  );

  return randomFrom(closestRecipes);
}

function Home() {
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
    setRecipeResult(getRecipeResult(selectedFilters));
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
                      className={`filter-pill ${isSelected ? "selected" : ""}`}
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

        <button className="primary-button" onClick={showRecipe} type="button">
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
                  ? "Matches your filters"
                  : `Closest match with ${
                      recipeResult.changedFilters.length
                    } changed ${
                      recipeResult.changedFilters.length === 1
                        ? "filter"
                        : "filters"
                    }`}
              </p>
              <h2 id="recipe-title">{recipeResult.recipe.name}</h2>

              {!recipeResult.exactMatch && (
                <p className="similar-note">
                  No recipe matched everything, so this suggestion changes{" "}
                  {recipeResult.changedFilters
                    .map((filter) => `${filter.type}: ${filter.name}`)
                    .join(", ")}
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

              <button className="primary-button" onClick={showRecipe} type="button">
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
  const pages = ["Home", "Recipes", "History", "Favorites", "Login"];

  return (
    <BrowserRouter>
      <nav className="navbar">
        <h2>RecipeMe</h2>

        <div className="nav-links">
          {pages.map((page) => (
            <Link
              key={page}
              to={page === "Home" ? "/" : `/${page.toLowerCase()}`}
            >
              {page}
            </Link>
          ))}
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<h1>Recipes</h1>} />
          <Route path="/history" element={<h1>History</h1>} />
          <Route path="/favorites" element={<h1>Favorites</h1>} />
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
