import { LogOut, MapPinned, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { AuthUser } from '../services/api';

const navItems = [
  { to: '/mapa', label: 'Vista de mapa' },
  { to: '/instituciones', label: 'Instituciones' },
  { to: '/proyectos', label: 'Proyectos' },
  { to: '/estudiantes', label: 'Estudiantes' },
  { to: '/dashboard', label: 'Dashboard' },
];

function getUserInitials(user: AuthUser | null): string {
  if (!user) return "US"; 
  const firstInitial = user.nombre ? user.nombre.charAt(0) : "";
  const lastInitial = user.apellido ? user.apellido.charAt(0) : "";
  return (firstInitial + lastInitial).toUpperCase() || "US";
}
interface HeaderProps {
  activePage: string;
  user: AuthUser | null;
}

export default function Header({ activePage, user }: HeaderProps){
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileNavOpen(false);
    navigate('/login/estudiante');
  };

  return (
    <header className="topbar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark">
          <MapPinned size={20} strokeWidth={2.5} />
        </div>
        <span>CSS Web</span>
      </div>

      {/* Nav desktop */}
      <nav className="topnav topnav-desktop" aria-label="Navegación principal">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `topnav-link ${isActive || activePage === item.to.slice(1) ? 'active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Acciones derecha */}
      <div className="topbar-actions">
        <div className="avatar-menu">
          <button
            className="avatar-button"
            aria-label="Abrir menú de cuenta"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span>{getUserInitials(user)}</span>
          </button>
          {menuOpen && (
            <div className="avatar-dropdown">
              <button className="dropdown-item logout-item" type="button" onClick={handleLogout}>
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>

        {/* Botón hamburguesa — solo visible en móvil vía CSS */}
        <button
          className="hamburger-btn"
          aria-label="Abrir menú de navegación"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Nav móvil — drawer desplegable */}
      {mobileNavOpen && (
        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mobile-nav-link ${isActive || activePage === item.to.slice(1) ? 'active' : ''}`
              }
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}