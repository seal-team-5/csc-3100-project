// seed.ts
// one-time script that fills our MongoDB database with real recipes from TheMealDB
//
// How it works:
//   1. Download recipes from TheMealDB (a free recipe API).
//   2. Reshape each recipe so it matches our Recipe schema.
//   3. Save each recipe into the "recipes" collection in MongoDB.
//
// How to run it:
//   npx tsx packages/server/seed.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './database';
import Recipe from './recipeSchema';

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

type Meal = Record<string, string | null>;

//Turns TheMealDB's instruction text into an array of steps.

function toSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)]\s*/, ''))
    .filter((line) => line.length > 0 && !/^step\s*\d+$/i.test(line));
}

/**
 * Converts one TheMealDB meal into a document matching our Recipe schema.
 * This is where we map their field names onto ours:
 *   strMealThumb -> Image
 *   strMeal -> Name
 *   strIngredient1..20 + strMeasure1..20 -> Ingredients
 *   strInstructions -> Instructions
 *   strArea, strCategory, strTags -> Filters
 * @param {Meal} meal Raw meal from the API.
 * @returns {object} Recipe document.
 */
function toRecipe(meal: Meal) {
  // ---- Ingredients ----
  // TheMealDB stores ingredients as 20 separate fields (strIngredient1,
  // strIngredient2, ...) with a matching measurement for each one
  // (strMeasure1, strMeasure2, ...). Unused slots are empty or null.
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    // The "|| ''" turns null into an empty string so .trim() doesn't crash.
    const name = (meal[`strIngredient${i}`] || '').trim();
    const measure = (meal[`strMeasure${i}`] || '').trim();

    // Only keep slots that actually have an ingredient in them.
    if (name) {
      // Combine them into one string like "2 tbsp olive oil". If there is no
      // measurement (like "salt"), just use the ingredient name.
      ingredients.push(measure ? `${measure} ${name}` : name);
    }
  }

  // ---- Filters ----
  // Our schema's Filters field is a list of { name, type } objects that the
  // app can use for searching. We build it from the recipe's cuisine,
  // category, and tags.
  const filters: { name: string; type: string }[] = [];

  // Cuisine, e.g. { name: 'Italian', type: 'cuisine' }
  if (meal.strArea) filters.push({ name: meal.strArea, type: 'cuisine' });

  // Category, e.g. { name: 'Dessert', type: 'category' }
  if (meal.strCategory) {
    filters.push({ name: meal.strCategory, type: 'category' });
  }

  // Tags come as one comma-separated string like "Pasta,Baking", so we split
  // them up and add each one as its own filter. Empty tags are skipped.
  for (const tag of (meal.strTags || '').split(',')) {
    if (tag.trim()) filters.push({ name: tag.trim(), type: 'tag' });
  }

  // ---- Final recipe ----
  // The field names here (capital letters and all) must match
  // recipeSchema.ts exactly, or MongoDB won't save them.
  return {
    Image: meal.strMealThumb || '',
    Name: (meal.strMeal || '').trim(),
    Ingredients: ingredients,
    Instructions: toSteps(meal.strInstructions || ''),
    Filters: filters,
  };
}

/**
 * Main function: downloads every recipe from TheMealDB and saves it into
 * MongoDB. Safe to run more than once, because it updates existing recipes
 * instead of adding duplicates.
 */
async function main() {
  // Open the connection to our MongoDB database.
  await connectDB();

  // Keeps track of how many recipes we saved so we can print it at the end.
  let count = 0;

  // Go through each letter a-z, one at a time.
  for (const letter of LETTERS) {
    // Ask TheMealDB for all recipes starting with this letter.
    // "await" pauses here until the download finishes.
    const response = await fetch(`${BASE_URL}/search.php?f=${letter}`);

    // Convert the response from raw text into a JavaScript object.
    const data = await response.json();

    // data.meals is a list of recipes, but it is null if no recipe starts
    // with this letter, so "|| []" gives us an empty list instead of crashing.
    for (const meal of data.meals || []) {
      // Reshape the raw meal to match our schema (see toRecipe above).
      const recipe = toRecipe(meal);

      // Our schema requires a name and instructions, so skip any recipe that
      // is missing them instead of causing a validation error.
      if (!recipe.Name || recipe.Instructions.length === 0) continue;

      // "Upsert" = update if it exists, insert if it doesn't.
      //   1st argument: how to find an existing recipe (by Name)
      //   2nd argument: the data to save
      //   3rd argument: upsert: true means create it if it wasn't found
      // This is why running the script twice won't create duplicates.
      await Recipe.updateOne(
        { Name: recipe.Name },
        { $set: recipe },
        { upsert: true }
      );
      count++;
    }
  }

  // Let us know it worked.
  console.log(`Seeded ${count} recipes.`);

  // Close the database connection. Without this, the script would hang
  // instead of exiting.
  await mongoose.disconnect();
}

// Run main(). If anything goes wrong (bad password, no internet, etc.),
// print the error and exit with code 1 to signal that the script failed.
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
