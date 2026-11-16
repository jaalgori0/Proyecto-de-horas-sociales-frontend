/**
 * Confirmar o descartar el lote. Ambas acciones piden un segundo clic con el
 * resumen de lo que va a pasar: la confirmación escribe en la base y no se deshace.
 */
import { CheckCircle2, Loader2, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatNumber } from './importLabels';

export type ImportActionCounts = {
  insertar: number;
  completar: number;
  conflictos: number;
  horasNuevas: number;
};

export default function ImportActions({
  counts,
  blockedReason,
  busy,
  onConfirm,
  onDiscard,
}: {
  counts: ImportActionCounts;
  /** Si hay motivo, Confirmar queda deshabilitado y se muestra el motivo. */
  blockedReason: string | null;
  busy: 'confirm' | 'discard' | null;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const [pending, setPending] = useState<'confirm' | 'discard' | null>(null);
  const nothingToWrite = counts.insertar === 0 && counts.completar === 0;

  if (pending === 'confirm') {
    return (
      <section className="imp-card imp-confirm-box">
        <strong>¿Confirmar la importación?</strong>
        <ul>
          <li>Se insertarán <strong>{formatNumber(counts.insertar)}</strong> registros nuevos
            {counts.horasNuevas > 0 ? <> con <strong>{formatNumber(counts.horasNuevas)}</strong> horas</> : null}.</li>
          <li>Se completarán <strong>{formatNumber(counts.completar)}</strong> registros con campos vacíos.</li>
          {counts.conflictos > 0 ? (
            <li>
              <strong>{formatNumber(counts.conflictos)}</strong> {counts.conflictos === 1 ? 'conflicto' : 'conflictos'}{' '}
              <strong>no</strong> se {counts.conflictos === 1 ? 'cargará y queda' : 'cargarán y quedan'} para revisión manual.
            </li>
          ) : null}
          <li>Lo que ya existe no se modifica. Esta acción no se puede deshacer.</li>
        </ul>
        <div className="imp-actions-row">
          <button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => setPending(null)}>Cancelar</button>
          <button type="button" className="primary-btn" disabled={busy !== null} onClick={() => { onConfirm(); setPending(null); }}>
            {busy === 'confirm' ? <Loader2 size={18} className="imp-spin" /> : <CheckCircle2 size={18} />}
            Sí, importar
          </button>
        </div>
      </section>
    );
  }

  if (pending === 'discard') {
    return (
      <section className="imp-card imp-confirm-box imp-confirm-danger">
        <strong>¿Descartar este lote?</strong>
        <p className="muted">No se escribirá nada en la base. Para importar estos archivos tendrá que subirlos de nuevo.</p>
        <div className="imp-actions-row">
          <button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => setPending(null)}>Cancelar</button>
          <button type="button" className="imp-danger-btn" disabled={busy !== null} onClick={() => { onDiscard(); setPending(null); }}>
            {busy === 'discard' ? <Loader2 size={18} className="imp-spin" /> : <Trash2 size={18} />}
            Sí, descartar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="imp-card imp-actions-bar">
      <div className="imp-actions-copy">
        {blockedReason ? (
          <span className="imp-blocked"><Lock size={16} /> {blockedReason}</span>
        ) : nothingToWrite ? (
          <span className="muted">No hay registros nuevos ni campos por completar: confirmar solo deja el lote en el historial.</span>
        ) : (
          <span className="muted">
            Al confirmar se insertan <strong>{formatNumber(counts.insertar)}</strong> registros y se completan{' '}
            <strong>{formatNumber(counts.completar)}</strong>
            {counts.conflictos > 0 ? (
              <> · {formatNumber(counts.conflictos)} {counts.conflictos === 1 ? 'conflicto se omite' : 'conflictos se omiten'}</>
            ) : null}.
          </span>
        )}
      </div>
      <div className="imp-actions-row">
        <button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => setPending('discard')}>
          <Trash2 size={16} /> Descartar lote
        </button>
        <button type="button" className="primary-btn" disabled={busy !== null || blockedReason !== null} onClick={() => setPending('confirm')}>
          {busy === 'confirm' ? <Loader2 size={18} className="imp-spin" /> : <CheckCircle2 size={18} />}
          Confirmar importación
        </button>
      </div>
    </section>
  );
}
