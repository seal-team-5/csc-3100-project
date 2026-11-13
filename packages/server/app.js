import bcrypt from 'bcrypt';
import {
  normalizeRecipeFilters,
  PREGNANCY_FILTER,
} from '../shared/recipeFilters.ts';
import { hashPassword, validPassword, BCRYPT_ROUNDS } from './password.js';
import {
  configureServer,
  finishServer,
  cookieName,
  cookieOptions,
} from './serverSetup.js';

const dummyHash = await bcrypt.hash(
  'unused-password-for-timing-only',
  BCRYPT_ROUNDS
);

export function createApp(options) {
  const { User, Recipe, production = false } = options;

  async function getAuthenticatedUser(req) {
    if (!req.session?.userId) return null;
    return User.findById(req.session.userId);
  }

  const { app, loginLimiter, registerLimiter } = configureServer(options);

  // Returns the signed-in user's public data and favorite recipe IDs.
  app.get('/api/user', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Please log in.' });
    }

    res.set('Cache-Control', 'no-store');

    return res.json({
      user: {
        ...publicUser(user),
        favorites: user.favorites || [],
      },
    });
  });

  // Adds a recipe to favorites, or removes it if it is already favorited.
  app.post('/api/favorites', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Please log in.' });
    }

    const { recipeId } = req.body || {};

    if (typeof recipeId !== 'string' || !/^[a-f\d]{24}$/i.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found.' });
    }

    const favorites = user.favorites || [];
    const alreadyFavorite = favorites.includes(recipeId);

    if (alreadyFavorite) {
      user.favorites = favorites.filter((id) => id !== recipeId);
    } else {
      user.favorites.push(recipeId);
    }

    await user.save();

    res.set('Cache-Control', 'no-store');

    return res.json({
      favorites: user.favorites,
    });
  });

  // Returns all recipes, or a summary of each recipe if view=summary is present.
  app.get('/api/recipes', async (req, res) => {
    try {
      const summary = req.query.view === 'summary';
      const query = Recipe.find({});

      if (summary) query.select('Image Name Filters Reviews');

      const documents = await query.lean();

      const recipes = documents.map((recipe) => ({
        ...(summary
          ? { id: String(recipe._id), ...ratingSummary(recipe.Reviews) }
          : {}),
        image: recipe.Image,
        name: recipe.Name,
        ...(!summary
          ? {
              ingredients: recipe.Ingredients,
              instructions: recipe.Instructions,
            }
          : {}),
        filters: normalizeRecipeFilters(recipe.Filters),
      }));

      if (!summary) return res.json({ recipes });

      const filterGroups = Object.create(null);
      filterGroups[PREGNANCY_FILTER.type] = [PREGNANCY_FILTER.name];

      for (const recipe of recipes) {
        for (const { type, name } of recipe.filters) {
          filterGroups[type] ||= [];

          if (!filterGroups[type].includes(name)) {
            filterGroups[type].push(name);
          }
        }
      }

      Object.values(filterGroups).forEach((names) => names.sort());

      return res.json({ recipes, filterGroups });
    } catch (error) {
      console.error('Recipe query failed:', error.name);

      return res.status(503).json({
        error: 'Unable to load recipes from the database. Please try again.',
      });
    }
  });

  // Returns a single recipe by ID, or 404 if not found.
  app.get('/api/recipes/:id', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    try {
      const recipe = await Recipe.findById(req.params.id).lean();

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found.' });
      }

      return res.json({
        recipe: {
          id: String(recipe._id),
          image: recipe.Image,
          name: recipe.Name,
          ingredients: recipe.Ingredients,
          instructions: recipe.Instructions,
          filters: normalizeRecipeFilters(recipe.Filters),
        },
      });
    } catch (error) {
      console.error('Recipe detail query failed:', error.name);

      return res.status(503).json({
        error: 'Unable to load this recipe. Please try again.',
      });
    }
  });

  // Keep the latest 100 rolls separately from cooking progress.
  app.get('/api/recipe-history', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    return res.json({
      generatedRecipes: user.generatedRecipes || [],
    });
  });

  app.post('/api/recipe-history', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    const { recipeId } = req.body || {};

    if (typeof recipeId !== 'string' || !/^[a-f\d]{24}$/i.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found.' });
    }

    // An atomic push preserves simultaneous rolls from different tabs/devices.
    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          generatedRecipes: {
            $each: [
              {
                recipeId: recipe._id,
                recipeName: recipe.Name,
                image: recipe.Image,
                generatedAt: new Date(),
              },
            ],
            $position: 0,
            $slice: 100,
          },
        },
      }
    );

    return res.status(201).json({ message: 'Recipe added to history.' });
  });

  // Returns the signed-in user's recipe progress.
  app.get('/api/recipe-progress', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    const progress = user.recipeProgress || [];

    const legacyNames = [
      ...new Set(
        progress.filter((item) => !item.recipeId).map((item) => item.recipeName)
      ),
    ];

    // Resolve old history without rewriting the user's data.
    // Do not guess if names collide.
    const recipes = legacyNames.length
      ? await Recipe.find({ Name: { $in: legacyNames } })
          .select('_id Name')
          .lean()
      : [];

    const recipeProgress = progress.map((item) => {
      const entry = item.toObject ? item.toObject() : { ...item };

      if (item.recipeId) {
        return { ...entry, recipeId: String(item.recipeId) };
      }

      const matches = recipes.filter(
        (recipe) => recipe.Name === item.recipeName
      );

      return {
        ...entry,
        ...(matches.length === 1 ? { recipeId: String(matches[0]._id) } : {}),
      };
    });

    return res.json({ recipeProgress });
  });

  // Adds or updates a recipe progress entry.
  app.post('/api/recipe-progress', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    const { recipeId, recipeName, status } = req.body || {};

    if (!['in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid recipe progress.' });
    }

    if (
      recipeId !== undefined &&
      (typeof recipeId !== 'string' || !/^[a-f\d]{24}$/i.test(recipeId))
    ) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    if (!recipeId && (typeof recipeName !== 'string' || !recipeName.trim())) {
      return res
        .status(400)
        .json({ error: 'A recipe ID or name is required.' });
    }

    const recipe = recipeId
      ? await Recipe.findById(recipeId)
      : await Recipe.findOne({ Name: recipeName.trim() });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found.' });
    }

    const now = new Date();

    user.recipeProgress ||= [];

    const existing = user.recipeProgress.find((item) =>
      item.recipeId
        ? String(item.recipeId) === String(recipe._id)
        : item.recipeName === recipe.Name
    );

    if (existing) {
      existing.recipeId = recipe._id;
      existing.recipeName = recipe.Name;
      existing.status = status;
      existing.completedAt = status === 'completed' ? now : undefined;
    } else {
      user.recipeProgress.push({
        recipeId: recipe._id,
        recipeName: recipe.Name,
        status,
        startedAt: now,
        ...(status === 'completed' ? { completedAt: now } : {}),
      });
    }

    await user.save();

    return res.json({ recipeProgress: user.recipeProgress });
  });

  // Removes a recipe's progress entry.
  app.delete('/api/recipe-progress/:recipeId', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    const recipeId = req.params.recipeId.toLowerCase();

    if (!/^[a-f\d]{24}$/.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    // Older entries have no recipeId, so also match them by recipe name.
    const recipe = await Recipe.findById(recipeId);

    user.recipeProgress = (user.recipeProgress || []).filter((item) =>
      item.recipeId
        ? String(item.recipeId).toLowerCase() !== recipeId
        : !recipe || item.recipeName !== recipe.Name
    );

    await user.save();

    return res.json({ recipeProgress: user.recipeProgress });
  });

  // Register: validate input, hash the password, then save the user.
  app.post('/api/auth/register', registerLimiter, async (req, res) => {
    const { username, phone, password } = req.body || {};
    const email = normalizeEmail(req.body?.email);

    if (
      !validEmail(email) ||
      !validText(username, 80) ||
      !validText(phone, 40) ||
      !validPassword(password)
    ) {
      return res.status(400).json({
        error:
          'Provide a username, email, phone, and a password with at least 8 characters',
      });
    }

    try {
      const passwordHash = await hashPassword(password);

      const user = await User.create({
        username: username.trim(),
        email,
        phone: phone.trim(),
        password: passwordHash,
      });

      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(409)
          .json({ error: 'Unable to register with those details.' });
      }

      throw error;
    }
  });

  // Find the user and compare the entered password with the hash.
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (
      !validEmail(email) ||
      typeof password !== 'string' ||
      !password.length ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = await User.findOne({ email }).select('+password');
    const matches = await bcrypt.compare(password, user?.password || dummyHash);

    if (!user || !matches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Give the user a new session ID, then save it before returning success.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

    req.session.userId = String(user._id);

    req.session.cookie.maxAge =
      req.body.rememberMe === true
        ? 30 * 24 * 60 * 60 * 1000
        : 8 * 60 * 60 * 1000;

    await new Promise((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    return res.json({ user: publicUser(user) });
  });

  // Read the signed-in user. The Home page calls this after login.
  app.get('/api/auth/me', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Please log in.' });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(401).json({ error: 'Please log in.' });
    }

    return res.json({ user: publicUser(user) });
  });

  // Log out: delete the server session and clear the cookie.
  app.post('/api/auth/logout', async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });

    res.clearCookie(cookieName, { ...cookieOptions, secure: production });

    return res.sendStatus(204);
  });

  app.put('/api/recipes/:id/reviews', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    const recipeId = req.params.id;

    if (!/^[a-f\d]{24}$/i.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    const { rating, note = '' } = req.body || {};

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: 'Rating must be a whole number from 1 to 5.' });
    }

    if (typeof note !== 'string' || note.length > 2000) {
      return res.status(400).json({
        error: 'Review note must be text with at most 2000 characters.',
      });
    }

    // Optimistic concurrency prevents simultaneous saves from dropping other reviews.
    // Reload and retry when another request saved the recipe first.
    for (let attempt = 0; attempt < 3; attempt++) {
      const recipe = await Recipe.findById(recipeId);

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found.' });
      }

      recipe.Reviews ||= [];

      const existing = recipe.Reviews.find(
        (review) => String(review.userId) === String(user._id)
      );

      if (existing) {
        existing.rating = rating;
        existing.note = note.trim();
      } else {
        recipe.Reviews.push({
          userId: user._id,
          rating,
          note: note.trim(),
          createdAt: new Date(),
        });
      }

      try {
        await recipe.save();
        return res.json({ message: 'Review saved.' });
      } catch (error) {
        if (error.name !== 'VersionError') throw error;
      }
    }

    return res.status(409).json({
      error: 'Another review was saved at the same time. Please submit again.',
    });
  });

  app.get('/api/recipes/:id/reviews', async (req, res) => {
    const recipeId = req.params.id;

    if (!/^[a-f\d]{24}$/i.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }

    const viewer = await getAuthenticatedUser(req);

    const recipe = await Recipe.findById(recipeId)
      .select('Reviews')
      .populate('Reviews.userId', 'username')
      .lean();

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found.' });
    }

    // Return public usernames only, never account emails or password hashes.
    const reviews = (recipe.Reviews || [])
      .map((review) => ({
        username: review.userId?.username || 'Deleted user',
        rating: review.rating,
        note: review.note,
        createdAt: review.createdAt,
        isOwn: Boolean(
          viewer &&
          review.userId &&
          String(review.userId._id) === String(viewer._id)
        ),
      }))
      .sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
      );

    const reviewCount = reviews.length;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);

    return res.json({
      reviews,
      reviewCount,
      averageRating: reviewCount
        ? Number((total / reviewCount).toFixed(1))
        : null,
    });
  });

  app.get('/api/settings', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    return res.json({
      settings: publicSettings(user),
      username: user.username,
      email: user.email,
    });
  });

  app.put('/api/settings', async (req, res) => {
    const user = await getAuthenticatedUser(req);

    if (!user) return res.status(401).json({ error: 'Please log in.' });

    const { username, servingSize, location, unitSystem, preferredFilters } =
      req.body || {};

    if (
      !validText(username, 80) ||
      !Number.isInteger(servingSize) ||
      servingSize < 1 ||
      servingSize > 20 ||
      typeof location !== 'string' ||
      location.length > 100 ||
      !['us', 'metric'].includes(unitSystem) ||
      !Array.isArray(preferredFilters) ||
      preferredFilters.length > 50 ||
      !preferredFilters.every(
        (f) =>
          f &&
          typeof f.name === 'string' &&
          f.name.length <= 60 &&
          typeof f.type === 'string' &&
          f.type.length <= 60
      )
    ) {
      return res.status(400).json({ error: 'Invalid settings.' });
    }

    const { notifications } = req.body || {};

    if (
      LIST_FIELDS.some(
        (key) => req.body[key] !== undefined && !validList(req.body[key])
      ) ||
      (notifications !== undefined && !validNotifications(notifications))
    ) {
      return res.status(400).json({ error: 'Invalid settings.' });
    }

    user.username = username.trim();
    user.settings.servingSize = servingSize;
    user.settings.location = location.trim();
    user.settings.unitSystem = unitSystem;

    // Normalize filters consistently before saving.
    user.settings.preferredFilters = normalizeRecipeFilters(preferredFilters);

    // Preserve dietary restrictions, dislikes, and allergies.
    for (const key of LIST_FIELDS) {
      if (req.body[key] !== undefined) {
        user.settings[key] = req.body[key].map((item) => item.trim());
      }
    }

    // Preserve notification preferences.
    if (notifications !== undefined) {
      user.settings.notifications = Object.fromEntries(
        NOTIFICATION_KEYS.map((key) => [key, notifications[key]])
      );
    }

    await user.save();

    return res.json({
      settings: publicSettings(user),
      username: user.username,
    });
  });

  return finishServer(app, options);
}

// Helpers

// Average rating and review count only; individual reviews are never exposed here.
function ratingSummary(reviews = []) {
  const reviewCount = reviews.length;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    averageRating: reviewCount
      ? Number((total / reviewCount).toFixed(1))
      : null,
    reviewCount,
  };
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validText(value, maxLength) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

const LIST_FIELDS = ['dietaryRestrictions', 'dislikes', 'allergies'];

const NOTIFICATION_DEFAULTS = {
  dailySuggestions: true,
  groceryItems: true,
  weeklySummary: false,
  marketing: false,
};

const NOTIFICATION_KEYS = Object.keys(NOTIFICATION_DEFAULTS);

function validList(value) {
  return (
    Array.isArray(value) &&
    value.length <= 30 &&
    value.every(
      (item) =>
        typeof item === 'string' &&
        item.trim().length > 0 &&
        item.length <= 60
    )
  );
}

function validNotifications(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    NOTIFICATION_KEYS.every((key) => typeof value[key] === 'boolean')
  );
}

function publicUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
  };
}

function publicSettings(user) {
  const s = user.settings || {};
  const n = s.notifications || {};

  return {
    servingSize: s.servingSize ?? 2,
    location: s.location ?? '',
    unitSystem: s.unitSystem ?? 'us',

    preferredFilters: normalizeRecipeFilters(s.preferredFilters),

    ...Object.fromEntries(
      LIST_FIELDS.map((key) => [key, [...(s[key] || [])]])
    ),

    notifications: Object.fromEntries(
      NOTIFICATION_KEYS.map((key) => [
        key,
        n[key] ?? NOTIFICATION_DEFAULTS[key],
      ])
    ),
  };
}