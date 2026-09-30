import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage'; 
import MapaVistaPage from './pages/MapaVistaPage';
import { InstitucionesPage, InstitucionDetallePage } from './pages/InstitucionesPage';
import { ProyectosPage, ProyectoDetallePage } from './pages/ProyectosPage';
import EstudiantesPage from './pages/EstudiantesPage';
import DashboardPage from './pages/DashboardPage';
import type { AuthUser } from './services/api';

function Shell({ activePage }: { activePage: string }) {
  const [user] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  return (
    <div className="app-shell">
      <Header activePage={activePage} user={user} />
      <main>
        <Routes>
          <Route path="/mapa" element={<MapaVistaPage />} />
          <Route path="/instituciones" element={<InstitucionesPage />} />
          <Route path="/instituciones/:id" element={<InstitucionDetallePage />} />
          <Route path="/proyectos" element={<ProyectosPage />} />
          <Route path="/proyectos/:id" element={<ProyectoDetallePage />} />
          <Route path="/estudiantes" element={<EstudiantesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/mapa" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const activePage = location.pathname.split('/')[1] || 'login';

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login/estudiante" replace />} />
      <Route path="/login/docente" element={<LoginPage tipo="docente" />} />
      <Route path="/login/estudiante" element={<LoginPage tipo="estudiante" />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={<Shell activePage={activePage} />} />
    </Routes>
  );
}
