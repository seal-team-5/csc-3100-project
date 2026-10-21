import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Settings from './Settings';

function App() {
  const pages = [
    'Home',
    'Recipes',
    'History',
    'Favorites',
    'Settings',
    'Login',
  ];

  return (
    <BrowserRouter>
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

      <main>
        <Routes>
          <Route path="/" element={<h1>Home</h1>} />
          <Route path="/recipes" element={<h1>Recipes</h1>} />
          <Route path="/history" element={<h1>History</h1>} />
          <Route path="/favorites" element={<h1>Favorites</h1>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
