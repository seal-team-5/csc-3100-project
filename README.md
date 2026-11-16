# csc-3100 project ![CI](https://github.com/seal-team-5/scheduling-project/actions/workflows/ci-testing.yml/badge.svg)

# RecipeMe

RecipeMe: a user puts in their meal preferences (could be dietary restrictions, cuisine type, dietary goals, time commitment, taste profile, specific food preferences, budget, store preferences, expertise, appliances, themed-food, serving size, amount of pots used)

- App will output recipe ideas based on preferences
- Each recipe will come with a grocery list (with stores nearby = - - where you can purchase the items), prioritize one store
- Save recipes that you really like to your favorites
- Rate recipes to change their recommendation frequency.
  Can add recipes to cart

Storyboards: https://docs.google.com/presentation/d/1b7oeCzfKdJEQcCVTSTVfzaZrkeR57z2XwsTsLqYWcfw/edit?usp=sharing
Tech Specs: https://docs.google.com/document/d/1pdIhC4JA-qxDZK-3LEjxrh3H4m4STZ7NmyCCVDjdrKY/edit?tab=t.0

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

`GET /api/user` returns the currently signed-in user’s public account data,
including their saved favorite recipe IDs. Requests require an active session;
users who are not signed in receive an unauthorized response.

`POST /api/favorites` adds or removes a recipe from the signed-in user’s
favorites. The request body must include a valid MongoDB recipe ID:

```json
{ "recipeId": "..." }
```

If the recipe is already saved, the endpoint removes it; otherwise, it adds it.
The response returns the updated favorites array. Favorites are stored on the
user document as recipe IDs, while the Favorites page loads recipe summaries
from `GET /api/recipes?view=summary` and displays recipes with matching IDs.

For an empty database, the optional command below imports real recipes from
TheMealDB into the configured database. It writes recipe records, so run it only
when you intend to populate that database:

```bash
npx tsx packages/server/seed.ts
```

## Deployment (Vercel)

The frontend is served as static files from `packages/client/dist`, and the
Express API runs as a single Vercel serverless function (`api/index.js`) that
Vercel reaches through the `/api/*` rewrite in `vercel.json`.

Set these environment variables in Vercel (Settings, Environment Variables,
Production), then redeploy:

| Variable         | Value                                                           |
| ---------------- | --------------------------------------------------------------- |
| `MONGO_URI`      | MongoDB Atlas connection string, including the database name    |
| `SESSION_SECRET` | Random secret, at least 32 bytes                                |
| `APP_ORIGIN`     | Exact production URL, for example `https://your-app.vercel.app` |

In MongoDB Atlas, open Network Access and allow `0.0.0.0/0`, because Vercel
uses changing IP addresses. Leave Root Directory empty in the Vercel project
settings so the repository root is used.

### Rebuilding the API bundle

`api/index.js` is a generated file. Vercel cannot run the server's TypeScript
files directly, so `npm run build:api` bundles `vercel/entry.js` and the server
code into plain JavaScript. The generated file is committed to the repository.

After changing anything in `packages/server`, `packages/shared`, or `vercel/`,
run:

```bash
npm run build:api
git add api/index.js
```

Client-only changes do not need this step. A pre-commit hook in `.githooks/`
does it automatically when server files are part of a commit. It is enabled by
`npm install`, or manually with `git config core.hooksPath .githooks`.

## Code Style:

This project follows the Google JavaScript Style Guide (https://google.github.io/styleguide/jsguide.html).
Code style will be enforced automatically via ESLint and Prettier.
