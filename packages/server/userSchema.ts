import mongoose, { Schema } from 'mongoose';

/*
  Fetch via:
  const response = await fetch("/api/user");
*/

/* Ensure that both the type and schema are updated together! */

export type User = {
  username: string;
  email: string;
  password: string; /* bcrypt hash; never a plaintext password */
  favorites: string[]; /* array of recipe IDs */
  settings: {
    evilSetting: boolean;
  };
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
    password: {
      type: String,
      required: true,
      select: false,
      // Routes hash passwords before saving; reject accidental plaintext writes.
      match: /^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/,
    },
    favorites: { type: [String], default: [] },
    settings: {
      evilSetting: { type: Boolean, default: false },
    },
  },
  {
    collection: 'users',
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Partial<User>).password;
        return ret;
      },
    },
  }
);

export default mongoose.models.User || mongoose.model<User>('User', userSchema);
