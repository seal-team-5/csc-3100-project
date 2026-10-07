import mongoose, { Schema } from 'mongoose';

export type Filter = {
  name: string;
  type: string;
};

export type Recipe = {
  Image: string;
  Name: string;
  Ingredients: string[];
  Instructions: string[];
  Filters: Filter[];
};

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
      type: [{ name: String, type: String }],
      required: true,
    },
  },
  { collection: 'recipes' }
);

export default mongoose.models.Recipe ||
  mongoose.model<Recipe>('Recipe', recipeSchema);
