/** Bitácora de la revisión en línea del lote: quién cambió qué, cuándo y por qué. */
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { describeApiError, getImportReviewLog, type ImportReviewLogEntry } from '../../services/api';
import { formatDateTime } from './importLabels';

const ACCION: Record<ImportReviewLogEntry['accion'], string> = {
  EDITAR: 'Corrección',
  EXCLUIR: 'Exclusión',
  RESTAURAR: 'Restauración',
  DECIDIR: 'Decisión',
};

function resumen(v: Record<string, unknown> | null): string {
  if (!v) return '—';
  return Object.entries(v)
    .filter(([, val]) => val !== null && val !== undefined && val !== false)
    .map(([k, val]) => `${k}: ${String(val)}`)
    .join(' · ') || '—';
}

export default function ImportReviewLog({ batchId, total }: { batchId: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportReviewLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setError('');
    try {
      setRows(await getImportReviewLog(batchId));
    } catch (err) {
      setError(describeApiError(err, 'No se pudo cargar la bitácora.'));
    } finally {
      setLoading(false);
    }
  }

  if (total === 0) return null;
  return (
    <section className="dash-chart-card">
      <button type="button" className="imp-section-toggle" onClick={toggle} aria-expanded={open}>
        <History size={18} />
        <strong>Bitácora de revisión</strong>
        <span className="muted">{total} cambio{total !== 1 ? 's' : ''} vigente{total !== 1 ? 's' : ''}</span>
        <ChevronDown size={18} className={`imp-chevron ${open ? 'imp-rotate' : ''}`} />
      </button>
      {open ? (
        loading ? <p className="muted"><Loader2 size={16} className="imp-spin" /> Cargando…</p>
        : error ? <p className="imp-review-hint danger">{error}</p>
        : (
          <div className="dash-table-wrapper">
            <table className="dash-table imp-compare">
              <thead>
                <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Antes</th><th>Después</th><th>Justificación</th></tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.creadoEn)}</td>
                    <td>{r.actor}</td>
                    <td>{ACCION[r.accion]}{r.clave ? ` · ${r.clave}` : r.pdfRowId ? ` · fila ${r.pdfRowId}` : ''}</td>
                    <td>{resumen(r.valorAnterior ?? r.valorOriginal)}</td>
                    <td>{resumen(r.valorNuevo)}</td>
                    <td>{r.justificacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
