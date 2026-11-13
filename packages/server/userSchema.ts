import mongoose, { Schema } from 'mongoose';

/*
  Fetch via:
  const response = await fetch("/api/user");
*/

/* Ensure that both the type and schema are updated together! */
export type RecipeProgress = {
  recipeId?: mongoose.Types.ObjectId;
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
  generatedRecipes: {
    recipeId: mongoose.Types.ObjectId;
    recipeName: string;
    image: string;
    generatedAt: Date;
  }[];
  settings: {
    servingSize: number;
    location: string;
    unitSystem: 'us' | 'metric';
    preferredFilters: SavedFilter[];
    dietaryRestrictions: string[];
    dislikes: string[];
    allergies: string[];
    notifications: {
      dailySuggestions: boolean;
      groceryItems: boolean;
      weeklySummary: boolean;
      marketing: boolean;
    };
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
      dietaryRestrictions: { type: [String], default: [] },
      dislikes: { type: [String], default: [] },
      allergies: { type: [String], default: [] },
      notifications: {
        dailySuggestions: { type: Boolean, default: true },
        groceryItems: { type: Boolean, default: true },
        weeklySummary: { type: Boolean, default: false },
        marketing: { type: Boolean, default: false },
      },
    },

    generatedRecipes: {
      type: [
        {
          recipeId: {
            type: Schema.Types.ObjectId,
            ref: 'Recipe',
            required: true,
          },
          recipeName: { type: String, required: true },
          image: { type: String, default: '' },
          generatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    recipeProgress: {
      type: [
        {
          recipeId: { type: Schema.Types.ObjectId, ref: 'Recipe' },
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
