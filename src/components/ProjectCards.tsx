import { MapPin, Users, Clock, ChevronRight, UserPlus, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ORIGEN_PROYECTO_LABELS, type OrigenProyecto, type Proyecto } from '../types';
import { AvatarGroup } from './ui';
import { PROJECT_CLASIFICACION_LABELS, type ProjectClasificacion } from '../services/api';

/** Explicación del origen (tooltip de la etiqueta). Ninguno es un registro inválido. */
const ORIGEN_TITULOS: Record<OrigenProyecto, string> = {
  REPORTE_CSS: 'Viene en el reporte oficial del CSS (Memoria de Labores)',
  SOLO_PDF: 'Tiene estudiantes en los reportes de horas (PDF), pero no figura en la Memoria de Labores del CSS',
  APP: 'Creado en la app; aún sin correlativo del CSS',
  INTERNO: 'Proyecto interno del sistema para asignaciones manuales y convalidaciones',
};

// ─── Estado badge colors ──────────────────────────────────────────────────────
const estadoConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Activo: { label: 'Activo', color: '#0d6d3e', bg: '#dcfce7', dot: '#16a34a' },
  'En progreso': { label: 'En progreso', color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  Cerrado: { label: 'Cerrado', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
};

function normalizeVisibleStatus(estado: string) {
  if (estado === 'Activo') return 'Activo';
  if (estado === 'Cerrado') return 'Cerrado';
  return 'En progreso';
}

/**
 * Cupos e inscritos tal como los calcula el backend (dinámicos desde project_enrollments):
 *   - inscritos: participaciones ASIGNADA/EN_CURSO/FINALIZADA/RETIRADA (las abandonadas cuentan, como en el reporte del CSS).
 *   - ocupados:  ASIGNADA/EN_CURSO, las únicas que ocupan cupo hoy.
 *   - limite:    projects.cupos; null si el proyecto no define cupos (los importados del CSS
 *                no los traen). Sin límite NO se inventa un total.
 */
function resumenCupos(project: Proyecto) {
  const ocupados = project.cuposOcupados ?? 0;
  const inscritos = project.estudiantesAsignados ?? ocupados;
  const limite = project.cuposTotales ?? null;
  const disponibles = limite != null ? Math.max(limite - ocupados, 0) : null;
  const cerrado = normalizeVisibleStatus(project.estado) === 'Cerrado';
  return { ocupados, inscritos, limite, disponibles, puedeInscribir: !cerrado && (disponibles == null || disponibles > 0) };
}

function EstadoBadge({ estado }: { estado: string }) {
  const visibleEstado = normalizeVisibleStatus(estado);
  const cfg = estadoConfig[visibleEstado] ?? { label: visibleEstado, color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '1rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: cfg.color,
        background: cfg.bg,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Cupos progress bar ───────────────────────────────────────────────────────
function CuposBar({ ocupados, totales, inscritos }: { ocupados: number; totales: number | null; inscritos: number }) {
  if (totales == null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem' }}>
        <span style={{ color: '#687182', fontWeight: 600 }}>
          <Users size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Sin límite de cupos
        </span>
        <span style={{ fontWeight: 700, color: '#1c2433' }}>
          {ocupados} en curso{inscritos > ocupados ? ` · ${inscritos - ocupados} finalizado${inscritos - ocupados !== 1 ? 's' : ''}` : ''}
        </span>
      </div>
    );
  }
  const pct = totales > 0 ? Math.min((ocupados / totales) * 100, 100) : 0;
  const full = pct >= 100;
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 5,
          fontSize: '1rem',
        }}
      >
        <span style={{ color: '#687182', fontWeight: 600 }}>
          <Users size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
          Cupos
        </span>
        <span style={{ fontWeight: 700, color: full ? '#dc2626' : '#1c2433' }}>
          {ocupados} / {totales}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: '#e9edf5',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: full
              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
              : pct > 70
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : 'linear-gradient(90deg, #2f68ec, #21c08a)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

// ─── ProjectListCard ──────────────────────────────────────────────────────────
export function ProjectListCard({
  project,
  onEnroll,
}: {
  project: Proyecto;
  onEnroll?: (project: Proyecto) => void;
}) {
  const { ocupados, inscritos, limite, disponibles, puedeInscribir } = resumenCupos(project);

  return (
    <article
      className="project-list-card"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 0,
        padding: 0,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #fbfcff 0%, #ffffff 100%)',
        border: '1px solid #e0e6f0',
        borderRadius: 16,
        boxShadow: '0 2px 8px rgba(28,41,71,0.05), 0 4px 16px rgba(28,41,71,0.04)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* Main content */}
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Top line: estado + institución + ubicación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <EstadoBadge estado={project.estado} />
          <span style={{ color: '#2f68ec', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {project.institucion}
          </span>
          <span style={{ color: '#c5ccd8' }}>•</span>
          <span style={{ color: '#687182', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={11} />
            {project.ubicacion}
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            margin: 0,
            fontSize: '1.16rem',
            fontWeight: 700,
            lineHeight: 1.35,
            color: '#1c2433',
          }}
        >
          {project.titulo}
        </h2>

        {project.clasificaciones?.length || project.origen ? (
          <div className="classification-tags" aria-label="Clasificación y origen del proyecto">
            {project.origen ? (
              <span className={`origin-tag origin-${project.origen.toLowerCase()}`} title={ORIGEN_TITULOS[project.origen]}>
                {ORIGEN_PROYECTO_LABELS[project.origen]}
              </span>
            ) : null}
            {(project.clasificaciones ?? []).map((code) => (
              <span key={code} className="classification-tag">
                {PROJECT_CLASIFICACION_LABELS[code as ProjectClasificacion] ?? code}
              </span>
            ))}
          </div>
        ) : null}

        {/* Description */}
        {project.descripcion ? (
          <p
            style={{
              margin: 0,
              fontSize: '0.95rem',
              color: '#687182',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {project.descripcion}
          </p>
        ) : null}

        {/* Carreras chips */}
        {project.carreras.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <BookOpen size={13} style={{ color: '#9aa3b5', marginTop: 2, flexShrink: 0 }} />
            {project.carreras.map((c) => (
              <span
                key={c}
                style={{
                  padding: '2px 9px',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: '#eef2fb',
                  color: '#4a5a7a',
                  border: '1px solid #dde3ef',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}

        {/* Bottom: avatar group + cupos bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
          {inscritos > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AvatarGroup count={inscritos} />
              <span style={{ fontSize: '0.86rem', color: '#687182' }}>
                {inscritos} inscrito{inscritos !== 1 ? 's' : ''}
              </span>
            </div>
          ) : null}
          <div style={{ flex: 1 }}>
            <CuposBar ocupados={ocupados} totales={limite} inscritos={inscritos} />
          </div>
        </div>
      </div>

      {/* Right sidebar: actions */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 10,
          padding: '20px 18px',
          borderLeft: '1px solid #edf0f8',
          background: 'rgba(248, 250, 255, 0.6)',
          minWidth: 176,
        }}
      >
        {/* Cupos disponibles summary */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: disponibles === 0 ? '#dc2626' : '#1c2433', lineHeight: 1 }}>
            {disponibles ?? inscritos}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#9aa3b5', fontWeight: 600, marginTop: 2 }}>
            {disponibles == null ? `inscrito${inscritos !== 1 ? 's' : ''}` : disponibles > 0 ? 'cupos libres' : 'sin cupos'}
          </div>
        </div>

        {puedeInscribir ? (
          <button
            className="primary-btn"
            type="button"
            onClick={() => onEnroll?.(project)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: '0.88rem',
              padding: '10px 16px',
              borderRadius: 10,
              minHeight: 44,
              width: '100%',
            }}
          >
            <UserPlus size={14} />
            Inscribir
          </button>
        ) : (
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#9aa3b5',
              background: '#f3f4f6',
              borderRadius: 10,
              padding: '9px 12px',
            }}
          >
            Cupos llenos
          </div>
        )}

        <Link
          to={`/proyectos/${project.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            fontSize: '0.88rem',
            fontWeight: 700,
            color: '#2f68ec',
            padding: '10px 16px',
            borderRadius: 10,
            border: '1.5px solid #d1deff',
            background: 'white',
            transition: 'background 0.15s',
            minHeight: 44,
            width: '100%',
          }}
        >
          Ver detalles
          <ChevronRight size={14} />
        </Link>
      </div>
    </article>
  );
}

// ─── ProjectCompactCard ───────────────────────────────────────────────────────
export function ProjectCompactCard({ project }: { project: Proyecto }) {
  const { inscritos, disponibles } = resumenCupos(project);

  return (
    <article
      className="compact-project-card"
      style={{
        padding: 16,
        borderRadius: 14,
        border: '1px solid #e0e6f0',
        background: 'linear-gradient(160deg, #fbfcff 0%, #ffffff 100%)',
        boxShadow: '0 2px 8px rgba(28,41,71,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ color: '#2f68ec', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {project.institucion}
        </span>
        <EstadoBadge estado={project.estado} />
      </div>

      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.35, color: '#1c2433' }}>
        {project.titulo}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#687182', fontSize: '0.85rem' }}>
        <MapPin size={12} />
        {project.ubicacion}
      </div>

      {disponibles != null && disponibles > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0d6d3e', fontSize: '0.85rem', fontWeight: 600 }}>
          <Clock size={12} />
          {disponibles} cupo{disponibles !== 1 ? 's' : ''} disponible{disponibles !== 1 ? 's' : ''}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <AvatarGroup count={inscritos} />
        <Link
          to={`/proyectos/${project.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#2f68ec',
          }}
        >
          Ver detalles <ChevronRight size={13} />
        </Link>
      </div>
    </article>
  );
}

// ─── ProjectTeamCard ──────────────────────────────────────────────────────────
export function ProjectTeamCard({
  member,
  role,
  carnet,
  carrera,
}: {
  member: string;
  role: string;
  carnet?: string;
  carrera?: string;
}) {
  const initials = member
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="team-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: '#f8faff',
        border: '1px solid #e8edf8',
      }}
    >
      <div
        className="avatar-circle"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3972f0, #21c08a)',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          fontSize: '0.8rem',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 1px', fontSize: '0.9rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member}
        </p>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#687182' }}>{role}</p>
        {carrera ? <p style={{ margin: 0, fontSize: '0.72rem', color: '#9aa3b5' }}>{carrera}</p> : null}
        {carnet ? <p style={{ margin: 0, fontSize: '0.72rem', color: '#9aa3b5' }}>Carnet: {carnet}</p> : null}
      </div>
    </div>
  );
}
