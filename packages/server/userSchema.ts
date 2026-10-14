import mongoose, { Schema } from 'mongoose';

/*
  Fetch via:
  const response = await fetch("/api/user");
*/

export type User = {
  username: string;
  email: string;
  phone: string;
  password: string; /* bcrypt hash; never a plaintext password */
};

const userSchema = new Schema<User>(
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
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    password: {
      type: String,
      required: true,
      select: false,
      // Routes hash passwords before saving; reject accidental plaintext writes.
      match: /^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/,
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

export default mongoose.models.User || mongoose.model<User>('User', userSchema);
