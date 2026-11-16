import { useState } from 'react';
import type { RecipeSummary } from '../lib/recipes';

export function RecipeImage({
  image,
  name,
  className = '',
  loading = 'lazy',
}: {
  image: string;
  name: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [failed, setFailed] = useState(false);
  return image && !failed ? (
    <img
      className={className}
      src={image}
      loading={loading}
      decoding="async"
      alt={name}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`recipe-image-placeholder ${className}`}
      role="img"
      aria-label={`No image available for ${name}`}
    >
      <span>RecipeMe</span>
    </div>
  );
}

export default function RecipeCard({
  recipe,
  onOpen,
}: {
  recipe: RecipeSummary;
  onOpen: (recipe: RecipeSummary) => void;
}) {
  return (
    <article className="recipe-card">
      <button
        className="recipe-card-button"
        onClick={() => onOpen(recipe)}
        type="button"
        aria-label={`View ingredients and directions for ${recipe.name}`}
      >
        <RecipeImage
          image={recipe.image}
          name={recipe.name}
          className="recipe-card-image"
        />
        <div className="recipe-card-body">
          <h3 title={recipe.name}>{recipe.name}</h3>
          <span className="recipe-card-rating">
            {recipe.averageRating
              ? `★ ${recipe.averageRating.toFixed(1)} (${recipe.reviewCount})`
              : 'No ratings yet'}
          </span>
          <span className="recipe-card-link">View Ingredients</span>
        </div>
      </button>
    </article>
  );
}
