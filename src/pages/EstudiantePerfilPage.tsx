/**
 * Perfil detallado del estudiante: /estudiantes/:carnet
 *
 *  - Datos generales, rueda de progreso hacia 600 h, KPI e historial completo
 *    de participaciones con sus movimientos de horas.
 *  - "Asignar horas" (ADMIN / COORDINADOR): al guardar, el backend devuelve el
 *    perfil ya actualizado y se reemplaza el estado: la rueda y el historial
 *    cambian en el acto, sin recargar.
 */
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  Clock3,
  FolderKanban,
  GraduationCap,
  Hand,
  Landmark,
  Mail,
  Phone,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import HoursProgressRing from '../components/HoursProgressRing';
import ManualHoursModal from '../components/ManualHoursModal';
import RevokeHoursModal from '../components/RevokeHoursModal';
import { BackLink, Notice } from '../components/ui';
import {
  ApiError,
  describeApiError,
  getSessionRole,
  getStudentIdByCarnet,
  getStudentProfile,
  type EnrollmentEstado,
  type StudentHourMovement,
  type StudentParticipation,
  type StudentProfile,
} from '../services/api';

const fmtNum = new Intl.NumberFormat('es-SV');
const fmtDate = new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/El_Salvador' });

/** ISO o YYYY-MM-DD → "12 nov 2026". Las fechas sin hora se leen como día calendario. */
function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-06:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : fmtDate.format(date);
}

const ENROLLMENT_LABELS: Record<EnrollmentEstado, { label: string; tone: string }> = {
  ASIGNADA: { label: 'Asignada', tone: 'info' },
  EN_CURSO: { label: 'En curso', tone: 'progress' },
  FINALIZADA: { label: 'Finalizada', tone: 'done' },
  RETIRADA: { label: 'Retirada', tone: 'neutral' },
  CANCELADA: { label: 'Cancelada', tone: 'neutral' },
};

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, '').charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || '?';
}

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="dash-kpi-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="dash-kpi-icon">{icon}</div>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <strong className="dash-kpi-value">{value}</strong>
        {sub ? <span className="dash-kpi-sub sp-kpi-sub">{sub}</span> : null}
      </div>
    </div>
  );
}

function EnrollmentBadge({ estado }: { estado: EnrollmentEstado }) {
  const cfg = ENROLLMENT_LABELS[estado] ?? { label: estado, tone: 'neutral' };
  return <span className={`sp-badge ${cfg.tone}`}>{cfg.label}</span>;
}

function ParticipationItem({
  p,
  highlight,
  onRevoke,
}: {
  p: StudentParticipation;
  highlight: boolean;
  /** Solo para ADMIN/COORDINADOR; habilita la papelera en movimientos MANUAL. */
  onRevoke?: (movement: StudentHourMovement) => void;
}) {
  const [open, setOpen] = useState(false);
  const periodoInicio = formatDate(p.asignadaEn);
  const periodoFin = p.cerradaEn ? formatDate(p.cerradaEn) : 'En curso';

  return (
    <li className={`sp-part${highlight ? ' sp-flash' : ''}`}>
      <div className="sp-part-main">
        <div className="sp-part-info">
          <div className="sp-part-top">
            <EnrollmentBadge estado={p.estado} />
            <span className="sp-part-inst">
              <Landmark size={12} aria-hidden="true" />
              {p.institucion.sigla || p.institucion.nombre}
            </span>
            {p.proyecto.esSistema ? <span className="sp-tag system">Interno</span> : null}
          </div>
          {p.proyecto.esSistema ? (
            <h4 className="sp-part-title">{p.proyecto.titulo}</h4>
          ) : (
            <Link className="sp-part-title link" to={`/proyectos/${p.proyecto.id}`}>
              {p.proyecto.titulo}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
          <div className="sp-part-meta">
            <span>{periodoInicio} – {periodoFin}</span>
            <span>· {p.proyecto.naturaleza === 'INTERNA' ? 'Interna' : 'Externa'}</span>
            {p.cargo && p.cargo !== 'ESTUDIANTE' ? <span>· {p.cargo}</span> : null}
          </div>
        </div>

        <div className="sp-part-hours">
          <strong>{fmtNum.format(p.horas)} h</strong>
          {p.horasManuales > 0 ? (
            <span className="sp-part-split">
              {fmtNum.format(p.horasImportadas)} CSS · {fmtNum.format(p.horasManuales)} manual
            </span>
          ) : null}
          {p.movimientos.length > 0 ? (
            <button
              type="button"
              className="sp-toggle"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {p.movimientos.length} movimiento{p.movimientos.length !== 1 ? 's' : ''}
              <ChevronDown size={14} aria-hidden="true" className={open ? 'rot' : ''} />
            </button>
          ) : (
            <span className="sp-part-split">Sin horas registradas</span>
          )}
        </div>
      </div>

      {open ? (
        <ul className="sp-movs">
          {p.movimientos.map((m) => (
            <li key={m.id} className={`sp-mov${onRevoke && m.origen === 'MANUAL' ? ' revocable' : ''}`}>
              <span className={`sp-tag ${m.origen === 'MANUAL' ? 'manual' : 'import'}`}>
                {m.origen === 'MANUAL' ? 'Manual' : 'Importación CSS'}
              </span>
              <span className="sp-mov-date">{formatDate(m.fecha)}</span>
              <span className="sp-mov-text">
                {m.concepto ?? m.descripcion ?? '—'}
                {m.registradoPor ? <em> · {m.registradoPor.nombre}</em> : null}
              </span>
              <strong className="sp-mov-hours">+{fmtNum.format(m.horas)} h</strong>
              {onRevoke && m.origen === 'MANUAL' ? (
                <button
                  type="button"
                  className="sp-revoke-btn"
                  onClick={() => onRevoke(m)}
                  aria-label={`Revocar ${m.horas} h: ${m.concepto ?? 'asignación manual'}`}
                  title="Revocar estas horas"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function EstudiantePerfilPage() {
  const { carnet = '' } = useParams();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<StudentHourMovement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flashProjectId, setFlashProjectId] = useState<string | null>(null);
  const canAssign = ['ADMIN', 'COORDINADOR'].includes(getSessionRole() ?? '');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      setNotFound(false);
      try {
        if (!/^\d{8}$/.test(carnet)) {
          setNotFound(true);
          return;
        }
        const id = await getStudentIdByCarnet(carnet);
        const data = await getStudentProfile(id);
        if (active) setProfile(data);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(describeApiError(err, 'No se pudo cargar el perfil del estudiante'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [carnet, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!flashProjectId) return;
    const timer = setTimeout(() => setFlashProjectId(null), 2200);
    return () => clearTimeout(timer);
  }, [flashProjectId]);

  function handleSaved(updated: StudentProfile, horas: number, replayed: boolean) {
    const before = new Set(profile?.participaciones.map((p) => `${p.enrollmentId}:${p.horas}`));
    const changed = updated.participaciones.find((p) => !before.has(`${p.enrollmentId}:${p.horas}`));
    setProfile(updated);
    setShowModal(false);
    setFlashProjectId(changed?.enrollmentId ?? null);
    setToast(replayed ? 'Esta asignación ya estaba registrada: no se duplicó.' : `Se asignaron ${fmtNum.format(horas)} h correctamente.`);
  }

  function handleRevoked(updated: StudentProfile, movement: StudentHourMovement) {
    setProfile(updated);
    setRevokeTarget(null);
    // Si la participación sigue existiendo (proyecto real), se resalta; la del proyecto interno vacía desaparece.
    const still = updated.participaciones.some((p) => p.enrollmentId === movement.enrollmentId);
    setFlashProjectId(still ? movement.enrollmentId : null);
    setToast(`Se revocaron ${fmtNum.format(movement.horas)} h.`);
  }

  if (loading && !profile) {
    return (
      <div className="student-profile-page wide-page">
        <BackLink to="/estudiantes" label="Volver a estudiantes" />
        <p className="muted">Cargando perfil del estudiante...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="student-profile-page wide-page">
        <BackLink to="/estudiantes" label="Volver a estudiantes" />
        <Notice variant="info" title="Estudiante no encontrado">
          No existe un estudiante con el carnet {carnet}.
        </Notice>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="student-profile-page wide-page">
        <BackLink to="/estudiantes" label="Volver a estudiantes" />
        <Notice title="No se pudo cargar el perfil" onRetry={() => setReloadKey((k) => k + 1)}>
          {error}
        </Notice>
      </div>
    );
  }

  const { student, progreso, participaciones } = profile;
  const activas = participaciones.filter((p) => p.estado === 'ASIGNADA' || p.estado === 'EN_CURSO').length;

  return (
    <div className="student-profile-page wide-page">
      <BackLink to="/estudiantes" label="Volver a estudiantes" />

      <header className="page-hero sp-hero">
        <div className="sp-hero-identity">
          <div className="sp-avatar" aria-hidden="true">
            {student.avatarUrl ? <img src={student.avatarUrl} alt="" /> : getInitials(student.nombre)}
          </div>
          <div className="sp-hero-copy">
            <h1 className="main-title">{student.nombre}</h1>
            <div className="sp-hero-meta">
              <span className="sp-chip">Carnet {student.carnet}</span>
              <span className={`sp-chip ${student.activo ? 'ok' : 'off'}`}>{student.activo ? 'Activo' : 'Inactivo'}</span>
              {progreso.completado ? (
                <span className="sp-chip ok">
                  <BadgeCheck size={14} aria-hidden="true" /> Requisito cumplido
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {canAssign ? (
          <div className="sp-hero-action">
            <button className="primary-btn" type="button" onClick={() => setShowModal(true)}>
              <Plus size={18} aria-hidden="true" /> Asignar horas
            </button>
          </div>
        ) : null}
      </header>

      <div className="dash-kpi-grid sp-kpis">
        <KpiCard
          icon={<Clock3 size={22} />}
          label="Horas totales"
          value={`${fmtNum.format(progreso.horasTotales)} h`}
          sub={progreso.completado ? `+${fmtNum.format(progreso.horasExtra)} h sobre ${progreso.requisito}` : `Faltan ${fmtNum.format(progreso.horasRestantes)} h`}
          color="#2f68ec"
        />
        <KpiCard icon={<Building2 size={22} />} label="Horas externas" value={`${fmtNum.format(progreso.horasExternas)} h`} color="#7c3aed" />
        <KpiCard icon={<Landmark size={22} />} label="Horas internas" value={`${fmtNum.format(progreso.horasInternas)} h`} color="#0891b2" />
        <KpiCard
          icon={<FolderKanban size={22} />}
          label="Participaciones"
          value={fmtNum.format(participaciones.length)}
          sub={activas > 0 ? `${activas} en curso` : undefined}
          color="#d9488f"
        />
      </div>

      <div className="sp-grid">
        <section className="sp-card sp-progress-card" aria-labelledby="sp-progress-title">
          <h2 id="sp-progress-title" className="sp-card-title">Progreso hacia el requisito</h2>
          <HoursProgressRing progreso={progreso} />
          <dl className="sp-breakdown">
            <div><dt>Importadas del CSS</dt><dd>{fmtNum.format(progreso.horasImportadas)} h</dd></div>
            <div><dt>Asignadas manualmente</dt><dd>{fmtNum.format(progreso.horasManuales)} h</dd></div>
          </dl>
        </section>

        <section className="sp-card" aria-labelledby="sp-info-title">
          <h2 id="sp-info-title" className="sp-card-title">Información general</h2>
          <dl className="sp-info">
            <div><dt><UserRound size={15} aria-hidden="true" /> Nombre completo</dt><dd>{student.nombre}</dd></div>
            <div><dt><Hand size={15} aria-hidden="true" /> Carnet</dt><dd>{student.carnet}</dd></div>
            <div>
              <dt><Mail size={15} aria-hidden="true" /> Correo institucional</dt>
              <dd><a href={`mailto:${student.correoInstitucional}`}>{student.correoInstitucional}</a></dd>
            </div>
            {student.emailPersonal ? (
              <div><dt><Mail size={15} aria-hidden="true" /> Correo personal</dt><dd>{student.emailPersonal}</dd></div>
            ) : null}
            <div><dt><GraduationCap size={15} aria-hidden="true" /> Carrera</dt><dd>{student.carrera.nombre}</dd></div>
            <div><dt><Building2 size={15} aria-hidden="true" /> Facultad</dt><dd>{student.facultad?.nombre ?? 'No asignada'}</dd></div>
            {student.telefono ? (
              <div><dt><Phone size={15} aria-hidden="true" /> Teléfono</dt><dd>{student.telefono}</dd></div>
            ) : null}
            {student.genero ? (
              <div><dt><UserRound size={15} aria-hidden="true" /> Género</dt><dd>{student.genero}</dd></div>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="sp-card sp-history" aria-labelledby="sp-history-title">
        <div className="sp-card-head">
          <h2 id="sp-history-title" className="sp-card-title">Historial de proyectos y participaciones</h2>
          <span className="muted">{participaciones.length} registro{participaciones.length !== 1 ? 's' : ''}</span>
        </div>
        {participaciones.length === 0 ? (
          <p className="muted">El estudiante aún no tiene participaciones registradas.</p>
        ) : (
          <ul className="sp-parts">
            {participaciones.map((p) => (
              <ParticipationItem
                key={p.enrollmentId}
                p={p}
                highlight={p.enrollmentId === flashProjectId}
                onRevoke={canAssign ? setRevokeTarget : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {showModal ? (
        <ManualHoursModal profile={profile} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      ) : null}

      {revokeTarget ? (
        <RevokeHoursModal
          studentId={student.id}
          movement={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={handleRevoked}
        />
      ) : null}

      {toast ? (
        <div className="sp-toast" role="status">
          <BadgeCheck size={18} aria-hidden="true" /> {toast}
        </div>
      ) : null}
    </div>
  );
}
