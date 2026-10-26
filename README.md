# csc-3100 project

# RecipeMe

RecipeMe: a user puts in their meal preferences (could be dietary restrictions, cuisine type, dietary goals, time commitment, taste profile, specific food preferences, budget, store preferences, expertise, appliances, themed-food, serving size, amount of pots used)

- App will output recipe ideas based on preferences
- Each recipe will come with a grocery list (with stores nearby = - - where you can purchase the items), prioritize one store
- Save recipes that you really like to your favorites
- Rate recipes to change their recommendation frequency.
  Can add recipes to cart

Storyboards: https://docs.google.com/presentation/d/1b7oeCzfKdJEQcCVTSTVfzaZrkeR57z2XwsTsLqYWcfw/edit?usp=sharing

## Run locally

Install dependencies from the project root:

```bash
npm install
npm --prefix packages/client install
```

Set `MONGODB_URL` (or `MONGO_URI`) in the root `.env` file to your MongoDB connection string,
including the database name containing the `recipes` collection:

```env
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>/<database>
SESSION_SECRET=<random-secret-at-least-32-bytes-long>
```

Generate a session secret with `node -p "require('crypto').randomBytes(32).toString('hex')"`
and save the output as `SESSION_SECRET` in `.env`. Keep the existing database name
if your recipes are already populated (a URL without a database name uses `test`).

Start the API in one terminal from the project root:

```bash
npm run dev:server
```

Start the frontend in a second terminal from the project root:

```bash
npm run dev:client
```

Open the URL printed by Vite (`http://127.0.0.1:5173`). Vite forwards
`/api` requests to the API on port 3000. If you set a different `PORT` for the
API, update the target in `packages/client/vite.config.ts` to match. Development login expects the browser origin `http://127.0.0.1:5173`;
set `APP_ORIGIN` in `.env` if you use a different browser URL. Both authentication
and recipes use the same backend. `npm run dev` also starts that backend.

To serve the built frontend through the backend, run `npm run build`, then start
with `APP_ORIGIN=http://localhost:3000 npm start` and open `http://localhost:3000`.

Run `npm test` for authentication checks and `npm run test:recipes` for a read-only
integration check against the MongoDB configured in `.env`.

`GET /api/recipes` reads the MongoDB `recipes` collection. Both filter options
and recipe suggestions come exclusively from those records; there is no sample
data fallback. An empty collection shows an empty state, and a failed request
shows a retry option. Exact matches and closest matches use the loaded database
records. Reload the page to pick up later database changes.

For an empty database, the optional command below imports real recipes from
TheMealDB into the configured database. It writes recipe records, so run it only
when you intend to populate that database:

```bash
npx tsx packages/server/seed.ts
```

## Code Style:

This project follows the Google JavaScript Style Guide (https://google.github.io/styleguide/jsguide.html).
Code style will be enforced automatically via ESLint and Prettier.
