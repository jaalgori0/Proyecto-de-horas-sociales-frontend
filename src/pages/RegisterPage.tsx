import { Eye, EyeOff, GraduationCap, Lock, Mail, User, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/ui';
import { registerUser } from '../services/api';

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim() || !apellido.trim() || !correo.trim() || !password.trim()) {
      setToast({ message: 'Todos los campos son obligatorios', type: 'error' });
      return;
    }
    // Mismas reglas que el backend (POST /auth/register): entre 8 y 128 caracteres.
    if (password.length < 8) {
      setToast({ message: 'La contraseña debe tener al menos 8 caracteres', type: 'error' });
      return;
    }
    if (password.length > 128) {
      setToast({ message: 'La contraseña no puede superar 128 caracteres', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      const user = await registerUser({ nombre, apellido, correo, password });
      localStorage.setItem('auth_user', JSON.stringify(user));
      setToast({ message: `¡Bienvenido, ${user.nombre}!`, type: 'success' });
      setTimeout(() => navigate('/mapa'), 1500);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'No se pudo crear la cuenta', type: 'error' });
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
            <div className="login-icon"><GraduationCap size={40} /></div>
            <h1>Crear cuenta</h1>
            <p>Completa el formulario para registrarte en el sistema.</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <Field label="Nombre" placeholder="Ej. Juan" icon={<User size={18} />} value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Field label="Apellido" placeholder="Ej. Pérez" icon={<UserCheck size={18} />} value={apellido} onChange={(e) => setApellido(e.target.value)} />
              <Field label="Correo electrónico" placeholder="correo@ejemplo.com" icon={<Mail size={18} />} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
              <Field
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
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
                {isLoading ? 'Creando cuenta...' : 'Registrarse'}
              </button>
            </form>

            <p style={{ marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login/estudiante" style={{ color: 'var(--color-primary, #3182ce)' }}>
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}