import 'dotenv/config';

import mongoose from 'mongoose';

let connection: Promise<typeof mongoose> | undefined;

export default async function connectDB() {
  const url = process.env.MONGO_URI || process.env.MONGODB_URL;

  if (!url) {
    throw new Error('Set MONGO_URI or MONGODB_URL in .env');
  }

  if (mongoose.connection.readyState === 1) return mongoose;

  if (!connection) {
    connection = mongoose.connect(url, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    await connection;
    console.log('Connected to MongoDB');
    return mongoose;
  } catch (error) {
    connection = undefined;
    throw error;
  }
}
