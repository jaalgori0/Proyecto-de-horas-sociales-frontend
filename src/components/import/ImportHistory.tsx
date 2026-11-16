/** Historial colapsable de los últimos lotes (GET /imports). */
import { ChevronDown, History, RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { ImportBatchListItem } from '../../services/api';
import { Notice } from '../ui';
import { BatchEstadoBadge } from './ImportBadges';
import { ITEM_ESTADOS, formatDateTime, formatNumber, itemEstadoConfig } from './importLabels';

export default function ImportHistory({
  batches,
  loading,
  error,
  activeId,
  disabled = false,
  onOpen,
  onRefresh,
}: {
  batches: ImportBatchListItem[];
  loading: boolean;
  error: string;
  activeId: string | null;
  /** Deshabilita "Abrir" mientras hay una operación en curso sobre el lote actual. */
  disabled?: boolean;
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="dash-chart-card imp-history">
      <div className="imp-history-head">
        <button type="button" className="imp-history-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <History size={18} />
          <span className="dash-chart-title">Historial reciente</span>
          <span className="imp-tab-count">{batches.length}</span>
          <ChevronDown size={18} className={open ? 'imp-rotate' : ''} />
        </button>
        {open ? (
          <button type="button" className="imp-link-btn" onClick={onRefresh} disabled={loading}>
            <RotateCw size={14} className={loading ? 'imp-spin' : ''} /> Actualizar
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          {error ? <Notice title="No se pudo cargar el historial" onRetry={onRefresh}>{error}</Notice> : null}
          {!error && !loading && batches.length === 0 ? <p className="muted">Aún no hay importaciones.</p> : null}
          {batches.length > 0 ? (
            <div className="dash-table-wrapper">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Archivos</th>
                    {ITEM_ESTADOS.map((e) => <th key={e}>{itemEstadoConfig[e].plural}</th>)}
                    <th>Por</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const total = 'total' in b.resumen ? b.resumen.total : null;
                    return (
                      <tr key={b.id} className={b.id === activeId ? 'imp-history-active' : ''}>
                        <td>
                          {formatDateTime(b.creadoEn)}
                          {b.confirmadoEn ? <div className="muted imp-small">Confirmado {formatDateTime(b.confirmadoEn)}</div> : null}
                        </td>
                        <td><BatchEstadoBadge estado={b.estado} expirado={b.expirado} /></td>
                        <td>{b.archivos}</td>
                        {ITEM_ESTADOS.map((e) => (
                          <td key={e} style={{ color: total && total[e] > 0 ? itemEstadoConfig[e].color : undefined }}>
                            {total ? formatNumber(total[e]) : '—'}
                          </td>
                        ))}
                        <td className="muted">{b.creadoPor}</td>
                        <td>
                          {b.estado !== 'DESCARTADO' ? (
                            <button type="button" className="imp-link-btn" onClick={() => onOpen(b.id)} disabled={disabled || b.id === activeId}>
                              {b.id === activeId ? 'Abierto' : b.estado === 'PREVISUALIZADO' && !b.expirado ? 'Continuar' : 'Ver'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
