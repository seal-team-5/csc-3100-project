import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Outlet,
  useLocation,
} from 'react-router-dom';
import Home from './pages/Home';
import History from './pages/History';
import Login from './pages/Login';
import Favorites from './pages/Favorites';
import Settings from './pages/Settings';
import './App.css';

function Layout() {
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(false);

  // Re-check the session whenever the route changes, ex) after login/logout)
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then((response) => setLoggedIn(response.ok))
      .catch(() => {
        // ignore aborted & failed requests
      });
    return () => controller.abort();
  }, [location.pathname]);

  const pages = [
    'Home',
    'Grocery List',
    'History',
    'Favorites',
    'Settings',
    ...(loggedIn ? [] : ['Login']),
  ];
  return (
    <>
      <nav className="navbar">
        <h2>RecipeMe</h2>
        <div className="nav-links">
          {pages.map((page) => (
            <NavLink
              key={page}
              end
              to={
                page === 'Home'
                  ? '/'
                  : `/${page.toLowerCase().replaceAll(' ', '-')}`
              }
            >
              {page}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/grocery-list" element={<h1>Grocery List</h1>} />
          <Route path="/history" element={<History />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
