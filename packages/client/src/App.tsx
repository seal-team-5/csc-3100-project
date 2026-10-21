import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Outlet,
  useNavigate,
} from 'react-router-dom';
import Login from './pages/Login';
import './App.css';
import RecipeReview from './pages/RecipeReview';

type CurrentUser = { id: string; username: string; email: string };

function Home() {
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
      <h1>Home</h1>
      <RecipeReview /> {/*temporary review button till we get a recipe card*/}
      {user && (
        <>
          <p>Welcome, {user.username}.</p>
          <button onClick={logout}>Sign out</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function Layout() {
  const pages = ['Home', 'Recipes', 'History', 'Favorites', 'Login'];
  return (
    <>
      <nav className="navbar">
        <h2>RecipeMe</h2>
        <div className="nav-links">
          {pages.map((page) => (
            <Link
              key={page}
              to={page === 'Home' ? '/' : `/${page.toLowerCase()}`}
            >
              {page}
            </Link>
          ))}
        </div>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipes" element={<h1>Recipes</h1>} />
          <Route path="/history" element={<h1>History</h1>} />
          <Route path="/favorites" element={<h1>Favorites</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
