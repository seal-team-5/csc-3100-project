import { LOGIN_REQUIRED } from '../lib/auth';
import { FILTER_GROUPS } from '../../../shared/recipeFilters';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Recipe, RecipeFilter } from '../lib/recipes';

export default function CreateRecipeDialog({
  filterGroups,
  onClose,
  onCreated,
}: {
  filterGroups: Record<string, string[]>;
  onClose: () => void;
  onCreated: (recipe: Recipe) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [filters, setFilters] = useState<RecipeFilter[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  const splitLines = (value: string) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (
      !name.trim() ||
      !splitLines(ingredients).length ||
      !splitLines(instructions).length
    ) {
      setError(
        'Enter a recipe name, at least one ingredient, and at least one direction step.'
      );
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          image,
          ingredients: splitLines(ingredients),
          instructions: splitLines(instructions),
          filters,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? LOGIN_REQUIRED
            : data.error || 'Unable to save your recipe.'
        );
      onCreated(data.recipe);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to save your recipe.'
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  function toggleFilter(filter: RecipeFilter) {
    setFilters((current) =>
      current.some(
        (item) => item.type === filter.type && item.name === filter.name
      )
        ? current.filter(
            (item) => item.type !== filter.type || item.name !== filter.name
          )
        : [...current, filter]
    );
  }

  return (
    <dialog
      ref={dialog}
      className="recipe-modal create-recipe-modal"
      aria-labelledby="create-recipe-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting.current) onClose();
      }}
    >
      <button
        className="close-button"
        type="button"
        onClick={onClose}
        disabled={saving}
        aria-label="Close recipe form"
      >
        <img src="/design/close.svg" alt="" width="14" height="14" />
      </button>
      <form
        className="create-recipe-form"
        onSubmit={handleSubmit}
        aria-busy={saving}
      >
        <div className="create-recipe-heading">
          <h2 id="create-recipe-heading">Add a recipe</h2>
        </div>
        <p>Share a recipe with the RecipeMe community.</p>
        <fieldset disabled={saving} className="create-recipe-fields">
          <label htmlFor="new-recipe-name">Recipe name</label>
          <input
            id="new-recipe-name"
            autoFocus
            required
            maxLength={150}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Tomato pasta"
          />
          <label htmlFor="new-recipe-image">Image URL (optional)</label>
          <input
            id="new-recipe-image"
            type="url"
            pattern="https://.*"
            maxLength={2000}
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder="https://example.com/recipe.jpg"
            aria-describedby="recipe-image-help"
          />
          <small id="recipe-image-help">
            Use an HTTPS image link, or leave blank for a RecipeMe placeholder.
          </small>
          <label htmlFor="new-recipe-ingredients">Ingredients</label>
          <small id="recipe-ingredients-help">
            One ingredient per line, including the amount. Up to 50 ingredients.
          </small>
          <textarea
            id="new-recipe-ingredients"
            rows={4}
            required
            maxLength={6000}
            value={ingredients}
            onChange={(event) => setIngredients(event.target.value)}
            placeholder={'200 g pasta\n2 tomatoes\n1 tbsp olive oil'}
            aria-describedby="recipe-ingredients-help"
          />
          <label htmlFor="new-recipe-instructions">Directions</label>
          <small id="recipe-instructions-help">
            One step per line. Up to 30 steps.
          </small>
          <textarea
            id="new-recipe-instructions"
            rows={5}
            required
            maxLength={6000}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={
              'Boil the pasta.\nCook the tomatoes in olive oil.\nCombine and serve.'
            }
            aria-describedby="recipe-instructions-help"
          />
          {Object.keys(filterGroups).length > 0 && (
            <details className="create-recipe-filters">
              <summary>Preference filters (optional)</summary>
              <p>Select only preferences this recipe meets.</p>
              {Object.entries(filterGroups).map(([type, names]) => (
                <fieldset className="filter-group" key={type}>
                  <legend>
                    {FILTER_GROUPS.find((group) => group.type === type)
                      ?.label || type}
                  </legend>
                  <div className="filter-options">
                    {names.map((filterName) => {
                      const checked = filters.some(
                        (filter) =>
                          filter.type === type && filter.name === filterName
                      );
                      return (
                        <label
                          className={
                            checked ? 'filter-pill selected' : 'filter-pill'
                          }
                          key={filterName}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && filters.length >= 30}
                            onChange={() =>
                              toggleFilter({ type, name: filterName })
                            }
                          />
                          {filterName}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </details>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="create-recipe-error">
            {error}
          </p>
        )}
        <div className="create-recipe-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
