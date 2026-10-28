import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
    </section>
  );
}
