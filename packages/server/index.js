import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import connectDB from './database.ts';
import User from './userSchema.ts';
import Recipe from './recipeSchema.ts';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
if (!process.env.MONGO_URI && !process.env.MONGODB_URL) {
  throw new Error('Set MONGO_URI or MONGODB_URL in .env.');
}
if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.startsWith('replace-with-') ||
  Buffer.byteLength(process.env.SESSION_SECRET) < 32
) {
  throw new Error(
    'Set SESSION_SECRET to a random secret of at least 32 bytes.'
  );
}
if (production && !process.env.APP_ORIGIN)
  throw new Error('Set APP_ORIGIN to your public HTTPS origin.');
await connectDB();
// Ensures unique email enforcement exists before accepting registrations.
await User.init();
const sessionStore = MongoStore.create({
  client: mongoose.connection.getClient(),
});
sessionStore.on('error', (error) =>
  console.error('Session store failed:', error.name)
);
const app = createApp({
  User,
  Recipe,
  sessionStore,
  sessionSecret: process.env.SESSION_SECRET,
  appOrigin:
    process.env.APP_ORIGIN ||
     (production ? `https://localhost:${port}` : 'http://localhost:5173'),
  production,
});
// Set an explicit trusted proxy network only when your HTTPS deployment needs it.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
app.listen(port, () => console.log(`RecipeMe listening on port ${port}`));
