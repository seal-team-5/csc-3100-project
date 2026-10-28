import mongoose, { Schema } from 'mongoose';

/*
  Fetch via:
  const response = await fetch("/api/user");
*/

/* Ensure that both the type and schema are updated together! */
export type RecipeProgress = {
  recipeName: string;
  status: 'in-progress' | 'completed';
  startedAt: Date;
  completedAt?: Date;
};

export type SavedFilter = {
  name: string;
  type: string;
};

export type User = {
  username: string;
  email: string;
  password: string; /* bcrypt hash; never a plaintext password */
  favorites: string[]; /* array of recipe IDs */
  recipeProgress: RecipeProgress[];
  settings: {
    servingSize: number;
    location: string;
    unitSystem: 'us' | 'metric';
    preferredFilters: SavedFilter[];
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
      servingSize: { type: Number, default: 2, min: 1, max: 20 },
      location: { type: String, default: '', trim: true, maxlength: 100 },
      unitSystem: { type: String, enum: ['us', 'metric'], default: 'us' },
      preferredFilters: {
        type: [
          {
            name: { type: String, maxlength: 60 },
            type: { type: String, maxlength: 60 },
          },
        ],
        default: [],
      },
    },

    recipeProgress: {
      type: [
        {
          recipeName: { type: String, required: true },
          status: {
            type: String,
            enum: ['in-progress', 'completed'],
            required: true,
          },
          startedAt: { type: Date, default: Date.now },
          completedAt: { type: Date },
        },
      ],
      default: [],
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
