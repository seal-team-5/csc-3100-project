import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Recipe from '../recipeSchema.ts';
import User from '../userSchema.ts';
import bcrypt from 'bcrypt';

describe('TA 7 in-memory database tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Recipe.deleteMany({});
    await User.deleteMany({});
  });

  test('creates and retrieves a recipe', async () => {
    const recipe = await Recipe.create({
      Image: 'test-pasta.jpg',
      Name: 'Test Pasta',
      Ingredients: ['pasta', 'tomatoes'],
      Instructions: ['Boil pasta', 'Add sauce'],
      Filters: [],
      Reviews: [],
    });

    const found = await Recipe.findById(recipe._id);

    expect(found).not.toBeNull();
    expect(found.Name).toBe('Test Pasta');
  });

  test('creates and retrieves a user', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword,
    });

    const found = await User.findById(user._id);

    expect(found).not.toBeNull();
    expect(found.username).toBe('testuser');
    expect(found.email).toBe('test@example.com');
  }); // User test ends here!

  test('finds recipes by name and retrieves all recipes', async () => {
    await Recipe.create({
      Image: 'pasta.jpg',
      Name: 'Test Pasta',
      Ingredients: ['pasta', 'tomatoes'],
      Instructions: ['Boil pasta', 'Add sauce'],
      Filters: [],
      Reviews: [],
    });

    await Recipe.create({
      Image: 'soup.jpg',
      Name: 'Test Soup',
      Ingredients: ['water', 'vegetables'],
      Instructions: ['Boil water', 'Add vegetables'],
      Filters: [],
      Reviews: [],
    });

    const allRecipes = await Recipe.find();
    const pasta = await Recipe.findOne({ Name: 'Test Pasta' });

    expect(allRecipes).toHaveLength(2);
    expect(pasta).not.toBeNull();
    expect(pasta.Name).toBe('Test Pasta');
  });

  test('finds a user by email', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    await User.create({
      username: 'loginuser',
      email: 'login@example.com',
      password: hashedPassword,
    });

    const found = await User.findOne({
      email: 'login@example.com',
    }).select('+password');

    expect(found).not.toBeNull();
    expect(found.username).toBe('loginuser');
    expect(found.password).toBe(hashedPassword);
  });

  test('updates a user favorites list', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await User.create({
      username: 'favoriteuser',
      email: 'favorites@example.com',
      password: hashedPassword,
      favorites: [],
    });

    user.favorites.push('recipe123');

    await user.save();

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.favorites).toContain('recipe123');
  });

  test('adds a review to a recipe', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await User.create({
      username: 'reviewuser',
      email: 'review@example.com',
      password: hashedPassword,
    });

    const recipe = await Recipe.create({
      Image: 'pasta.jpg',
      Name: 'Review Pasta',
      Ingredients: ['pasta'],
      Instructions: ['Boil pasta'],
      Filters: [],
      Reviews: [],
    });

    recipe.Reviews.push({
      userId: user._id,
      rating: 5,
      note: 'Really delicious!',
      createdAt: new Date(),
    });

    await recipe.save();

    const updatedRecipe = await Recipe.findById(recipe._id);

    expect(updatedRecipe.Reviews).toHaveLength(1);
    expect(updatedRecipe.Reviews[0].rating).toBe(5);
    expect(updatedRecipe.Reviews[0].note).toBe('Really delicious!');
  });

  test('updates a user generated recipe history', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await User.create({
      username: 'historyuser',
      email: 'history@example.com',
      password: hashedPassword,
      generatedRecipes: [],
    });

    const recipe = await Recipe.create({
      Image: 'pasta.jpg',
      Name: 'History Pasta',
      Ingredients: ['pasta'],
      Instructions: ['Boil pasta'],
      Filters: [],
      Reviews: [],
    });

    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          generatedRecipes: {
            recipeId: recipe._id,
            recipeName: recipe.Name,
            image: recipe.Image,
            generatedAt: new Date(),
          },
        },
      }
    );

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.generatedRecipes).toHaveLength(1);
    expect(updatedUser.generatedRecipes[0].recipeName).toBe('History Pasta');
    expect(updatedUser.generatedRecipes[0].recipeId.toString()).toBe(
      recipe._id.toString()
    );
  });

  test('keeps newest generated recipes first', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await User.create({
      username: 'historyorder',
      email: 'historyorder@example.com',
      password: hashedPassword,
    });

    const firstRecipe = await Recipe.create({
      Image: 'first.jpg',
      Name: 'First Recipe',
      Ingredients: ['pasta'],
      Instructions: ['Cook pasta'],
      Filters: [],
      Reviews: [],
    });

    const secondRecipe = await Recipe.create({
      Image: 'second.jpg',
      Name: 'Second Recipe',
      Ingredients: ['rice'],
      Instructions: ['Cook rice'],
      Filters: [],
      Reviews: [],
    });

    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          generatedRecipes: {
            $each: [
              {
                recipeId: firstRecipe._id,
                recipeName: firstRecipe.Name,
                image: firstRecipe.Image,
              },
              {
                recipeId: secondRecipe._id,
                recipeName: secondRecipe.Name,
                image: secondRecipe.Image,
              },
            ],
            $position: 0,
            $slice: 100,
          },
        },
      }
    );

    const updatedUser = await User.findById(user._id);

    expect(updatedUser.generatedRecipes).toHaveLength(2);
    expect(updatedUser.generatedRecipes[0].recipeName).toBe('First Recipe');
  });

  test('retrieves recipe summaries with selected fields', async () => {
    await Recipe.create({
      Image: 'pasta.jpg',
      Name: 'Summary Pasta',
      Ingredients: ['pasta', 'tomatoes'],
      Instructions: ['Boil pasta', 'Add sauce'],
      Filters: [],
      Reviews: [],
    });

    const recipes = await Recipe.find().select('Name Image').lean();

    expect(recipes).toHaveLength(1);
    expect(recipes[0].Name).toBe('Summary Pasta');
    expect(recipes[0].Image).toBe('pasta.jpg');
    expect(recipes[0].Ingredients).toBeUndefined();
  });

  test('populates the user information in recipe reviews', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);

    const user = await User.create({
      username: 'reviewer',
      email: 'reviewer@example.com',
      password: hashedPassword,
    });

    const recipe = await Recipe.create({
      Image: 'pasta.jpg',
      Name: 'Reviewed Pasta',
      Ingredients: ['pasta'],
      Instructions: ['Boil pasta'],
      Filters: [],
      Reviews: [
        {
          userId: user._id,
          rating: 5,
          note: 'Amazing recipe!',
        },
      ],
    });

    const result = await Recipe.findById(recipe._id)
      .select('Reviews')
      .populate('Reviews.userId', 'username')
      .lean();

    expect(result.Reviews).toHaveLength(1);
    expect(result.Reviews[0].userId.username).toBe('reviewer');
  });

  test('finds recipes matching a list of names', async () => {
    await Recipe.create({
      Image: 'pasta.jpg',
      Name: 'Pasta',
      Ingredients: ['pasta'],
      Instructions: ['Boil pasta'],
      Filters: [],
      Reviews: [],
    });

    await Recipe.create({
      Image: 'soup.jpg',
      Name: 'Soup',
      Ingredients: ['vegetables'],
      Instructions: ['Boil vegetables'],
      Filters: [],
      Reviews: [],
    });

    await Recipe.create({
      Image: 'rice.jpg',
      Name: 'Rice',
      Ingredients: ['rice'],
      Instructions: ['Cook rice'],
      Filters: [],
      Reviews: [],
    });

    const recipes = await Recipe.find({
      Name: { $in: ['Pasta', 'Soup'] },
    })
      .select('_id Name')
      .lean();

    expect(recipes).toHaveLength(2);

    const names = recipes.map((recipe) => recipe.Name);

    expect(names).toContain('Pasta');
    expect(names).toContain('Soup');
    expect(names).not.toContain('Rice');
  });
});
