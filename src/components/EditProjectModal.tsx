import { Building2, CalendarDays, ImagePlus, Layers3, MapPinned, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toDataUrl, updateProject, getFaculties, getCareers } from '../services/api';
import { Field } from './ui';
import type { ProjectDetailResponse, FacultyResponse, CareerResponse } from '../services/api';
import { Trash2, Pencil } from 'lucide-react';
import EditStudentModal, { type EnrolledStudent } from './EditStudentModal';
import { removeEnrollment, updateStudentEnrollment } from '../services/api';

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

export default function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: ProjectDetailResponse;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const institutionFileInputRef = useRef<HTMLInputElement>(null);

  const [projectPreviewUrl, setProjectPreviewUrl] = useState<string | null>(project.imagen);
  const [projectImageDataUrl, setProjectImageDataUrl] = useState<string | null>(null);
  const [institutionPreviewUrl, setInstitutionPreviewUrl] = useState<string | null>((project as any).institutionImageUrl ?? null);
  const [institutionImageDataUrl, setInstitutionImageDataUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [studentToEdit, setStudentToEdit] = useState<EnrolledStudent | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<EnrolledStudent | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>(
    (project.estudiantes ?? []) as EnrolledStudent[]
  );

  // Catálogos para Facultades y Carreras
  const [faculties, setFaculties] = useState<FacultyResponse[]>([]);
  const [careersList, setCareersList] = useState<CareerResponse[]>([]);
  
  // Campos pre-rellenos con datos actuales del proyecto
  const [institutionName, setInstitutionName] = useState(project.institution ?? '');
  const [institutionType, setInstitutionType] = useState((project as any).institutionTipo ?? '');
  const [institutionLocation, setInstitutionLocation] = useState(project.ubicacion ?? '');
  const [institutionDescription, setInstitutionDescription] = useState((project as any).institutionDescripcion ?? '');
  
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedCareerIds, setSelectedCareerIds] = useState<string[]>([]);

  const [title, setTitle] = useState(project.titulo ?? project.nombre ?? '');
  const [location, setLocation] = useState(project.ubicacion ?? '');
  const [startDate, setStartDate] = useState(project.fechaInicio?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(project.fechaCierre?.slice(0, 10) ?? '');
  const [description, setDescription] = useState(project.descripcion ?? project.resumen ?? '');
  const [slots, setSlots] = useState(project.cuposTotales != null ? String(project.cuposTotales) : '');

  // Cargar facultades y carreras al montar
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [facs, cars] = await Promise.all([getFaculties(), getCareers()]);
        setFaculties(facs);
        setCareersList(cars);

        // 1. Encontrar la facultad que coincide con el proyecto (por ID o por Nombre)
        const projectFacultyName = (project as any).facultad || project.facultad || '';
        const matchedFaculty = facs.find(
          (f) => String(f.id) === String((project as any).facultyId) || f.nombre.trim().toLowerCase() === projectFacultyName.trim().toLowerCase()
        );

        if (matchedFaculty) {
          setSelectedFacultyId(String(matchedFaculty.id));

          // 2. Encontrar las carreras del proyecto que coincidan con esta facultad
          const projectCareersNames: string[] = (project as any).carreras || project.carreras || [];
          const matchedCareerIds = cars
            .filter(
              (c) =>
                String(c.faculty_id) === String(matchedFaculty.id) &&
                projectCareersNames.some((pName) => pName.trim().toLowerCase() === c.nombre.trim().toLowerCase())
            )
            .map((c) => String(c.id));

          setSelectedCareerIds(matchedCareerIds);
        }
      } catch (err) {
        console.error('Error cargando catálogos', err);
      }
    }
    void loadCatalogs();
  }, [project]);

  const filteredCareers = careersList.filter(
    (c) => !selectedFacultyId || String(c.faculty_id) === String(selectedFacultyId)
  );

  const currentFacultyName = faculties.find(f => String(f.id) === String(selectedFacultyId))?.nombre || project.facultad || '';

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    if (type === 'success') {
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleProjectFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void toDataUrl(file).then((dataUrl) => {
      setProjectPreviewUrl(dataUrl);
      setProjectImageDataUrl(dataUrl);
    });
  }

  function handleInstitutionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void toDataUrl(file).then((dataUrl) => {
      setInstitutionPreviewUrl(dataUrl);
      setInstitutionImageDataUrl(dataUrl);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (selectedCareerIds.length === 0) {
      const msg = 'Agrega al menos una carrera';
      setError(msg);
      showToast(msg, 'error');
      setIsSaving(false);
      return;
    }

    // Obtener los nombres de las carreras seleccionadas para mantener compatibilidad
    const careerNames = careersList
      .filter((c) => selectedCareerIds.includes(String(c.id)))
      .map((c) => c.nombre);

    try {
      await updateProject(project.id, {
        institutionId: (project as any).institutionId ?? undefined,
        institutionName,
        institutionType,
        institutionLocation,
        institutionDescription,
        institutionImage: institutionImageDataUrl,
        facultad: currentFacultyName,
        carreras: careerNames,
        titulo: title,
        ubicacion: location,
        descripcion: description,
        fechaInicio: startDate || undefined,
        fechaCierre: endDate || undefined,
        cupos: slots ? Number(slots) : undefined,
        projectImage: projectImageDataUrl,
      });

      showToast('Proyecto actualizado correctamente', 'success');
      onSaved?.();

      setTimeout(() => { onClose(); }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar el proyecto';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveStudent(enrollmentId: string) {
    setRemovingId(enrollmentId);
    try {
      await removeEnrollment(String(project.id), enrollmentId);
      setStudents((prev) => prev.filter((s) => s.id !== enrollmentId));
      showToast('Estudiante eliminado correctamente', 'success');
      onSaved?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo eliminar', 'error');
    } finally {
      setRemovingId(null);
      setStudentToDelete(null);
    }
  }

  function handleStudentSaved() {
    showToast('Estudiante actualizado correctamente', 'success');
    onSaved?.();
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

      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar proyecto">
        <form className="modal-card modal-card-wide" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2>Editar proyecto</h2>
            <button className="icon-btn small" type="button" onClick={onClose} aria-label="Cerrar modal">
              <X size={16} />
            </button>
          </div>

          <div className="modal-body-scroll">
            <div className="form-grid">
              <Field label="Institución" placeholder="Nombre de la institución" icon={<Building2 size={18} />} value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required />
              <Field label="Tipo de institución" placeholder="Ej. Universidad pública, privada" value={institutionType} onChange={(e) => setInstitutionType(e.target.value)} />
              <Field label="Ubicación de la institución" placeholder="Ej. San Salvador" icon={<MapPinned size={18} />} value={institutionLocation} onChange={(e) => setInstitutionLocation(e.target.value)} required />
              <Field label="Descripción de la institución" placeholder="Describe brevemente la institución..." textarea value={institutionDescription} onChange={(e) => setInstitutionDescription(e.target.value)} />
              
              {/* Select de Facultad */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.375rem', 
                padding: '0.75rem 1rem', 
                borderRadius: '0.75rem', 
                border: '1px solid #e2e8f0', 
                backgroundColor: '#ffffff' 
              }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
                  Facultad <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '0rem', color: '#9ca3af', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <Layers3 size={18} />
                  </span>
                  <select
                    style={{ 
                      width: '100%', 
                      paddingLeft: '2rem', 
                      paddingRight: '1.5rem', 
                      paddingTop: '0.375rem', 
                      paddingBottom: '0.375rem', 
                      backgroundColor: 'transparent', 
                      border: 'none', 
                      fontSize: '0.9375rem', 
                      color: '#1a202c', 
                      outline: 'none', 
                      appearance: 'none', 
                      cursor: 'pointer' 
                    }}
                    value={selectedFacultyId}
                    onChange={(e) => {
                      setSelectedFacultyId(e.target.value);
                      setSelectedCareerIds([]); // Limpiar carreras al cambiar facultad
                    }}
                    required
                  >
                    <option value="">Selecciona una facultad...</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkboxes de Carreras */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem', 
                padding: '0.75rem 1rem', 
                borderRadius: '0.75rem', 
                border: '1px solid #e2e8f0', 
                backgroundColor: '#ffffff' 
              }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
                  Carreras que pueden aplicar <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', marginTop: '0.125rem', pointerEvents: 'none' }}>
                    <Layers3 size={18} />
                  </span>

                  <div style={{ 
                    width: '100%', 
                    maxHeight: '130px', 
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.5rem',
                    paddingRight: '0.25rem'
                  }}>
                    {!selectedFacultyId ? (
                      <span style={{ fontSize: '0.9375rem', color: '#9ca3af', fontStyle: 'italic' }}>
                        Primero selecciona una facultad
                      </span>
                    ) : filteredCareers.length === 0 ? (
                      <span style={{ fontSize: '0.9375rem', color: '#9ca3af', fontStyle: 'italic' }}>
                        No hay carreras disponibles para esta facultad
                      </span>
                    ) : (
                      filteredCareers.map((c) => {
                        const stringId = String(c.id);
                        const isChecked = selectedCareerIds.includes(stringId);
                        return (
                          <label 
                            key={c.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem', 
                              fontSize: '0.9375rem', 
                              color: '#1a202c', 
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              value={stringId}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCareerIds([...selectedCareerIds, stringId]);
                                } else {
                                  setSelectedCareerIds(selectedCareerIds.filter(id => id !== stringId));
                                }
                              }}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2563eb' }}
                            />
                            {c.nombre}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <Field label="Nombre del proyecto" placeholder="Ej. Campaña de salud comunitaria" icon={<Plus size={18} />} value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Field label="Ubicación" placeholder="Municipio / departamento" icon={<MapPinned size={18} />} value={location} onChange={(e) => setLocation(e.target.value)} required />
              <Field label="Fecha de inicio" placeholder="" type="date" icon={<CalendarDays size={18} />} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Field label="Fecha de cierre" placeholder="" type="date" icon={<CalendarDays size={18} />} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <Field label="Cupos del proyecto" placeholder="Ej. 5" type="number" value={slots} onChange={(e) => setSlots(e.target.value)} />
            </div>

            <Field label="Descripción del proyecto" placeholder="Describe los objetivos e impacto..." textarea value={description} onChange={(e) => setDescription(e.target.value)} required />

            <div className="modal-images-grid">
            {/* Imagen institución */}
            <div className="modal-image-field">
              <span className="modal-image-label">Imagen de la institución (opcional)</span>
              {institutionPreviewUrl ? (
                <div className="modal-image-preview">
                  <img src={institutionPreviewUrl} alt="Vista previa institución" />
                  <div className="modal-image-overlay">
                    <button type="button" className="modal-image-remove" onClick={() => { setInstitutionPreviewUrl(null); setInstitutionImageDataUrl(null); }} aria-label="Quitar imagen">
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

            {/* Imagen proyecto */}
            <div className="modal-image-field">
              <span className="modal-image-label">Imagen del proyecto (opcional)</span>
              {projectPreviewUrl ? (
                <div className="modal-image-preview">
                  <img src={projectPreviewUrl} alt="Vista previa proyecto" />
                  <div className="modal-image-overlay">
                    <button type="button" className="modal-image-remove" onClick={() => { setProjectPreviewUrl(null); setProjectImageDataUrl(null); }} aria-label="Quitar imagen">
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
            </div>

            {error ? <p className="modal-error">{error}</p> : null}
            {/* ── Estudiantes inscritos ─────────────────────────── */}
            <div style={{ marginTop: '24px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Estudiantes inscritos ({students.length})
              </p>

              {students.length === 0 ? (
                <p style={{ fontSize: '0.88rem', color: '#9aa3b5' }}>No hay estudiantes inscritos aún.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {students.map((student) => {
                    const initials = (student.nombre ?? '')
                      .split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
                    return (
                      <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: '#f8faff', border: '1px solid #e8edf8' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3972f0, #21c08a)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#1c2433' }}>{student.nombre}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#687182' }}>{student.carrera} · {student.cargo ?? 'Estudiante'}</p>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#9aa3b5' }}>{student.carnet}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            title="Editar estudiante"
                            onClick={() => setStudentToEdit(student)}
                            style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #d0d9f0', background: 'white', cursor: 'pointer', color: '#3972f0', display: 'flex', alignItems: 'center' }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title="Eliminar inscripción"
                            onClick={() => setStudentToDelete(student)}
                            disabled={removingId === student.id}
                            style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #fed7d7', background: 'white', cursor: 'pointer', color: '#e53e3e', display: 'flex', alignItems: 'center' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal de edición de estudiante */}
            {studentToEdit && (
              <EditStudentModal
                student={studentToEdit}
                projectId={String(project.id)}
                onClose={() => setStudentToEdit(null)}
                onSaved={handleStudentSaved}
                updateFn={(projectId, enrollmentId, body) => updateStudentEnrollment(projectId, enrollmentId, body)}
              />
            )}

            {/* Modal de confirmación para eliminar estudiante */}
            {studentToDelete && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  background: 'white', borderRadius: 16, padding: '28px 32px',
                  maxWidth: 440, width: '90%',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                }}>
                  <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 800, color: '#1c2433' }}>
                    ¿Eliminar este estudiante?
                  </h2>
                  <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#687182', lineHeight: 1.6 }}>
                    Esta acción no se puede deshacer. Se eliminará la inscripción de <strong>"{studentToDelete.nombre}"</strong> del proyecto.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setStudentToDelete(null)}
                      style={{
                        padding: '10px 20px', borderRadius: 10, border: '1px solid #d1d5db',
                        background: 'white', fontSize: '0.9rem', fontWeight: 600,
                        color: '#374151', cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveStudent(studentToDelete.id)}
                      disabled={removingId === studentToDelete.id}
                      style={{
                        padding: '10px 20px', borderRadius: 10, border: 'none',
                        background: removingId === studentToDelete.id
                          ? '#f87171'
                          : 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: 'white', fontSize: '0.9rem', fontWeight: 700,
                        cursor: removingId === studentToDelete.id ? 'not-allowed' : 'pointer',
                        opacity: removingId === studentToDelete.id ? 0.7 : 1,
                      }}
                    >
                      {removingId === studentToDelete.id ? 'Eliminando...' : 'Sí, eliminar estudiante'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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