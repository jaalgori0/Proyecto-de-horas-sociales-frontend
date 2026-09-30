import { Building2, ImagePlus, MapPinned, X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  toDataUrl,
  updateInstitution,
  type InstitutionDetailResponse,
} from '../services/api';
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

export default function EditInstitutionModal({
  institution,
  onClose,
  onSaved,
}: {
  institution: InstitutionDetailResponse;
  onClose: () => void;
  onSaved?: (updated: InstitutionDetailResponse) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(institution.nombre ?? '');
  const [tipo, setTipo] = useState(institution.tipo ?? '');
  const [ubicacion, setUbicacion] = useState(institution.ubicacion ?? '');
  const [descripcion, setDescripcion] = useState(institution.descripcion ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(institution.image ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    if (type === 'success') {
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      const msg = 'La imagen de la institución no puede superar 5 MB';
      setError(msg);
      showToast(msg, 'error');
      return;
    }
    setFileName(file.name);
    setImageRemoved(false);
    void toDataUrl(file).then((dataUrl) => {
      setPreviewUrl(dataUrl);
      setImageDataUrl(dataUrl);
    });
  }

  function handleRemoveImage() {
    setPreviewUrl(null);
    setFileName(null);
    setImageDataUrl(null);
    setImageRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateInstitution(institution.id, {
        nombre: nombre.trim(),
        tipo: tipo.trim() || null,
        ubicacion: ubicacion.trim(),
        descripcion: descripcion.trim(),
        ...(imageDataUrl ? { image_url: imageDataUrl } : imageRemoved ? { image_url: null } : {}),
      });

      showToast('Institución actualizada correctamente', 'success');
      onSaved?.(updated);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (submitError) {
      const msg = submitError instanceof Error ? submitError.message : 'No se pudo actualizar la institución';
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

      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar institución">
        <form className="modal-card modal-card-wide" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2>Editar institución</h2>
            <button className="icon-btn small" type="button" onClick={onClose} aria-label="Cerrar modal">
              <X size={16} />
            </button>
          </div>

          <div className="modal-body-scroll">
            <div className="form-grid">
              <Field
                label="Institución"
                placeholder="Nombre de la institución o entidad"
                icon={<Building2 size={18} />}
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
              />
              <Field
                label="Tipo de institución"
                placeholder="Ej. Universidad pública, privada, instituto"
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
                required
              />
              <Field
                label="Ubicación de la institución"
                placeholder="Ej. San Salvador, El Salvador"
                icon={<MapPinned size={18} />}
                value={ubicacion}
                onChange={(event) => setUbicacion(event.target.value)}
                required
              />
              <Field
                label="Descripción de la institución"
                placeholder="Describe brevemente la institución..."
                textarea
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                required
              />
            </div>

            <div className="modal-image-field">
              <span className="modal-image-label">Imagen de la institución</span>
              {previewUrl ? (
                <div className="modal-image-preview">
                  <img src={previewUrl} alt="Vista previa de la institución" />
                  <div className="modal-image-overlay">
                    <span className="modal-image-filename">{fileName ?? 'Imagen actual'}</span>
                    <button type="button" className="modal-image-remove" onClick={handleRemoveImage} aria-label="Eliminar imagen de la institución">
                      <X size={14} /> Quitar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="modal-image-dropzone" onClick={() => fileInputRef.current?.click()}>
                  <div className="modal-image-dropzone-icon"><ImagePlus size={26} /></div>
                  <p className="modal-image-dropzone-title">Subir imagen de la institución</p>
                  <p className="modal-image-dropzone-hint">PNG, JPG o WEBP · Máx. 5 MB</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {error ? <p className="modal-error">{error}</p> : null}
          </div>

          <div className="modal-footer">
            <button className="modal-btn-cancel" type="button" onClick={onClose}>Cancelar</button>
            <button className="modal-btn-save" type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
