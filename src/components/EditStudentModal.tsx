import { CreditCard, GraduationCap, X, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { Field } from './ui';

export interface EnrolledStudent {
    id: string;
    student_id?: string;
    nombre?: string;
    carnet?: string;
    carrera?: string;
    genero?: 'Masculino' | 'Femenino' | null;
    email?: string | null;
    avatar?: string | null;
    cargo?: string;
}

interface Props {
    student: EnrolledStudent;
    projectId: string;
    onClose: () => void;
    onSaved: () => void;
    updateFn: (projectId: string, enrollmentId: string, body: any) => Promise<unknown>;
}

export default function EditStudentModal({ student, projectId, onClose, onSaved, updateFn }: Props) {
    const [name, setName]     = useState(student.nombre  ?? '');
    const [carnet, setCarnet] = useState(student.carnet  ?? '');
    const [career, setCareer] = useState(student.carrera ?? '');
    const [email, setEmail]   = useState(student.email   ?? '');
    const [gender, setGender] = useState<'Masculino' | 'Femenino' | ''>(student.genero ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError]   = useState<string | null>(null);

    // Refs para validación sin <form>
    const nameRef   = useRef<HTMLInputElement>(null);
    const carnetRef = useRef<HTMLInputElement>(null);
    const careerRef = useRef<HTMLInputElement>(null);

    async function handleSave() {
        // Validación manual (reemplaza el required del <form>)
        if (!name.trim()) {
            setError('El nombre es obligatorio.');
            nameRef.current?.focus();
            return;
        }
        if (!carnet.trim()) {
            setError('El carnet es obligatorio.');
            carnetRef.current?.focus();
            return;
        }
        if (!career.trim()) {
            setError('La carrera es obligatoria.');
            careerRef.current?.focus();
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await updateFn(projectId, student.id, {
                nombre:  name.trim(),
                carnet:  carnet.trim(),
                carrera: career.trim(),
                genero:  gender || undefined,
                email:   email.trim() || undefined,
            });
            onSaved();
            onClose();
        } catch (err) {
            console.error('[EditStudentModal] Error al actualizar:', err);
            setError(err instanceof Error ? err.message : 'No se pudo actualizar el estudiante.');
        } finally {
            setIsSaving(false);
        }
    }

    // Permitir Escape para cerrar
    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Escape') onClose();
    }

    return (
        <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Editar estudiante"
            onKeyDown={handleKeyDown}
        >
            {/* ⚠️ DIV en lugar de FORM para evitar <form> anidado dentro de EditProjectModal */}
            <div className="modal-card enrollment-modal">
                <div className="modal-header">
                    <div>
                        <h2>Editar estudiante</h2>
                        <p className="modal-subtitle">{student.nombre}</p>
                    </div>
                    <button
                        className="icon-btn small"
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar modal"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="form-grid">
                    <Field
                        label="Nombre"
                        placeholder="Nombre completo"
                        icon={<UserRound size={18} />}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        inputRef={nameRef}
                    />
                    <Field
                        label="Carnet"
                        placeholder="Ej. 20230045"
                        icon={<CreditCard size={18} />}
                        value={carnet}
                        onChange={(e) => setCarnet(e.target.value)}
                        inputRef={carnetRef}
                    />
                    <Field
                        label="Carrera"
                        placeholder="Ej. Ingeniería en Sistemas"
                        icon={<GraduationCap size={18} />}
                        value={career}
                        onChange={(e) => setCareer(e.target.value)}
                        inputRef={careerRef}
                    />
                    <Field
                        label="Email (opcional)"
                        placeholder="estudiante@ejemplo.edu.sv"
                        icon={<UserRound size={18} />}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="field-wrapper">
                        <label className="field-label">Género</label>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value as '' | 'Masculino' | 'Femenino')}
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
                    <button
                        className="secondary-btn"
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button
                        className="primary-btn"
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}