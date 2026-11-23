/**
 * Aviso de nombre equivalente al crear o editar (backend: 409 PROYECTO_SIMILAR /
 * INSTITUCION_SIMILAR). Ya existe un proyecto (importado del CSS o creado en la app) o una
 * institución cuyo nombre solo difiere en mayúsculas, tildes, espacios o puntuación.
 * Permite ir al existente / usarlo, o guardar igual a sabiendas (si el backend lo permite).
 */
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../services/api';

export type SimilarInfo =
  | {
      tipo: 'PROYECTO';
      message: string;
      puedeConfirmar: boolean;
      similares: Array<{ id: string; titulo: string; correlativoCss: string | null; estado: string }>;
    }
  | {
      tipo: 'INSTITUCION';
      message: string;
      puedeConfirmar: boolean;
      similares: Array<{ id: string; nombre: string; codigoCss: string | null }>;
    };

/** El error es un 409 de nombre equivalente: devuelve los datos para el aviso. */
export function parseSimilar(error: unknown): SimilarInfo | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const d = error.details as { code?: string; similares?: unknown[]; puedeConfirmar?: boolean } | undefined;
  if (!d || !Array.isArray(d.similares)) return null;
  if (d.code === 'PROYECTO_SIMILAR') {
    return { tipo: 'PROYECTO', message: error.message, puedeConfirmar: d.puedeConfirmar !== false, similares: d.similares as never };
  }
  if (d.code === 'INSTITUCION_SIMILAR') {
    return { tipo: 'INSTITUCION', message: error.message, puedeConfirmar: d.puedeConfirmar !== false, similares: d.similares as never };
  }
  return null;
}

export default function SimilarRecordsNotice({ info, busy, onConfirm, onCancel, onUseInstitution }: {
  info: SimilarInfo;
  busy: boolean;
  /** Guardar igual (reenvía con confirmarSimilar). */
  onConfirm: () => void;
  onCancel: () => void;
  /** Institución: usar la existente en lugar de crear otra. */
  onUseInstitution?: (nombre: string) => void;
}) {
  return (
    <div className="similar-notice" role="alert">
      <strong><AlertTriangle size={16} /> {info.message}</strong>
      <p className="muted">
        {info.tipo === 'PROYECTO'
          ? 'Difiere solo en mayúsculas, tildes, espacios o puntuación. Revise si es el mismo proyecto antes de crear otro.'
          : 'Difiere solo en mayúsculas, tildes, espacios o puntuación. Use la existente para no duplicar la institución.'}
      </p>
      <ul>
        {info.tipo === 'PROYECTO'
          ? info.similares.map((p) => (
              <li key={p.id}>
                <span>
                  {p.titulo} · {p.correlativoCss ? `correlativo CSS ${p.correlativoCss}` : 'creado en la app'} · {p.estado}
                </span>
                <Link to={`/proyectos/${p.id}`} onClick={onCancel}>Ver existente <ArrowRight size={13} /></Link>
              </li>
            ))
          : info.similares.map((i) => (
              <li key={i.id}>
                <span>{i.nombre}{i.codigoCss ? ` · código CSS ${i.codigoCss}` : ' · creada en la app'}</span>
                {onUseInstitution ? (
                  <button type="button" className="secondary-btn" disabled={busy} onClick={() => onUseInstitution(i.nombre)}>
                    Usar esta institución
                  </button>
                ) : null}
              </li>
            ))}
      </ul>
      <div className="similar-notice-actions">
        <button type="button" className="secondary-btn" disabled={busy} onClick={onCancel}>Revisar</button>
        {info.puedeConfirmar ? (
          <button type="button" className="primary-btn" disabled={busy} onClick={onConfirm}>
            {info.tipo === 'PROYECTO' ? 'Es otro proyecto: guardar igual' : 'Es otra institución: guardar igual'}
          </button>
        ) : (
          <span className="muted">Ya existe uno idéntico creado en la app: elija el existente o cambie el nombre.</span>
        )}
      </div>
    </div>
  );
}
