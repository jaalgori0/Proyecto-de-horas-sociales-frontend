/**
 * Modal "Asignar horas" del perfil del estudiante.
 *
 *  - Proyecto obligatorio: primero las participaciones abiertas del estudiante,
 *    luego el catálogo. Para convalidaciones o actividades fuera del CSS está el
 *    proyecto interno "Asignaciones Manuales / Actividades Internas".
 *  - Idempotency-Key: se genera al abrir y se conserva en los reintentos de un
 *    envío fallido (un doble clic o un corte de red no duplica horas).
 *  - Al guardar entrega el perfil actualizado que devuelve el backend: la rueda y
 *    el historial se actualizan sin otra petición.
 */
import { CalendarDays, Clock3, FolderKanban, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addManualHours,
  describeApiError,
  getProjects,
  type HourNaturaleza,
  type ProjectListResponse,
  type StudentProfile,
} from '../services/api';

export const SYSTEM_PROJECT_TITLE = 'Asignaciones Manuales / Actividades Internas';

type ProjectOption = {
  id: string;
  titulo: string;
  institucion: string;
  cerrado: boolean;
  /** El estudiante ya participa en él. */
  inscrito: boolean;
  sistema: boolean;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // http:// en red local no es "secure context": sin randomUUID, pero getRandomValues sí existe.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function todayInElSalvador(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date());
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function ManualHoursModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: StudentProfile;
  onClose: () => void;
  onSaved: (profile: StudentProfile, horas: number, replayed: boolean) => void;
}) {
  const [catalog, setCatalog] = useState<ProjectListResponse[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [horas, setHoras] = useState('');
  const [naturaleza, setNaturaleza] = useState<'' | HourNaturaleza>('');
  const [fecha, setFecha] = useState(todayInElSalvador);
  const [concepto, setConcepto] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getProjects()
      .then((list) => active && setCatalog(list))
      .catch((err) => active && setCatalogError(describeApiError(err, 'No se pudo cargar el catálogo de proyectos')))
      .finally(() => active && setLoadingCatalog(false));
    firstFieldRef.current?.focus();
    document.body.classList.add('modal-open');
    return () => {
      active = false;
      document.body.classList.remove('modal-open');
    };
  }, []);

  const options = useMemo<ProjectOption[]>(() => {
    const byId = new Map<string, ProjectOption>();
    // Participaciones del estudiante que aún admiten horas.
    for (const p of profile.participaciones) {
      if (p.estado === 'RETIRADA' || p.estado === 'CANCELADA') continue;
      byId.set(p.proyecto.id, {
        id: p.proyecto.id,
        titulo: p.proyecto.titulo,
        institucion: p.institucion.nombre,
        cerrado: p.proyecto.estado === 'Cerrado',
        inscrito: true,
        sistema: p.proyecto.esSistema,
      });
    }
    const blocked = new Set(
      profile.participaciones
        .filter((p) => p.estado === 'RETIRADA' || p.estado === 'CANCELADA')
        .map((p) => p.proyecto.id),
    );
    for (const p of catalog) {
      const id = String(p.id);
      if (byId.has(id) || blocked.has(id)) continue;
      byId.set(id, {
        id,
        titulo: p.titulo,
        institucion: p.institution ?? '',
        cerrado: (p.status ?? p.estado) === 'Cerrado',
        inscrito: false,
        sistema: p.titulo === SYSTEM_PROJECT_TITLE,
      });
    }
    const rank = (o: ProjectOption) => (o.sistema ? 0 : o.inscrito ? 1 : 2);
    return [...byId.values()].sort((a, b) => rank(a) - rank(b) || a.titulo.localeCompare(b.titulo, 'es'));
  }, [catalog, profile.participaciones]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const list = term
      ? options.filter((o) => normalize(`${o.titulo} ${o.institucion}`).includes(term))
      : options;
    return list.slice(0, 60);
  }, [options, search]);

  const selected = options.find((o) => o.id === projectId) ?? null;

  function validate(): string | null {
    if (!selected) return 'Seleccione el proyecto al que se asocian las horas.';
    if (selected.cerrado && !selected.inscrito) {
      return 'El proyecto está cerrado y el estudiante no participa en él. Use el proyecto interno de asignaciones manuales.';
    }
    const n = Number(horas);
    if (!Number.isInteger(n) || n < 1) return 'Las horas deben ser un número entero mayor que cero.';
    if (n > 600) return 'No se pueden asignar más de 600 horas en un solo movimiento.';
    if (!fecha) return 'Indique la fecha de las horas.';
    if (fecha > todayInElSalvador()) return 'La fecha no puede ser futura.';
    if (concepto.trim().length < 5) return 'Describa el concepto o motivo (mínimo 5 caracteres).';
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const n = Number(horas);
      const result = await addManualHours(
        profile.student.id,
        {
          projectId: selected!.id,
          horas: n,
          ...(naturaleza ? { naturaleza } : {}),
          fechaHoras: fecha,
          concepto: concepto.trim(),
        },
        idempotencyKey.current,
      );
      idempotencyKey.current = newIdempotencyKey();
      onSaved(result.profile, n, result.replayed);
    } catch (err) {
      // Se conserva la misma Idempotency-Key: reintentar no duplica el movimiento.
      setError(describeApiError(err, 'No se pudieron asignar las horas'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-hours-title"
      onKeyDown={(e) => e.key === 'Escape' && !saving && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <form className="modal-card manual-hours-modal" onSubmit={handleSubmit} noValidate>
        <div className="modal-header">
          <div>
            <h2 id="manual-hours-title">Asignar horas</h2>
            <p className="modal-subtitle">
              {profile.student.nombre} · {profile.student.carnet}
            </p>
          </div>
          <button className="icon-btn small" type="button" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={16} />
          </button>
        </div>

        <div className="manual-hours-body">
          <div className="mh-field">
            <span className="mh-label">
              <FolderKanban size={15} aria-hidden="true" /> Proyecto / institución
            </span>
            <div className="mh-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={firstFieldRef}
                type="search"
                placeholder="Buscar proyecto o institución..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar proyecto"
              />
            </div>
            <div className="mh-project-list" role="listbox" aria-label="Proyectos">
              {loadingCatalog && options.length === 0 ? <p className="muted mh-empty">Cargando proyectos...</p> : null}
              {catalogError ? <p className="modal-error mh-empty">{catalogError}</p> : null}
              {!loadingCatalog && filtered.length === 0 ? (
                <p className="muted mh-empty">Ningún proyecto coincide con la búsqueda.</p>
              ) : null}
              {filtered.map((o) => {
                const disabled = o.cerrado && !o.inscrito;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={o.id === projectId}
                    disabled={disabled}
                    className={`mh-project${o.id === projectId ? ' selected' : ''}`}
                    onClick={() => setProjectId(o.id)}
                  >
                    <span className="mh-project-title">{o.titulo}</span>
                    <span className="mh-project-meta">
                      {o.institucion}
                      {o.sistema ? <em className="mh-tag system">Interno · convalidaciones</em> : null}
                      {o.inscrito && !o.sistema ? <em className="mh-tag">Ya participa</em> : null}
                      {disabled ? <em className="mh-tag muted-tag">Cerrado</em> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mh-grid">
            <label className="mh-field">
              <span className="mh-label">
                <Clock3 size={15} aria-hidden="true" /> Horas
              </span>
              <input
                className="mh-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                step={1}
                placeholder="Ej. 40"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
              />
            </label>
            <label className="mh-field">
              <span className="mh-label">
                <CalendarDays size={15} aria-hidden="true" /> Fecha
              </span>
              <input
                className="mh-input"
                type="date"
                max={todayInElSalvador()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </label>
            <label className="mh-field">
              <span className="mh-label">Naturaleza</span>
              <select
                className="mh-input"
                value={naturaleza}
                onChange={(e) => setNaturaleza(e.target.value as '' | HourNaturaleza)}
              >
                <option value="">Según el proyecto</option>
                <option value="INTERNA">Interna</option>
                <option value="EXTERNA">Externa</option>
              </select>
            </label>
          </div>

          <label className="mh-field">
            <span className="mh-label">Concepto o motivo</span>
            <textarea
              className="mh-input"
              rows={3}
              maxLength={500}
              placeholder="Ej. Convalidación de voluntariado en la Unidad de Proyección Social, ciclo 02-2026"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            />
            <span className="mh-hint">
              Queda registrado en la auditoría junto con su usuario. Las horas manuales no se mezclan con la
              conciliación de importaciones del CSS.
            </span>
          </label>
        </div>

        {error ? (
          <p className="modal-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-footer">
          <button className="secondary-btn" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Asignar horas'}
          </button>
        </div>
      </form>
    </div>
  );
}
