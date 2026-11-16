import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import connectDB from '../packages/server/database.ts';
import User from '../packages/server/userSchema.ts';
import Recipe from '../packages/server/recipeSchema.ts';
import { createApp } from '../packages/server/app.js';

let appPromise;

function getApp() {
  appPromise ??= (async () => {
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
  })().catch((error) => {
    appPromise = undefined; // retry on the next request
    throw error;
  });
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
