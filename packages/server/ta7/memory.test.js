import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Recipe from '../recipeSchema.ts';

describe('Recipe in-memory tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('creates and finds a recipe', async () => {
    const recipeData = {
      Image: 'pasta.jpg',
      Name: 'Chicken Pasta',
      Ingredients: ['Chicken', 'Pasta', 'Cream'],
      Instructions: ['Boil pasta', 'Cook chicken', 'Add cream'],
      Filters: [
        { name: 'Dinner', type: 'Meal' },
        { name: 'Italian', type: 'Cuisine' },
      ],
    };

    const savedRecipe = await Recipe.create(recipeData);
    const foundRecipe = await Recipe.findById(savedRecipe._id);

    expect(foundRecipe).not.toBeNull();
    expect(foundRecipe.Name).toBe('Chicken Pasta');
    expect(foundRecipe.Ingredients).toEqual(recipeData.Ingredients);
    expect(foundRecipe.Reviews).toHaveLength(0);
  });

  test('rejects a recipe without a name', async () => {
    const recipe = new Recipe({
      Image: 'pasta.jpg',
      Ingredients: ['Pasta'],
      Instructions: ['Boil pasta'],
      Filters: [],
    });

    await expect(recipe.save()).rejects.toThrow();
  });

  test('rejects a recipe without an image', async () => {
    const recipe = new Recipe({
      Name: 'Chicken Pasta',
      Ingredients: ['Pasta'],
      Instructions: ['Boil pasta'],
      Filters: [],
    });

    await expect(recipe.save()).rejects.toThrow();
  });
});
