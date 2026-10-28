import express from 'express';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';

const publicDirectory = fileURLToPath(
  new URL('../client/dist/', import.meta.url)
);
export const cookieName = 'recipeme.sid';
export const cookieOptions = { httpOnly: true, sameSite: 'strict', path: '/' };

// Server configuration lives here so app.js can focus on the authentication steps.
export function configureServer({
  sessionStore,
  sessionSecret,
  appOrigin,
  production = false,
}) {
  if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  }
  const origin = new URL(appOrigin).origin;
  if (production && !origin.startsWith('https://')) {
    throw new Error('Production APP_ORIGIN must use HTTPS.');
  }
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Reject cross-origin writes, including login CSRF. Browser fetch sends Origin.
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.get('origin') !== origin
    ) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.use(
    '/api',
    session({
      name: cookieName,
      secret: sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        ...cookieOptions,
        secure: production,
        maxAge: 1000 * 60 * 60 * 8,
      },
    })
  );
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Try again in an hour.' },
  });
  return { app, loginLimiter, registerLimiter };
}

// Register these last: React pages, unknown API routes, and safe error responses.
export function finishServer(app, { clientDirectory = publicDirectory } = {}) {
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'API route not found.' })
  );
  app.use(express.static(clientDirectory));
  app.get(
    ['/', '/login', '/grocery-list', '/history', '/favorites'],
    (_req, res) => {
      res.sendFile('index.html', { root: clientDirectory });
    }
  );
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ error: 'Invalid JSON.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Request is too large.' });
    // Do not log request bodies, passwords, or database details.
    console.error('Request failed:', error.name);
    return res
      .status(500)
      .json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
