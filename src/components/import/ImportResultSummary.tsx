/** Resumen de lo que escribió la confirmación (import_batches.resultado). */
import { CheckCircle2 } from 'lucide-react';
import type { ImportResultado } from '../../services/api';
import { RESULTADO_ORDEN, formatDateTime, formatNumber, resultadoLabels } from './importLabels';

export default function ImportResultSummary({
  resultado,
  confirmadoEn,
  conflictos,
}: {
  resultado: ImportResultado | null;
  confirmadoEn: string | null;
  conflictos: number;
}) {
  const steps = resultado ?? {};
  const keys = [...RESULTADO_ORDEN.filter((k) => k in steps), ...Object.keys(steps).filter((k) => !RESULTADO_ORDEN.includes(k))];
  const escritos = keys.reduce((sum, k) => sum + (steps[k]?.n ?? 0), 0);
  const horas = steps.movimientos_de_horas?.horas ?? 0;

  return (
    <section className="dash-chart-card imp-result">
      <div className="imp-result-head">
        <span className="imp-result-icon"><CheckCircle2 size={26} /></span>
        <div>
          <h3 className="dash-chart-title">Importación confirmada</h3>
          <p className="dash-chart-subtitle">
            {formatDateTime(confirmadoEn)} · {formatNumber(escritos)} cambio{escritos !== 1 ? 's' : ''} en la base
            {horas > 0 ? ` · ${formatNumber(horas)} horas registradas` : ''}
            {conflictos > 0
              ? ` · ${formatNumber(conflictos)} ${conflictos === 1 ? 'conflicto quedó' : 'conflictos quedaron'} sin cargar`
              : ''}
          </p>
        </div>
      </div>
      <div className="dash-kpi-grid imp-result-grid">
        {keys.map((k) => (
          <div key={k} className={`imp-result-cell ${steps[k]?.n ? 'has-value' : ''}`}>
            <span className="dash-kpi-label">{resultadoLabels[k] ?? k}</span>
            <strong className="dash-kpi-value">{formatNumber(steps[k]?.n ?? 0)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
