// Google sign-in using the server-side OAuth 2.0 authorization-code flow
// (with PKCE, state and nonce). No script from Google is loaded in the
// browser, so the strict Content-Security-Policy does not need to change.
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const FLOW_COOKIE = 'recipeme.oauth';
const FLOW_MAX_AGE_MS = 10 * 60 * 1000;
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const CALLBACK_PATH = '/api/auth/google/callback';

function sign(secret, payload) {
  return createHmac('sha256', secret)
    .update(`google-oauth:${payload}`)
    .digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

// The flow cookie is separate from the session cookie because the session
// cookie is SameSite=Strict and the browser will not send it when Google
// redirects back to us.
function readFlow(req, secret) {
  const raw = readCookie(req, FLOW_COOKIE);
  if (!raw) return null;
  const [payload, signature] = raw.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(secret, payload))) {
    return null;
  }
  try {
    const flow = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return flow.exp > Date.now() ? flow : null;
  } catch {
    return null;
  }
}

function decodeIdToken(idToken) {
  if (typeof idToken !== 'string') return null;
  try {
    // The token comes straight from Google's token endpoint over TLS, so its
    // signature does not need to be checked again (per Google's docs). The
    // claims are still validated below.
    return JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64url').toString()
    );
  } catch {
    return null;
  }
}

export function registerGoogleAuth(
  app,
  {
    User,
    clientId,
    clientSecret,
    appOrigin,
    sessionSecret,
    production = false,
    fetchImpl = fetch,
  }
) {
  const enabled = Boolean(clientId && clientSecret);
  const redirectUri = new URL(CALLBACK_PATH, appOrigin).href;
  const flowCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: production,
    path: '/api/auth/google',
  };

  // Step 1: send the browser to Google.
  app.get('/api/auth/google', (req, res) => {
    if (!enabled) return res.redirect('/login?error=google_unavailable');

    const state = randomBytes(16).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        state,
        nonce,
        verifier,
        exp: Date.now() + FLOW_MAX_AGE_MS,
      })
    ).toString('base64url');

    res.cookie(FLOW_COOKIE, `${payload}.${sign(sessionSecret, payload)}`, {
      ...flowCookieOptions,
      maxAge: FLOW_MAX_AGE_MS,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return res.redirect(`${AUTH_URL}?${params}`);
  });

  // Step 2: Google sends the browser back here with a one-time code.
  app.get(CALLBACK_PATH, async (req, res) => {
    const fail = (code) => {
      res.clearCookie(FLOW_COOKIE, flowCookieOptions);
      return res.redirect(`/login?error=${code}`);
    };

    if (!enabled) return fail('google_unavailable');
    const flow = readFlow(req, sessionSecret);
    if (!flow) return fail('google_failed');
    if (req.query.error) return fail('google_cancelled');

    const { code, state } = req.query;
    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      !safeEqual(state, flow.state)
    ) {
      return fail('google_failed');
    }

    try {
      const tokenResponse = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: flow.verifier,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!tokenResponse.ok) return fail('google_failed');

      const claims = decodeIdToken((await tokenResponse.json()).id_token);
      const email =
        typeof claims?.email === 'string'
          ? claims.email.trim().toLowerCase()
          : '';
      if (
        !claims ||
        !ISSUERS.includes(claims.iss) ||
        claims.aud !== clientId ||
        !(claims.exp * 1000 > Date.now()) ||
        !safeEqual(claims.nonce ?? '', flow.nonce) ||
        typeof claims.sub !== 'string' ||
        !claims.sub ||
        !(claims.email_verified === true || claims.email_verified === 'true') ||
        !email ||
        email.length > 254
      ) {
        return fail('google_failed');
      }

      // Find the account by Google ID, otherwise create a new one. An existing
      // account with the same email is never linked automatically: emails are
      // not verified at registration, so linking could hand a pre-registered
      // account to an attacker. CHANGED FOR SELKALAI'S RECCOMENDATION
      let user = await User.findOne({ googleId: claims.sub });
      if (!user) {
        if (await User.findOne({ email })) return fail('google_email_exists');
        const name = typeof claims.name === 'string' ? claims.name.trim() : '';
        user = await User.create({
          username: (name || email.split('@')[0]).slice(0, 80),
          email,
          googleId: claims.sub,
        });
      }

      // Same session handling as the password login route.
      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
      });
      req.session.userId = String(user._id);
      req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
      await new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
      });

      res.clearCookie(FLOW_COOKIE, flowCookieOptions);
      return res.redirect('/');
    } catch (error) {
      console.error('Google sign-in failed:', error.name);
      return fail('google_failed');
    }
  });
}
