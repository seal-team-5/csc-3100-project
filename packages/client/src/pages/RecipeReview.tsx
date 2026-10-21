import { useState } from 'react'; //allows retrieval of updated states for components
import './RecipeReview.css'; //import css for styling
import type { FormEvent } from 'react'; //specify use of form element (grouping name, note, and rating)

export default function RecipeReview() {
  //component to be imported by button
  const [isOpen, setIsOpen] = useState(false); //useState to false makes form hidden
  const [recipeName, setRecipeName] = useState(''); // plan to store as string
  const [rating, setRating] = useState(5); // plan to store rating as number out of 5
  const [note, setNote] = useState(''); // note is string
  const [message, setMessage] = useState(''); // stores submission message

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); //stops page from normal submission behavior

    const review = {
      recipeName: recipeName.trim(),
      rating,
      note: note.trim(), //trim to remove whitespace
    };

    // Later, send this object to the backend. for now display on console for testing
    console.log(review);

    setMessage('Review captured for testing. It is not saved yet.');
    setIsOpen(false);
  }

  return (
    <section>
      <button onClick={() => setIsOpen(true)}>
        {' '}
        {/*display the form*/}
        Review a recipe!!
      </button>

      {isOpen && (
        <form className="review-form" onSubmit={handleSubmit}>
          {' '}
          {/*create the form and connection to handlesubmit */}
          <h2>Review a recipe</h2>
          <label htmlFor="recipe-name">Recipe name</label>{' '}
          {/* each input is labeled  using htmlFor*/}
          <input
            id="recipe-name"
            required
            maxLength={100}
            value={recipeName}
            onChange={(event) => setRecipeName(event.target.value)}
          />
          <label htmlFor="recipe-rating">Rating out of 5</label>
          <select
            id="recipe-rating"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <option key={score} value={score}>
                {score} {score === 1 ? 'star' : 'stars'}
              </option>
            ))}{' '}
            {/* closes loop and dropdown*/}
          </select>
          <label htmlFor="review-note">Review note</label>
          <textarea
            id="review-note"
            rows={4}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button type="submit">Submit review</button>
          <button type="button" onClick={() => setIsOpen(false)}>
            Cancel
          </button>
        </form>
      )}

      <p role="status">{message}</p>
    </section>
  );
}
