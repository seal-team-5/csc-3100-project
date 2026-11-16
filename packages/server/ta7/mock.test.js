import { jest } from '@jest/globals';
import Recipe from '../recipeSchema.ts';
import User from '../userSchema.ts';

describe('TA 7 mock database tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('mocks creating and retrieving a recipe', async () => {
    const mockRecipe = {
      _id: 'recipe123',
      Name: 'Test Pasta',
    };

    jest.spyOn(Recipe, 'create').mockResolvedValue(mockRecipe);
    jest.spyOn(Recipe, 'findById').mockResolvedValue(mockRecipe);

    const created = await Recipe.create({ Name: 'Test Pasta' });
    const found = await Recipe.findById('recipe123');

    expect(created.Name).toBe('Test Pasta');
    expect(found.Name).toBe('Test Pasta');
    expect(Recipe.create).toHaveBeenCalledTimes(1);
    expect(Recipe.findById).toHaveBeenCalledWith('recipe123');
  });

  test('mocks finding recipes by name', async () => {
    const mockRecipes = [{ Name: 'Pasta' }, { Name: 'Soup' }];

    const mockPasta = { Name: 'Pasta' };

    jest.spyOn(Recipe, 'findOne').mockResolvedValue(mockPasta);

    const pasta = await Recipe.findOne({ Name: 'Pasta' });
    expect(pasta.Name).toBe('Pasta');
    expect(Recipe.findOne).toHaveBeenCalledWith({ Name: 'Pasta' });

    jest.spyOn(Recipe, 'find').mockResolvedValue(mockRecipes);

    const found = await Recipe.find();

    expect(found).toHaveLength(2);
    expect(found[0].Name).toBe('Pasta');
  });

  test('mocks creating and retrieving a user', async () => {
    const mockUser = {
      _id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
    };

    jest.spyOn(User, 'create').mockResolvedValue(mockUser);
    jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

    const created = await User.create({
      username: 'testuser',
      email: 'test@example.com',
    });

    const found = await User.findById('user123');

    expect(created.username).toBe('testuser');
    expect(found.email).toBe('test@example.com');
    expect(User.create).toHaveBeenCalledTimes(1);
    expect(User.findById).toHaveBeenCalledWith('user123');
  });

  test('mocks updating generated recipe history', async () => {
    jest.spyOn(User, 'updateOne').mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });

    const result = await User.updateOne(
      { _id: 'user123' },
      { $push: { generatedRecipes: { recipeName: 'Pasta' } } }
    );

    expect(result.modifiedCount).toBe(1);
    expect(User.updateOne).toHaveBeenCalledTimes(1);
  });
  test('mocks recipe summary queries', async () => {
    const mockRecipes = [{ Name: 'Pasta', Image: 'pasta.jpg' }];

    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRecipes),
    };

    jest.spyOn(Recipe, 'find').mockReturnValue(query);

    const result = await Recipe.find().select('Name Image').lean();

    expect(result).toHaveLength(1);
    expect(query.select).toHaveBeenCalledWith('Name Image');
    expect(query.lean).toHaveBeenCalled();
  });

  test('mocks finding recipes by a list of names', async () => {
    const mockRecipes = [{ Name: 'Pasta' }, { Name: 'Soup' }];

    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockRecipes),
    };

    jest.spyOn(Recipe, 'find').mockReturnValue(query);

    const result = await Recipe.find({
      Name: { $in: ['Pasta', 'Soup'] },
    })
      .select('_id Name')
      .lean();

    expect(result).toHaveLength(2);
    expect(Recipe.find).toHaveBeenCalledWith({
      Name: { $in: ['Pasta', 'Soup'] },
    });
  });
  test('mocks saving a recipe review', async () => {
    const recipe = new Recipe({
      Name: 'Pasta',
      Reviews: [],
    });

    jest.spyOn(recipe, 'save').mockResolvedValue(recipe);

    recipe.Reviews.push({
      rating: 5,
      note: 'Amazing!',
    });

    await recipe.save();

    expect(recipe.save).toHaveBeenCalledTimes(1);
  });
  test('mocks saving user favorites', async () => {
    const user = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'mock-password',
      favorites: [],
    });

    jest.spyOn(user, 'save').mockResolvedValue(user);

    user.favorites.push('recipe123');

    await user.save();

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(user.favorites).toContain('recipe123');
  });

  test('mocks populating user information in recipe reviews', async () => {
    const mockReviews = [
      {
        rating: 5,
        note: 'Amazing!',
        userId: {
          username: 'testuser',
        },
      },
    ];

    const query = {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        Reviews: mockReviews,
      }),
    };

    jest.spyOn(Recipe, 'findById').mockReturnValue(query);

    const result = await Recipe.findById('recipe123')
      .select('Reviews')
      .populate('Reviews.userId', 'username')
      .lean();

    expect(result.Reviews[0].userId.username).toBe('testuser');
    expect(query.populate).toHaveBeenCalledWith('Reviews.userId', 'username');
  });

  test('mocks keeping newest generated recipes first', async () => {
    const mockResult = {
      acknowledged: true,
      modifiedCount: 1,
    };

    jest.spyOn(User, 'updateOne').mockResolvedValue(mockResult);

    const result = await User.updateOne(
      { _id: 'user123' },
      {
        $push: {
          generatedRecipes: {
            $each: [{ recipeName: 'New Pasta' }, { recipeName: 'New Soup' }],
            $position: 0,
            $slice: 100,
          },
        },
      }
    );

    expect(result.modifiedCount).toBe(1);

    const update = User.updateOne.mock.calls[0][1];
    expect(update.$push.generatedRecipes.$position).toBe(0);
    expect(update.$push.generatedRecipes.$slice).toBe(100);
  });

  test('mocks finding a user by email with password selected', async () => {
    const mockUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: '$2b$12$mockhash',
    };

    const query = {
      select: jest.fn().mockResolvedValue(mockUser),
    };

    jest.spyOn(User, 'findOne').mockReturnValue(query);

    const result = await User.findOne({
      email: 'test@example.com',
    }).select('+password');

    expect(result.password).toBe(mockUser.password);
    expect(query.select).toHaveBeenCalledWith('+password');
  });
});
