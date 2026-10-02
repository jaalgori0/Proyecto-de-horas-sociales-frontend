import { CreditCard, GraduationCap, X, UserRound } from 'lucide-react';
import { useState } from 'react';
import { enrollStudent } from '../services/api';
import { Field } from './ui';

interface InscribirEstudianteModalProps {
  projectTitle: string;
  projectId: string;
  carrerasPermitidas?: string[]; 
  onClose: () => void;
  onEnrolled?: (updatedProject?: any) => void;
}

export default function InscribirEstudianteModal({
  projectTitle,
  projectId,
  carrerasPermitidas = [],
  onClose,
  onEnrolled,
}: InscribirEstudianteModalProps) {
  const [name, setName] = useState('');
  const [carnet, setCarnet] = useState('');
  const [career, setCareer] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'Masculino' | 'Femenino' | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!career) {
      setError('Por favor seleccione una carrera.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const resp: any = await enrollStudent(projectId, {
        nombre: name,
        carnet,
        carrera: career,
        genero: gender || undefined,
        email: email || undefined,
      });
      try { onEnrolled?.(resp?.project ?? resp); } catch { }
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo inscribir al estudiante');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Inscribir estudiante en ${projectTitle}`}
    >
      <form className="modal-card enrollment-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2>Inscribir estudiante</h2>
            <p className="modal-subtitle">{projectTitle}</p>
          </div>
          <button className="icon-btn small" type="button" onClick={onClose} aria-label="Cerrar modal">
            <X size={16} />
          </button>
        </div>

        <div className="form-grid">
          <Field 
            label="Nombre del estudiante" 
            placeholder="Nombre completo" 
            icon={<UserRound size={18} />} 
            value={name} 
            onChange={(event) => setName(event.target.value)} 
          />
          
          <Field 
            label="Carnet" 
            placeholder="Ej. 20230045" 
            icon={<CreditCard size={18} />} 
            value={carnet} 
            onChange={(event) => setCarnet(event.target.value)} 
          />

          {/* Menú desplegable estrictamente limitado a las carreras del proyecto */}
          <div className="field-wrapper">
            <label className="field-label">Carrera autorizada</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '12px', color: '#687182', display: 'flex', pointerEvents: 'none', zIndex: 10 }}>
                <GraduationCap size={18} />
              </span>
              <select
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                className="field-input"
                style={{ paddingLeft: '38px', width: '100%', appearance: 'auto' }}
                required
              >
                <option value="">Seleccione una carrera...</option>
                {carrerasPermitidas.map((carreraOption) => (
                  <option key={carreraOption} value={carreraOption}>
                    {carreraOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Field 
            label="Email (opcional)" 
            placeholder="estudiante@ejemplo.edu.sv" 
            icon={<UserRound size={18} />} 
            value={email} 
            onChange={(event) => setEmail(event.target.value)} 
          />

          <div className="field-wrapper">
            <label className="field-label">Género</label>
            <select
              value={gender}
              onChange={(e) =>
                setGender(e.target.value as '' | 'Masculino' | 'Femenino')
              }
              className="field-input"
            >
              <option value="">Seleccione un género</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
          </div>
        </div>

        {error ? <p className="modal-error">{error}</p> : null}

        <div className="modal-footer">
          <button className="secondary-btn" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-btn" type="submit" disabled={isSaving}>
            {isSaving ? 'Inscribiendo...' : 'Inscribir estudiante'}
          </button>
        </div>
      </form>
    </div>
  );
}