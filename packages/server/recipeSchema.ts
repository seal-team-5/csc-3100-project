import mongoose, { Schema } from 'mongoose';

/*
  Fetch via:
  const response = await fetch("/api/recipes");
*/

export type Filter = {
  name: string;
  type: string;
};

export type Review = {
  userId: mongoose.Types.ObjectId;
  rating: number;
  note: string;
  createdAt: Date;
};

export type Recipe = {
  Image: string;
  Name: string;
  Ingredients: string[];
  Instructions: string[];
  Filters: Filter[];
  Reviews: Review[];
};

const reviewSchema = new Schema<Review>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number.',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const recipeSchema = new Schema<Recipe>(
  {
    Image: {
      type: String,
      required: true,
      trim: true,
    },
    Name: {
      type: String,
      required: true,
      trim: true,
    },
    Ingredients: {
      type: [String],
      required: true,
      trim: true,
    },
    Instructions: {
      type: [String],
      required: true,
      trim: true,
    },
    Filters: {
      type: [{ name: String, type: { type: String } }],
      required: true,
    },
    Reviews: {
      type: [reviewSchema],
      default: [],
    },
  },
  { collection: 'recipes', optimisticConcurrency: true }
);

export default mongoose.models.Recipe ||
  mongoose.model<Recipe>('Recipe', recipeSchema);
