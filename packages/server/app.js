import bcrypt from 'bcrypt';
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

  app.get('/api/recipes', async (_req, res) => {
    try {
      const documents = await Recipe.find({}).lean();
      const recipes = documents.map((recipe) => ({
        image: recipe.Image,
        name: recipe.Name,
        ingredients: recipe.Ingredients,
        instructions: recipe.Instructions,
        filters: recipe.Filters.map(({ name, type }) => ({ name, type })),
      }));
      return res.json({ recipes });
    } catch (error) {
      console.error('Recipe query failed:', error.name);
      return res.status(503).json({
        error: 'Unable to load recipes from the database. Please try again.',
      });
    }
  });

  app.get('/api/recipe-progress', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.set('Cache-Control', 'no-store');
    res.json({ recipeProgress: user.recipeProgress || [] });
  });
  
  app.post('/api/recipe-progress', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
    const { recipeName, status } = req.body || {};
    if (
      typeof recipeName !== 'string' ||
      !recipeName.trim() ||
      !['in-progress', 'completed'].includes(status)
    ) {
      return res.status(400).json({ error: 'Invalid recipe progress' });
    }
  
    const recipe = await Recipe.findOne({ Name: recipeName.trim() });
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  
    const now = new Date();
    const existing = user.recipeProgress.find(
      (item) => item.recipeName === recipe.Name
    );
  
    if (existing) {
      existing.status = status;
      if (status === 'completed') existing.completedAt = now;
      else existing.completedAt = undefined;
    } else {
      user.recipeProgress.push({
        recipeName: recipe.Name,
        status,
        startedAt: now,
        ...(status === 'completed' ? { completedAt: now } : {}),
      });
    }
  
    await user.save();
    res.set('Cache-Control', 'no-store');
    res.json({ recipeProgress: user.recipeProgress });
  });

  // 1. Register: validate input, hash the password, then save the user.
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

  // find the user and compare the entered password with the hash
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
    if (!req.session.userId)
      return res.status(401).json({ error: 'Please log in.' });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    return res.json({ user: publicUser(user) });
    
  });

  // Log out: delete the server session and clear teh cookie containing the session id to logout
  app.post('/api/auth/logout', async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    res.clearCookie(cookieName, { ...cookieOptions, secure: production });
    return res.sendStatus(204);
  });

  return finishServer(app, options);
}

//helpers
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
function publicUser(user) {
  return { id: String(user._id), username: user.username, email: user.email };
}
