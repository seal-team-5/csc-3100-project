# csc-3100 project

# RecipeMe

RecipeMe: a user puts in their meal preferences (could be dietary restrictions, cuisine type, dietary goals, time commitment, taste profile, specific food preferences, budget, store preferences, expertise, appliances, themed-food, serving size, amount of pots used)

- App will output recipe ideas based on preferences
- Each recipe will come with a grocery list (with stores nearby = - - where you can purchase the items), prioritize one store
- Save recipes that you really like to your favorites
- Rate recipes to change their recommendation frequency.
  Can add recipes to cart

Storyboards: https://docs.google.com/presentation/d/1b7oeCzfKdJEQcCVTSTVfzaZrkeR57z2XwsTsLqYWcfw/edit?usp=sharing

## Code Style:

This project follows the Google JavaScript Style Guide (https://google.github.io/styleguide/jsguide.html).
Code style will be enforced automatically via ESLint and Prettier.

## Login page

The React login page at `/login` contains a Welcome to RecipeMe heading, Email and Password fields, and adjacent Sign in and Create account buttons. Create account opens a form for username, phone, email, and password; successful registration returns to sign-in with a confirmation message. It supports loading, invalid-credential, and network-error states. Successful login redirects home, where the authenticated username and Sign out button verify the session. The page uses the default 8-hour session.

### Try login without MongoDB

Run `npm run dev:demo` at the project root and `npm --prefix packages/client run dev` in a second terminal. Visit http://127.0.0.1:5173/login and sign in with:

- Email: `demo@recipeme.test`
- Password: `RecipeMe demo password!`

This explicit local-only mode uses the real bcrypt functions and user-schema validation, with in-memory user documents and sessions. It does not read `.env`, connect to a cluster, or persist data. Correct login redirects Home and shows `Welcome, Demo Cook.`; Sign out clears the session. Users and sessions reset on restart. It cannot run in production mode and listens only on this computer. Normal `npm start` and `npm run dev` still require MongoDB and never create the demo account.

### Run locally

Use Node.js 22.18+ and MongoDB (local or Atlas).

1. At the project root, run `npm install` and `npm --prefix packages/client ci`.
2. Copy `.env.example` to `.env`. Set `MONGO_URI` to your MongoDB connection string.
3. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and set `SESSION_SECRET` to the output. Keep `.env` private.
4. For development, use `PORT=3000` and `APP_ORIGIN=http://127.0.0.1:5173` in `.env`.
5. In one terminal at the root, run `npm run dev` for the API.
6. In another terminal at the root, run `npm --prefix packages/client run dev`. Visit http://127.0.0.1:5173/login. Vite proxies `/api` to the backend, preserving the browser origin and session cookie.

If port 5173 is occupied, stop the other server or update both the Vite port and `APP_ORIGIN` together. Do not use Vite preview to test authentication; it has no API proxy.

### Create a test user

Use an existing bcrypt account, or while visiting the running app open browser developer tools and run this with throwaway test credentials:

```js
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'Test Cook',
    email: 'cook@example.com',
    phone: '555-0100',
    password: 'my unique test password 123',
  }),
});
console.log(response.status, await response.json());
```

A 201 response creates the account; it does not automatically sign in. The existing schema requires phone. No demo user or default password is inserted automatically.

### Security and verification

- Registration hashes passwords with the established `bcrypt` library at cost 12; login uses `bcrypt.compare`. No custom cryptography. The schema rejects plaintext and excludes hashes from JSON and normal queries.
- Passwords are never trimmed. New passwords require at least 8 characters and at most 72 UTF-8 bytes (bcrypt's input limit).
- `express-session` and `connect-mongo` store sessions on the server. Cookies are HttpOnly and SameSite=Strict, and Secure in production. Login rotates the session ID; logout destroys the session. No passwords or session tokens are stored in localStorage.
- Remember me selects a 30-day session; otherwise the session lasts 8 hours. It never saves the password. Users can sign in independently on multiple devices.
- Login and registration have separate IP rate limits. Failed login uses a generic message. Origin validation rejects cross-origin writes.
- Existing plaintext accounts require a deliberate password reset/migration. Clean duplicate and mixed-case emails before creating the unique email index.
- Run `npm test` for bcrypt, schema, session rotation, cookie duration, logout, origin, and rate-limit checks. These use a fake user repository and test-only memory sessions; real MongoDB still needs a local end-to-end check.
- Run `npm --prefix packages/client run build` and `npm --prefix packages/client run lint` for frontend validation.

### Serve the built app

Run `npm --prefix packages/client run build`. Set `APP_ORIGIN=http://127.0.0.1:3000` for a local combined-server test, then run `npm start` at the root and visit http://127.0.0.1:3000/login. Express serves only the built `packages/client/dist` files and supports direct navigation to React routes.

For deployment, use HTTPS, `NODE_ENV=production`, an exact public HTTPS `APP_ORIGIN`, and a random secret in your host's secret settings. HTTPS provides transport encryption; bcrypt provides one-way password hashing. When TLS terminates at a proxy, set `TRUST_PROXY` to the actual trusted proxy network. Multiple API processes need a shared rate-limit store; the initial limiter is per process.

| Endpoint                  | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `POST /api/auth/register` | Create an account: username, email, phone, password |
| `POST /api/auth/login`    | Verify email/password; optional boolean rememberMe  |
| `GET /api/auth/me`        | Read current user or return 401                     |
| `POST /api/auth/logout`   | Destroy the current session                         |

Write requests must include an `Origin` matching `APP_ORIGIN`. Browsers send it automatically for these POST requests; set it explicitly in API clients.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Express sessions](https://expressjs.com/en/resources/middleware/session/), [Vite development proxy](https://vite.dev/config/server-options#server-proxy).
