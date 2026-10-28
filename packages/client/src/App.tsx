import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Outlet,
} from 'react-router-dom';
import Home from './pages/Home';
import History from './pages/History';
import Login from './pages/Login';
import Favorites from './pages/Favorites';
import './App.css';

function Layout() {
  const pages = ['Home', 'Grocery List', 'History', 'Favorites', 'Login'];
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
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
