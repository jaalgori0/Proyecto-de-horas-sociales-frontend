/**
 * Confirmación para revocar un movimiento de horas MANUAL.
 * Muestra exactamente lo que se elimina (horas, concepto, proyecto, fecha) y
 * deja claro que queda registrado en la auditoría.
 */
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deleteManualHours, describeApiError, type StudentHourMovement, type StudentProfile } from '../services/api';

const fmtNum = new Intl.NumberFormat('es-SV');
const fmtDate = new Intl.DateTimeFormat('es-SV', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/El_Salvador' });

export default function RevokeHoursModal({
  studentId,
  movement,
  onClose,
  onRevoked,
}: {
  studentId: string;
  movement: StudentHourMovement;
  onClose: () => void;
  onRevoked: (profile: StudentProfile, movement: StudentHourMovement) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Foco en "Cancelar": la acción destructiva nunca es la opción por defecto.
    cancelRef.current?.focus();
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  async function handleConfirm() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const { profile } = await deleteManualHours(studentId, movement.id);
      onRevoked(profile, movement);
    } catch (err) {
      setError(describeApiError(err, 'No se pudo revocar el movimiento'));
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="revoke-title"
      aria-describedby="revoke-desc"
      onKeyDown={(e) => e.key === 'Escape' && !saving && onClose()}
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modal-card revoke-modal">
        <div className="modal-header">
          <div className="revoke-head">
            <span className="revoke-icon" aria-hidden="true">
              <AlertTriangle size={20} />
            </span>
            <h2 id="revoke-title">Revocar horas</h2>
          </div>
          <button className="icon-btn small" type="button" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={16} />
          </button>
        </div>

        <p id="revoke-desc" className="revoke-text">
          Se eliminarán <strong>{fmtNum.format(movement.horas)} h</strong> asignadas manualmente. El progreso del
          estudiante se recalculará y la eliminación quedará registrada en la auditoría con su usuario.
        </p>

        <dl className="revoke-summary">
          <div>
            <dt>Horas</dt>
            <dd>−{fmtNum.format(movement.horas)} h</dd>
          </div>
          <div>
            <dt>Concepto</dt>
            <dd>{movement.concepto ?? '—'}</dd>
          </div>
          <div>
            <dt>Proyecto</dt>
            <dd>{movement.proyecto}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{fmtDate.format(new Date(`${movement.fecha}T12:00:00-06:00`))}</dd>
          </div>
          {movement.registradoPor ? (
            <div>
              <dt>Registrado por</dt>
              <dd>{movement.registradoPor.nombre}</dd>
            </div>
          ) : null}
        </dl>

        {error ? (
          <p className="modal-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-footer">
          <button ref={cancelRef} className="secondary-btn" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="primary-btn danger-btn" type="button" onClick={() => void handleConfirm()} disabled={saving}>
            {saving ? 'Revocando...' : 'Revocar horas'}
          </button>
        </div>
      </div>
    </div>
  );
}
