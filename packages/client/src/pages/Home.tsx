import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RecipeFinder from './RecipeFinder';

type CurrentUser = {
  id: string;
  username: string;
  email: string;
};

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setUser((await response.json()).user);
      })
      .catch(() => {
        /* Guests can still view the home page. */
      });
    return () => controller.abort();
  }, []);
  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
      setUser(null);
      navigate('/login', { replace: true });
    } catch {
      setError('Unable to sign out. Please try again.');
    }
  }
  return (
    <>
      {user && (
        <>
          <p>Welcome, {user.username}.</p>
          <button onClick={logout}>Sign out</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <RecipeFinder />
    </>
  );
}
