import mongoose, { Schema } from 'mongoose';

export type User = {
  username: string;
  email: string;
  phone: string;
  password: string; /* hashed password */
};

const userSchema = new Schema<User>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { collection: 'users' }
);

export default mongoose.models.User || mongoose.model<User>('User', userSchema);
