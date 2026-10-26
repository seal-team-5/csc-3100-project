import 'dotenv/config';
import mongoose from 'mongoose';

let connection: Promise<typeof mongoose> | undefined;

/**
 * Makes a connection to a MongoDB database. If a connection already exists, does nothing
 * Call this function before all api routes
 * @returns {Promise<typeof mongoose>}
 */

const connectDB = async () => {
  const url = process.env.MONGO_URI;
  if (!url) {
    throw new Error('Set MONGO_URI or MONGODB_URL in .env');
  }

  if (mongoose.connection.readyState === 1) return mongoose;

  if (!connection) {
    connection = mongoose.connect(url, { serverSelectionTimeoutMS: 10000 });
  }

  try {
    return await connection;
  } finally {
    connection = undefined;
  }
};

export default connectDB;
