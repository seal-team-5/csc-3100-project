// vercel/entry.js
import mongoose4 from 'mongoose';
import MongoStore from 'connect-mongo';

// packages/server/database.ts
import 'dotenv/config';
import mongoose from 'mongoose';
var connection;
async function connectDB() {
  const url = process.env.MONGO_URI || process.env.MONGODB_URL;
  if (!url) {
    throw new Error('Set MONGO_URI or MONGODB_URL in .env');
  }
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connection) {
    connection = mongoose.connect(url, {
      serverSelectionTimeoutMS: 1e4,
    });
  }
  try {
    await connection;
    console.log('Connected to MongoDB');
    return mongoose;
  } catch (error) {
    connection = void 0;
    throw error;
  }
}

// packages/server/userSchema.ts
import mongoose2, { Schema } from 'mongoose';
var userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
    },
    // Set for accounts that signed in with Google.
    googleId: { type: String, unique: true, sparse: true },
    password: {
      type: String,
      // Google-only accounts have no password.
      required: function () {
        return !this.googleId;
      },
      select: false,
      // Routes hash passwords before saving; reject accidental plaintext writes.
      match: /^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/,
    },
    favorites: { type: [String], default: [] },
    settings: {
      servingSize: { type: Number, default: 2, min: 1, max: 20 },
      location: { type: String, default: '', trim: true, maxlength: 100 },
      unitSystem: { type: String, enum: ['us', 'metric'], default: 'us' },
      preferredFilters: {
        type: [
          {
            name: { type: String, maxlength: 60 },
            type: { type: String, maxlength: 60 },
          },
        ],
        default: [],
      },
      dietaryRestrictions: { type: [String], default: [] },
      dislikes: { type: [String], default: [] },
      allergies: { type: [String], default: [] },
      notifications: {
        dailySuggestions: { type: Boolean, default: true },
        groceryItems: { type: Boolean, default: true },
        weeklySummary: { type: Boolean, default: false },
        marketing: { type: Boolean, default: false },
      },
    },
    generatedRecipes: {
      type: [
        {
          recipeId: {
            type: Schema.Types.ObjectId,
            ref: 'Recipe',
            required: true,
          },
          recipeName: { type: String, required: true },
          image: { type: String, default: '' },
          generatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    recipeProgress: {
      type: [
        {
          recipeId: { type: Schema.Types.ObjectId, ref: 'Recipe' },
          recipeName: { type: String, required: true },
          status: {
            type: String,
            enum: ['in-progress', 'completed'],
            required: true,
          },
          startedAt: { type: Date, default: Date.now },
          completedAt: { type: Date },
        },
      ],
      default: [],
    },
  },
  {
    collection: 'users',
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        return ret;
      },
    },
  }
);
var userSchema_default =
  mongoose2.models.User || mongoose2.model('User', userSchema);

// packages/server/recipeSchema.ts
import mongoose3, { Schema as Schema2 } from 'mongoose';
var reviewSchema = new Schema2(
  {
    userId: {
      type: Schema2.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number.',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2e3,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);
var recipeSchema = new Schema2(
  {
    Image: {
      type: String,
      required: true,
      trim: true,
    },
    Name: {
      type: String,
      required: true,
      trim: true,
    },
    Ingredients: {
      type: [String],
      required: true,
      trim: true,
    },
    Instructions: {
      type: [String],
      required: true,
      trim: true,
    },
    Filters: {
      type: [{ name: String, type: { type: String } }],
      required: true,
    },
    Reviews: {
      type: [reviewSchema],
      default: [],
    },
  },
  { collection: 'recipes', optimisticConcurrency: true }
);
var recipeSchema_default =
  mongoose3.models.Recipe || mongoose3.model('Recipe', recipeSchema);

// packages/shared/recipeFilters.ts
var FILTER_GROUPS = [
  { type: 'cuisine', label: 'Cuisine' },
  { type: 'protein', label: 'Main ingredient' },
  { type: 'meal', label: 'Meal type' },
  { type: 'diet', label: 'Dietary preference' },
  { type: 'life_stage', label: 'Life stage' },
  { type: 'method', label: 'Cooking method' },
  { type: 'dish', label: 'Dish type' },
];
var PREGNANCY_FILTER = {
  type: 'life_stage',
  name: 'Pregnancy',
};
var key = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
var cuisines = [
  'Afghan',
  'Albanian',
  'Algerian',
  'American',
  'Argentinian',
  'Australian',
  'Austrian',
  'Bangladeshi',
  'Belgian',
  'Brazilian',
  'British',
  'Canadian',
  'Chinese',
  'Croatian',
  'Cypriot',
  'Czech',
  'Danish',
  'Dutch',
  'Egyptian',
  'Filipino',
  'Finnish',
  'French',
  'German',
  'Greek',
  'Hungarian',
  'Indian',
  'Indonesian',
  'Iranian',
  'Irish',
  'Israeli',
  'Italian',
  'Jamaican',
  'Japanese',
  'Kenyan',
  'Korean',
  'Lebanese',
  'Malaysian',
  'Maltese',
  'Mexican',
  'Moroccan',
  'New Zealand',
  'Nigerian',
  'Norwegian',
  'Pakistani',
  'Palestinian',
  'Peruvian',
  'Polish',
  'Portuguese',
  'Romanian',
  'Russian',
  'Saudi Arabian',
  'Scottish',
  'Slovakian',
  'South African',
  'Spanish',
  'Sri Lankan',
  'Swedish',
  'Swiss',
  'Syrian',
  'Thai',
  'Tunisian',
  'Turkish',
  'Ukrainian',
  'Uruguayan',
  'Venezuelan',
  'Vietnamese',
  'Welsh',
];
var cuisineNames = new Map(cuisines.map((name) => [key(name), name]));
var labels = /* @__PURE__ */ new Map();
function define(type, name, ...aliases) {
  for (const label of [name, ...aliases])
    labels.set(key(label), { name, type });
}
define('protein', 'Beef');
define('protein', 'Chicken');
define('protein', 'Lamb');
define('protein', 'Pork');
define('protein', 'Goat');
define('protein', 'Fish');
define('meal', 'Breakfast');
define('meal', 'Starter', 'Starters', 'Appetizer', 'Appetizers');
define('meal', 'Side dish', 'Side', 'Sides', 'Side dishes');
define('meal', 'Dessert', 'Desserts', 'Pudding');
define('meal', 'Snack', 'Snacks');
define('diet', 'Vegetarian');
define('diet', 'Vegan');
define(
  PREGNANCY_FILTER.type,
  PREGNANCY_FILTER.name,
  'Pregnant',
  'Pregnancy friendly'
);
define('method', 'Baking', 'Baked', 'Bake');
define('method', 'Grilling', 'Grilled', 'BBQ', 'Barbecue');
define('method', 'Roasting', 'Roast', 'Roasted');
define('method', 'Frying', 'Fried', 'Deep fried', 'DeepFry');
define('method', 'Stir-frying', 'Stir fry', 'Stir-fried');
define('method', 'Steaming', 'Steamed');
define('method', 'Slow cooking', 'Slow cooked', 'Slow cooker');
define('dish', 'Pasta');
define('dish', 'Soup', 'Soups');
define('dish', 'Salad', 'Salads');
define('dish', 'Curry', 'Curries');
define('dish', 'Stew', 'Stews');
define('dish', 'Casserole', 'Casseroles');
define('dish', 'Sandwich', 'Sandwiches');
define('dish', 'Pizza');
define('dish', 'Pie', 'Pies');
define('dish', 'Bread');
define('dish', 'Cake', 'Cakes');
define('protein', 'Seafood', 'Sea food', 'Shellfish');
function normalizeRecipeFilters(filters) {
  if (!Array.isArray(filters)) return [];
  const result = /* @__PURE__ */ new Map();
  for (const filter of filters) {
    if (
      !filter ||
      typeof filter.name !== 'string' ||
      typeof filter.type !== 'string'
    )
      continue;
    const sourceType = filter.type.trim().toLowerCase();
    if (
      ![
        'cuisine',
        'category',
        'tag',
        ...FILTER_GROUPS.map((group) => group.type),
      ].includes(sourceType)
    )
      continue;
    for (const part of filter.name.split(',')) {
      const normalized = key(part);
      const cuisine = cuisineNames.get(normalized);
      const canonical = cuisine
        ? { name: cuisine, type: 'cuisine' }
        : sourceType === 'cuisine'
          ? void 0
          : labels.get(normalized);
      if (canonical)
        result.set(`${canonical.type}:${canonical.name}`, canonical);
    }
  }
  return [...result.values()].sort(
    (a, b) =>
      FILTER_GROUPS.findIndex((group) => group.type === a.type) -
        FILTER_GROUPS.findIndex((group) => group.type === b.type) ||
      a.name.localeCompare(b.name)
  );
}

// packages/server/recipeInput.js
function recipeInput(body = {}) {
  const { name, image = '', ingredients, instructions, filters = [] } = body;
  const text = (value, max) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const lines = (value, count, length) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= count &&
    value.every((line) => text(line, length));
  if (!text(name, 150))
    return { error: 'Enter a recipe name of at most 150 characters.' };
  if (!lines(ingredients, 50, 200))
    return {
      error: 'Add 1\u201350 ingredients, with at most 200 characters each.',
    };
  if (!lines(instructions, 30, 1e3))
    return {
      error:
        'Add 1\u201330 direction steps, with at most 1000 characters each.',
    };
  if (typeof image !== 'string' || image.length > 2e3)
    return { error: 'Enter a valid HTTPS image URL.' };
  const imageUrl = image.trim();
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error();
    } catch {
      return { error: 'Enter a valid HTTPS image URL, or leave it blank.' };
    }
  }
  if (
    !Array.isArray(filters) ||
    filters.length > 30 ||
    !filters.every(
      (filter) => filter && text(filter.name, 60) && text(filter.type, 60)
    )
  ) {
    return { error: 'Choose at most 30 valid preference filters.' };
  }
  return {
    recipe: {
      Name: name.trim(),
      Image: imageUrl || '/design/recipe-placeholder.svg',
      Ingredients: ingredients.map((line) => line.trim()),
      Instructions: instructions.map((line) => line.trim()),
      Filters: normalizeRecipeFilters(filters),
      Reviews: [],
    },
  };
}

// packages/server/app.js
import bcrypt2 from 'bcrypt';

// packages/server/password.js
import bcrypt from 'bcrypt';
var BCRYPT_ROUNDS = 12;
function validPassword(password) {
  return (
    typeof password === 'string' &&
    [...password].length >= 8 &&
    Buffer.byteLength(password, 'utf8') <= 72
  );
}
async function hashPassword(password) {
  if (!validPassword(password)) {
    throw new Error(
      'Password must have at least 8 characters and at most 72 UTF-8 bytes.'
    );
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// packages/server/googleAuth.js
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
var AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
var TOKEN_URL = 'https://oauth2.googleapis.com/token';
var ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
var FLOW_COOKIE = 'recipeme.oauth';
var FLOW_MAX_AGE_MS = 10 * 60 * 1e3;
var SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1e3;
var CALLBACK_PATH = '/api/auth/google/callback';
function sign(secret, payload) {
  return createHmac('sha256', secret)
    .update(`google-oauth:${payload}`)
    .digest('base64url');
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}
function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return void 0;
}
function readFlow(req, secret) {
  const raw = readCookie(req, FLOW_COOKIE);
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(secret, payload))) {
    return null;
  }
  try {
    const flow = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return flow.exp > Date.now() ? flow : null;
  } catch {
    return null;
  }
}
function decodeIdToken(idToken) {
  if (typeof idToken !== 'string') return null;
  try {
    return JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString()
    );
  } catch {
    return null;
  }
}
function registerGoogleAuth(
  app,
  {
    User,
    clientId,
    clientSecret,
    appOrigin,
    sessionSecret,
    production = false,
    fetchImpl = fetch,
  }
) {
  const enabled = Boolean(clientId && clientSecret);
  const redirectUri = new URL(CALLBACK_PATH, appOrigin).href;
  const flowCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: production,
    path: '/api/auth/google',
  };
  app.get('/api/auth/google', (req, res) => {
    if (!enabled) return res.redirect('/login?error=google_unavailable');
    const state = randomBytes(16).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        state,
        nonce,
        verifier,
        exp: Date.now() + FLOW_MAX_AGE_MS,
      })
    ).toString('base64url');
    res.cookie(FLOW_COOKIE, `${payload}.${sign(sessionSecret, payload)}`, {
      ...flowCookieOptions,
      maxAge: FLOW_MAX_AGE_MS,
    });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return res.redirect(`${AUTH_URL}?${params}`);
  });
  app.get(CALLBACK_PATH, async (req, res) => {
    const fail = (code2) => {
      res.clearCookie(FLOW_COOKIE, flowCookieOptions);
      return res.redirect(`/login?error=${code2}`);
    };
    if (!enabled) return fail('google_unavailable');
    const flow = readFlow(req, sessionSecret);
    if (!flow) return fail('google_failed');
    if (req.query.error) return fail('google_cancelled');
    const { code, state } = req.query;
    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      !safeEqual(state, flow.state)
    ) {
      return fail('google_failed');
    }
    try {
      const tokenResponse = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: flow.verifier,
        }),
        signal: AbortSignal.timeout(1e4),
      });
      if (!tokenResponse.ok) return fail('google_failed');
      const claims = decodeIdToken((await tokenResponse.json()).id_token);
      const email =
        typeof claims?.email === 'string'
          ? claims.email.trim().toLowerCase()
          : '';
      if (
        !claims ||
        !ISSUERS.includes(claims.iss) ||
        claims.aud !== clientId ||
        !(claims.exp * 1e3 > Date.now()) ||
        !safeEqual(claims.nonce ?? '', flow.nonce) ||
        typeof claims.sub !== 'string' ||
        !claims.sub ||
        !(claims.email_verified === true || claims.email_verified === 'true') ||
        !email ||
        email.length > 254
      ) {
        return fail('google_failed');
      }
      let user = await User.findOne({ googleId: claims.sub });
      if (!user) {
        user = await User.findOne({ email });
        if (user) {
          user.googleId = claims.sub;
          await user.save();
        } else {
          const name =
            typeof claims.name === 'string' ? claims.name.trim() : '';
          user = await User.create({
            username: (name || email.split('@')[0]).slice(0, 80),
            email,
            googleId: claims.sub,
          });
        }
      }
      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
      });
      req.session.userId = String(user._id);
      req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
      await new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
      });
      res.clearCookie(FLOW_COOKIE, flowCookieOptions);
      return res.redirect('/');
    } catch (error) {
      console.error('Google sign-in failed:', error.name);
      return fail('google_failed');
    }
  });
}

// packages/server/serverSetup.js
import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
var publicDirectory = fileURLToPath(
  new URL('../client/dist/', import.meta.url)
);
var cookieName = 'recipeme.sid';
var cookieOptions = { httpOnly: true, sameSite: 'strict', path: '/' };
function configureServer({
  sessionStore,
  sessionSecret,
  appOrigin,
  production = false,
}) {
  if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  }
  const origin = new URL(appOrigin).origin;
  if (production && !origin.startsWith('https://')) {
    throw new Error('Production APP_ORIGIN must use HTTPS.');
  }
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
    return next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.get('origin') !== origin
    ) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    return next();
  });
  const parseJson = express.json({ limit: '8kb' });
  const parseRecipeJson = express.json({ limit: '64kb' });
  app.use((req, res, next) => {
    const parser =
      req.method === 'POST' && req.path === '/api/recipes'
        ? parseRecipeJson
        : parseJson;
    parser(req, res, next);
  });
  app.use(
    '/api',
    session({
      name: cookieName,
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        ...cookieOptions,
        secure: production,
        maxAge: 1e3 * 60 * 60 * 8,
      },
    })
  );
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1e3,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Try again in an hour.' },
  });
  return { app, loginLimiter, registerLimiter };
}
function finishServer(app, { clientDirectory = publicDirectory } = {}) {
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'API route not found.' })
  );
  app.use(express.static(clientDirectory));
  app.get(
    ['/', '/login', '/grocery-list', '/history', '/favorites', '/settings'],
    (_req, res) => {
      res.sendFile('index.html', { root: clientDirectory });
    }
  );
  app.use((error, req, res, _next) => {
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Invalid JSON.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Request is too large.' });
    console.error('Request failed:', error.name);
    return res
      .status(500)
      .json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}

// packages/server/app.js
var dummyHash = await bcrypt2.hash(
  'unused-password-for-timing-only',
  BCRYPT_ROUNDS
);
function createApp(options) {
  const { User, Recipe, production = false } = options;
  async function getAuthenticatedUser(req) {
    if (!req.session?.userId) return null;
    return User.findById(req.session.userId);
  }
  const { app, loginLimiter, registerLimiter } = configureServer(options);
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
  app.post('/api/recipes', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please log in to add a recipe.' });
    }
    const input = recipeInput(req.body || {});
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }
    try {
      const recipe = await Recipe.create(input.recipe);
      return res.status(201).json({
        recipe: {
          id: String(recipe._id),
          name: recipe.Name,
          image: recipe.Image,
          ingredients: recipe.Ingredients,
          instructions: recipe.Instructions,
          filters: normalizeRecipeFilters(recipe.Filters),
          averageRating: null,
          reviewCount: 0,
        },
      });
    } catch (error) {
      console.error('Recipe creation failed:', error.name);
      return res.status(503).json({
        error: 'Unable to save your recipe. Please try again.',
      });
    }
  });
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
      const filterGroups = /* @__PURE__ */ Object.create(null);
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
                generatedAt: /* @__PURE__ */ new Date(),
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
  app.get('/api/recipe-progress', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    const progress = user.recipeProgress || [];
    const legacyNames = [
      ...new Set(
        progress.filter((item) => !item.recipeId).map((item) => item.recipeName)
      ),
    ];
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
  app.post('/api/recipe-progress', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    const { recipeId, recipeName, status } = req.body || {};
    if (!['in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid recipe progress.' });
    }
    if (
      recipeId !== void 0 &&
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
    const now = /* @__PURE__ */ new Date();
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
      existing.completedAt = status === 'completed' ? now : void 0;
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
  app.delete('/api/recipe-progress/:recipeId', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    const recipeId = req.params.recipeId.toLowerCase();
    if (!/^[a-f\d]{24}$/.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe ID.' });
    }
    const recipe = await Recipe.findById(recipeId);
    user.recipeProgress = (user.recipeProgress || []).filter((item) =>
      item.recipeId
        ? String(item.recipeId).toLowerCase() !== recipeId
        : !recipe || item.recipeName !== recipe.Name
    );
    await user.save();
    return res.json({ recipeProgress: user.recipeProgress });
  });
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
      if (error.code === 11e3) {
        return res
          .status(409)
          .json({ error: 'Unable to register with those details.' });
      }
      throw error;
    }
  });
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
    const matches = await bcrypt2.compare(
      password,
      user?.password || dummyHash
    );
    if (!user || !matches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = String(user._id);
    req.session.cookie.maxAge =
      req.body.rememberMe === true
        ? 30 * 24 * 60 * 60 * 1e3
        : 8 * 60 * 60 * 1e3;
    await new Promise((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });
    return res.json({ user: publicUser(user) });
  });
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
    if (typeof note !== 'string' || note.length > 2e3) {
      return res.status(400).json({
        error: 'Review note must be text with at most 2000 characters.',
      });
    }
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
          createdAt: /* @__PURE__ */ new Date(),
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
        (key2) => req.body[key2] !== void 0 && !validList(req.body[key2])
      ) ||
      (notifications !== void 0 && !validNotifications(notifications))
    ) {
      return res.status(400).json({ error: 'Invalid settings.' });
    }
    user.username = username.trim();
    user.settings.servingSize = servingSize;
    user.settings.location = location.trim();
    user.settings.unitSystem = unitSystem;
    user.settings.preferredFilters = normalizeRecipeFilters(preferredFilters);
    for (const key2 of LIST_FIELDS) {
      if (req.body[key2] !== void 0) {
        user.settings[key2] = req.body[key2].map((item) => item.trim());
      }
    }
    if (notifications !== void 0) {
      user.settings.notifications = Object.fromEntries(
        NOTIFICATION_KEYS.map((key2) => [key2, notifications[key2]])
      );
    }
    await user.save();
    return res.json({
      settings: publicSettings(user),
      username: user.username,
    });
  });
  registerGoogleAuth(app, {
    User,
    clientId: options.googleClientId,
    clientSecret: options.googleClientSecret,
    appOrigin: options.appOrigin,
    sessionSecret: options.sessionSecret,
    production,
    fetchImpl: options.fetchImpl,
  });
  return finishServer(app, options);
}
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
var LIST_FIELDS = ['dietaryRestrictions', 'dislikes', 'allergies'];
var NOTIFICATION_DEFAULTS = {
  dailySuggestions: true,
  groceryItems: true,
  weeklySummary: false,
  marketing: false,
};
var NOTIFICATION_KEYS = Object.keys(NOTIFICATION_DEFAULTS);
function validList(value) {
  return (
    Array.isArray(value) &&
    value.length <= 30 &&
    value.every(
      (item) =>
        typeof item === 'string' && item.trim().length > 0 && item.length <= 60
    )
  );
}
function validNotifications(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    NOTIFICATION_KEYS.every((key2) => typeof value[key2] === 'boolean')
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
      LIST_FIELDS.map((key2) => [key2, [...(s[key2] || [])]])
    ),
    notifications: Object.fromEntries(
      NOTIFICATION_KEYS.map((key2) => [
        key2,
        n[key2] ?? NOTIFICATION_DEFAULTS[key2],
      ])
    ),
  };
}

// vercel/entry.js
var appPromise;
async function buildApp() {
  await connectDB();
  await userSchema_default.init();
  const app = createApp({
    User: userSchema_default,
    Recipe: recipeSchema_default,
    sessionStore: MongoStore.create({
      client: mongoose4.connection.getClient(),
    }),
    sessionSecret: process.env.SESSION_SECRET,
    appOrigin: process.env.APP_ORIGIN,
    production: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  app.set('trust proxy', 1);
  return app;
}
async function handler(req, res) {
  try {
    appPromise ??= buildApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    appPromise = void 0;
    console.error('API startup failed:', error);
    res.statusCode = 500;
    res.end('Server failed to start.');
  }
}
export { handler as default };
