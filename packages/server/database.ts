import mongoose from 'mongoose';

/** Reuse the active connection. Mongoose also handles concurrent connections. */
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose;
  const url = process.env.MONGO_URI;
  if (!url) throw new Error('MONGO_URI is required.');
  return mongoose.connect(url);
};

export default connectDB;
