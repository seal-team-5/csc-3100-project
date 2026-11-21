import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Login.css';

const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_unavailable: 'Google sign-in is not set up on this server.',
  google_email_exists:
    'An account with this email already exists. Log in with your password instead.',
  google_failed: 'Google sign-in failed. Please try again.',
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    GOOGLE_ERRORS[searchParams.get('error') ?? ''] ?? ''
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const response = await fetch(
        creatingAccount ? '/api/auth/register' : '/api/auth/login',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            creatingAccount
              ? { username, phone, email, password }
              : { email, password }
          ),
        }
      );
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || 'Unable to submit. Please try again.');
        return;
      }
      setPassword('');
      if (creatingAccount) {
        setCreatingAccount(false);
        setMessage('Account created. Sign in with your email and password.');
        return;
      }
      navigate('/', { replace: true });
    } catch {
      setError('Cannot reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="login-page">
      <h1>{creatingAccount ? 'Create an account' : 'Welcome to RecipeMe'}</h1>
      <form onSubmit={handleSubmit} aria-busy={submitting}>
        {creatingAccount && (
          <>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="nickname"
              required
              maxLength={80}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={submitting}
            />
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={40}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={submitting}
            />
          </>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          title="Password"
          type="password"
          autoComplete={creatingAccount ? 'new-password' : 'current-password'}
          required
          minLength={creatingAccount ? 8 : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          aria-describedby={error ? 'login-error' : undefined}
        />
        {creatingAccount && (
          <small>Use at least 8 characters for your password.</small>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p id="login-error" role="alert">
            {error}
          </p>
        )}
        <div className="login-actions">
          <button type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : creatingAccount
                ? 'Create account'
                : 'Sign in'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setCreatingAccount(!creatingAccount);
              setError('');
              setMessage('');
              setPassword('');
            }}
          >
            {creatingAccount ? 'Back to sign in' : 'Create account'}
          </button>
        </div>
      </form>
      <div className="login-divider" role="separator">
        or
      </div>
      {/* A normal link: the server redirects to Google and back. */}
      <a className="google-button" href="/api/auth/google">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
          />
          <path
            fill="#FBBC05"
            d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
          />
        </svg>
        Continue with Google
      </a>
    </section>
  );
}