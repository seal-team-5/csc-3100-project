import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import connectDB from '../packages/server/database.ts';
import User from '../packages/server/userSchema.ts';
import Recipe from '../packages/server/recipeSchema.ts';
import { createApp } from '../packages/server/app.js';

let appPromise;

async function buildApp() {
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
    res.end('Server failed to start.');
  }
}