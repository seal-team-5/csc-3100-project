// Local demo only. Users and sessions disappear when this process stops.
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import UserModel from './userSchema.ts';
import { hashPassword } from './password.js';
import { createApp } from './app.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo mode is only for local development.');
}

// Use the real schema and bcrypt, but keep the user documents in memory.
const users = new Map();
const User = {
  async create(data) {
    if (users.has(data.email)) {
      throw Object.assign(new Error('Duplicate email'), { code: 11000 });
    }
    const user = new UserModel(data);
    await user.validate();
    users.set(user.email, user);
    return user;
  },
  findOne({ email }) {
    return { select: async () => users.get(email) || null };
  },
  async findById(id) {
    return [...users.values()].find((user) => String(user._id) === id) || null;
  },
};

await User.create({
  username: 'Demo Cook',
  email: 'demo@recipeme.test',
  phone: '555-0100',
  password: await hashPassword('RecipeMe demo password!'),
});

const app = createApp({
  User,
  sessionStore: new session.MemoryStore(),
  sessionSecret: randomBytes(32).toString('hex'),
  appOrigin: 'http://127.0.0.1:5173',
});
// Loopback only. Normal npm start/dev always use the MongoDB backend instead.
app.listen(3000, '127.0.0.1', () => {
  console.log('Local demo API ready. No MongoDB connection is used.');
  console.log('Open http://127.0.0.1:5173/login');
  console.log('Email: demo@recipeme.test');
  console.log('Password: RecipeMe demo password!');
  console.log('Demo users and sessions reset when you stop this server.');
});
