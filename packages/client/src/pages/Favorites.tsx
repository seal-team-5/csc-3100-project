/* IIMPORTANT NOTE: when adding a favorite, store the recipe ID as a string:
    user.favorites.push(String(recipe._id));   
*/
import { useEffect, useState } from 'react';

type Recipe = {
  _id: string;
  Image: string;
  Name: string;
};

export default function Favorites() {
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [message, setMessage] = useState('Loading favorites...');

  useEffect(() => {
    async function getFavorites() {
      try {
        // get the user's saved recipe IDs
        // & fetch every recipe from the database
        const userResponse = await fetch('/api/user');
        const recipesResponse = await fetch('/api/recipes');

        if (!userResponse.ok || !recipesResponse.ok) {
          throw new Error('Request failed');
        }

        const userData = await userResponse.json();
        const recipesData = await recipesResponse.json();

        const user = userData.user || userData;

        const recipes = recipesData.recipes || recipesData;

        // keep onlys recipes whose ID is in the user's favorites array
        const savedRecipes = recipes.filter((recipe: Recipe) => {
          return user.favorites.includes(String(recipe._id));
        });

        setFavoriteRecipes(savedRecipes);
        setMessage('');
      } catch {
        setMessage('Could not load favorite recipes.');
      }
    }

    getFavorites();
  }, []);

  return (
    <section>
      <h1>Favorites</h1>

      {message && <p>{message}</p>}

      {!message && favoriteRecipes.length === 0 && (
        <p>You haven't saved any recipes yet!</p>
      )}

      <ul>
        {favoriteRecipes.map((recipe) => (
          <li key={recipe._id}>
            {/*
              TO DO: REPLACE THIS WITH THE RECIPECARD COMPONENT WHEN IT IS COMPL:ETED

              <RecipeCard recipe={recipe} />
            */}

            <img src={recipe.Image} alt="" />
            <h2>{recipe.Name}</h2>
          </li>
        ))}
      </ul>
    </section>
  );
}
