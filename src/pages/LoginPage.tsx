import { Building2, Eye, EyeOff, GraduationCap, Layers3, Lock, Mail} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/ui';
import { loginUser, saveSession } from '../services/api';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 99999,
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: type === 'success' ? '#f0fff4' : '#fff5f5',
      border: `1px solid ${type === 'success' ? '#9ae6b4' : '#feb2b2'}`,
      borderRadius: '8px', padding: '0.875rem 1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '250px', maxWidth: '350px',
      animation: 'slideIn 0.3s ease',
    }}>
      <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>
        {type === 'success' ? '✅' : '❌'}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: type === 'success' ? '#2f855a' : '#c53030', lineHeight: 1.4 }}>
          {message}
        </p>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a0aec0', padding: 0, lineHeight: 1, fontSize: '1rem' }}>✕</button>
    </div>
  );
}

export default function LoginPage({ tipo }: { tipo: 'docente' | 'estudiante' }) {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const isDocente = tipo === 'docente';
  const title = isDocente ? 'Faculty & Staff Portal' : 'Bienvenido';
  const subtitle = isDocente
    ? 'Secure access for university employees.'
    : 'Por favor ingresa tus credenciales para continuar.';
  const icon = isDocente ? <Building2 size={40} /> : <GraduationCap size={40} />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const user = await loginUser({ correo, password });
      saveSession(user);
      setToast({ message: `Bienvenido, ${user.nombre}`, type: 'success' });
      setTimeout(() => navigate('/mapa'), 1000);
    } catch (err) {
      let msg = 'Correo o contraseña incorrectos';
      
      if (err instanceof Error) {
        try {
          const errorData = JSON.parse(err.message);
          msg = errorData.error || errorData.message || 'Correo o contraseña incorrectos';
        } catch {
          msg = err.message || 'Correo o contraseña incorrectos';
        }
      }
      
      setToast({ message: msg, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="login-page employee-login">
        <div className="login-shell">
          <div className="login-card card-type-employee">
            <div className="login-strip" />
            <div className="login-icon">{icon}</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>

            <form className="login-form" onSubmit={handleLogin}>
              <Field
                label={isDocente ? 'Institutional Email' : 'Correo electrónico'}
                placeholder={isDocente ? 'e.g. jdoe@uni.edu.sv' : 'correo@ejemplo.com'}
                icon={<Mail size={18} />}
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
              />
              <Field
                label="Contraseña"
                placeholder="••••••••"
                icon={<Lock size={18} />}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button className="primary-btn large" type="submit" disabled={isLoading}>
                {isDocente && <Layers3 size={18} />}
                {isLoading ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>

            <p style={{ marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
              ¿No tienes cuenta?{' '}
              <Link to="/register" style={{ color: 'var(--color-primary, #3182ce)' }}>
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}