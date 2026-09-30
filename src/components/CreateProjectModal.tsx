import { Building2, CalendarDays, ImagePlus, Layers3, MapPinned, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createProject, parseCsvList, toDataUrl } from '../services/api';
import { Field } from './ui';

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

export default function CreateProjectModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
  defaultInstitutionId?: string | number;
  defaultInstitutionName?: string;
}) {
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const institutionFileInputRef = useRef<HTMLInputElement>(null);
  const [projectPreviewUrl, setProjectPreviewUrl] = useState<string | null>(null);
  const [projectFileName, setProjectFileName] = useState<string | null>(null);
  const [projectImageDataUrl, setProjectImageDataUrl] = useState<string | null>(null);
  const [institutionPreviewUrl, setInstitutionPreviewUrl] = useState<string | null>(null);
  const [institutionFileName, setInstitutionFileName] = useState<string | null>(null);
  const [institutionImageDataUrl, setInstitutionImageDataUrl] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [institutionLocation, setInstitutionLocation] = useState('');
  const [institutionDescription, setInstitutionDescription] = useState('');
  const [faculty, setFaculty] = useState('');
  const [careers, setCareers] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState('');

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    if (type === 'success') {
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleProjectFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen del proyecto no puede superar 5 MB');
      showToast('La imagen del proyecto no puede superar 5 MB', 'error');
      return;
    }
    setProjectFileName(file.name);
    void toDataUrl(file).then((dataUrl) => {
      setProjectPreviewUrl(dataUrl);
      setProjectImageDataUrl(dataUrl);
    });
  }

  function handleInstitutionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen de la institución no puede superar 5 MB');
      showToast('La imagen de la institución no puede superar 5 MB', 'error');
      return;
    }
    setInstitutionFileName(file.name);
    void toDataUrl(file).then((dataUrl) => {
      setInstitutionPreviewUrl(dataUrl);
      setInstitutionImageDataUrl(dataUrl);
    });
  }

  function handleRemoveProjectImage() {
    setProjectPreviewUrl(null);
    setProjectFileName(null);
    setProjectImageDataUrl(null);
    if (projectFileInputRef.current) projectFileInputRef.current.value = '';
  }

  function handleRemoveInstitutionImage() {
    setInstitutionPreviewUrl(null);
    setInstitutionFileName(null);
    setInstitutionImageDataUrl(null);
    if (institutionFileInputRef.current) institutionFileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const normalizedCareers = parseCsvList(careers);

    if (normalizedCareers.length === 0) {
      const msg = 'Agrega al menos una carrera que pueda aplicar';
      setError(msg);
      showToast(msg, 'error');
      setIsSaving(false);
      return;
    }

    if (!institutionImageDataUrl) {
      const msg = 'Debes subir una imagen de la institución';
      setError(msg);
      showToast(msg, 'error');
      setIsSaving(false);
      return;
    }

    if (!projectImageDataUrl) {
      const msg = 'Debes subir una imagen del proyecto';
      setError(msg);
      showToast(msg, 'error');
      setIsSaving(false);
      return;
    }

    try {
      await createProject({
        institutionName,
        institutionType,
        institutionLocation,
        institutionDescription,
        institutionImage: institutionImageDataUrl,
        facultad: faculty,
        carreras: normalizedCareers,
        titulo: title,
        ubicacion: location,
        descripcion: description,
        resumen: description.slice(0, 160),
        fechaInicio: startDate || undefined,
        fechaCierre: endDate || undefined,
        cupos: slots ? Number(slots) : undefined,
        projectImage: projectImageDataUrl,
        image: projectImageDataUrl,
        students: [],
      });

      showToast('Proyecto creado correctamente', 'success');
      onSaved?.();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : 'No se pudo guardar el proyecto';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Crear nuevo proyecto">
        <form className="modal-card modal-card-wide" onSubmit={handleSubmit}>

          <div className="modal-header">
            <h2>Crear nuevo proyecto</h2>
            <button className="icon-btn small" type="button" onClick={onClose} aria-label="Cerrar modal">
              <X size={16} />
            </button>
          </div>

          <div className="modal-body-scroll">
            <div className="form-grid">
              <Field label="Institución" placeholder="Nombre de la institución o entidad" icon={<Building2 size={18} />} value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} required />
              <Field label="Tipo de institución" placeholder="Ej. Universidad pública, privada, instituto" value={institutionType} onChange={(event) => setInstitutionType(event.target.value)} required />
              <Field label="Ubicación de la institución" placeholder="Ej. San Salvador, El Salvador" icon={<MapPinned size={18} />} value={institutionLocation} onChange={(event) => setInstitutionLocation(event.target.value)} required />
              <Field
                label="Descripción de la institución"
                placeholder="Describe brevemente la institución..."
                textarea
                value={institutionDescription}
                onChange={(event) => setInstitutionDescription(event.target.value)}
                required
              />
              <Field label="Facultad" placeholder="Ej. Arquitectura e Ingeniería" icon={<Layers3 size={18} />} value={faculty} onChange={(event) => setFaculty(event.target.value)} required />
              <Field
                label="Carreras que pueden aplicar"
                placeholder="Ej. Ingeniería en Sistemas, Arquitectura, Diseño"
                icon={<Layers3 size={18} />}
                value={careers}
                onChange={(event) => setCareers(event.target.value)}
                textarea
                required
              />
              <Field label="Nombre del proyecto" placeholder="Ej. Campaña de salud comunitaria" icon={<Plus size={18} />} value={title} onChange={(event) => setTitle(event.target.value)} required />
              <Field label="Ubicación" placeholder="Municipio / departamento" icon={<MapPinned size={18} />} value={location} onChange={(event) => setLocation(event.target.value)} required />
              <Field label="Fecha de inicio" placeholder="YYYY-MM-DD" type="date" icon={<CalendarDays size={18} />} value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              <Field label="Fecha de cierre" placeholder="YYYY-MM-DD" type="date" icon={<CalendarDays size={18} />} value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
              <Field label="Cupos del proyecto" placeholder="Ej. 5" type="number" value={slots} onChange={(event) => setSlots(event.target.value)} required />
            </div>

            <Field
              label="Descripción del proyecto"
              placeholder="Describe los objetivos e impacto del proyecto..."
              textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />

            <div className="modal-image-field">
              <span className="modal-image-label">Imagen de la institución</span>
              {institutionPreviewUrl ? (
                <div className="modal-image-preview">
                  <img src={institutionPreviewUrl} alt="Vista previa de la institución" />
                  <div className="modal-image-overlay">
                    <span className="modal-image-filename">{institutionFileName}</span>
                    <button type="button" className="modal-image-remove" onClick={handleRemoveInstitutionImage} aria-label="Eliminar imagen de la institución">
                      <X size={14} /> Quitar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="modal-image-dropzone" onClick={() => institutionFileInputRef.current?.click()}>
                  <div className="modal-image-dropzone-icon"><ImagePlus size={26} /></div>
                  <p className="modal-image-dropzone-title">Subir imagen de la institución</p>
                  <p className="modal-image-dropzone-hint">PNG, JPG o WEBP · Máx. 5 MB</p>
                </button>
              )}
              <input ref={institutionFileInputRef} type="file" accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleInstitutionFileChange} />
            </div>

            <div className="modal-image-field">
              <span className="modal-image-label">Imagen del proyecto</span>
              {projectPreviewUrl ? (
                <div className="modal-image-preview">
                  <img src={projectPreviewUrl} alt="Vista previa del proyecto" />
                  <div className="modal-image-overlay">
                    <span className="modal-image-filename">{projectFileName}</span>
                    <button type="button" className="modal-image-remove" onClick={handleRemoveProjectImage} aria-label="Eliminar imagen del proyecto">
                      <X size={14} /> Quitar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="modal-image-dropzone" onClick={() => projectFileInputRef.current?.click()}>
                  <div className="modal-image-dropzone-icon"><ImagePlus size={26} /></div>
                  <p className="modal-image-dropzone-title">Subir imagen del proyecto</p>
                  <p className="modal-image-dropzone-hint">PNG, JPG o WEBP · Máx. 5 MB</p>
                </button>
              )}
              <input ref={projectFileInputRef} type="file" accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleProjectFileChange} />
            </div>

            {error ? <p className="modal-error">{error}</p> : null}
          </div>

          <div className="modal-footer">
            <button className="modal-btn-cancel" type="button" onClick={onClose}>Cancelar</button>
            <button className="modal-btn-save" type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar y publicar proyecto'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}