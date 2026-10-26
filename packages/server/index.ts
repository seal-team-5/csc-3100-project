import { createServer } from 'node:http';
import connectDB from './database';
import RecipeModel, { type Recipe } from './recipeSchema';

const port = Number(process.env.PORT || 3001);

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');

  if (request.url?.split('?')[0] !== '/api/recipes') {
    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Endpoint not found.' }));
    return;
  }

  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET' });
    response.end(JSON.stringify({ error: 'Method not allowed.' }));
    return;
  }

  try {
    await connectDB();
    const documents = await RecipeModel.find({}).lean<Recipe[]>();
    const recipes = documents.map((recipe) => ({
      image: recipe.Image,
      name: recipe.Name,
      ingredients: recipe.Ingredients,
      instructions: recipe.Instructions,
      filters: recipe.Filters.map((filter) => ({
        name: filter.name,
        type: filter.type,
      })),
    }));

    response.writeHead(200);
    response.end(JSON.stringify({ recipes }));
  } catch {
    response.writeHead(503);
    response.end(
      JSON.stringify({
        error: 'Unable to load recipes from the database. Please try again.',
      })
    );
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Recipe API listening on http://127.0.0.1:${port}`);
});
