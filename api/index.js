let appPromise;

async function buildApp() {
  const { default: mongoose } = await import('mongoose');
  const { default: MongoStore } = await import('connect-mongo');
  const { default: connectDB } = await import('../packages/server/database.ts');
  const { default: User } = await import('../packages/server/userSchema.ts');
  const { default: Recipe } =
    await import('../packages/server/recipeSchema.ts');
  const { createApp } = await import('../packages/server/app.js');

  await connectDB();
  await User.init();
  const app = createApp({
    User,
    Recipe,
    sessionStore: MongoStore.create({
      client: mongoose.connection.getClient(),
    }),
    sessionSecret: process.env.SESSION_SECRET,
    appOrigin: process.env.APP_ORIGIN,
    production: true,
  });
  app.set('trust proxy', 1);
  return app;
}

export default async function handler(req, res) {
  try {
    appPromise ??= buildApp();
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error('API startup failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`${error.name}: ${error.message}`);
  }
}
