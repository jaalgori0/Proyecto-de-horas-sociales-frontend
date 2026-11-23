/**
 * Impacto estimado de confirmar el lote: el backend aplica el lote dentro de un SAVEPOINT,
 * mide la base antes y después y revierte. Es la misma escritura que la confirmación.
 */
import { Activity } from 'lucide-react';
import type { ImportImpacto, ImportMetricasMaestro } from '../../services/api';
import { formatNumber } from './importLabels';

const FILAS: Array<{ key: keyof ImportMetricasMaestro; label: string }> = [
  { key: 'participacionesActivas', label: 'Participaciones activas' },
  { key: 'participacionesFinalizadas', label: 'Participaciones finalizadas' },
  { key: 'participacionesRetiradas', label: 'Participaciones retiradas' },
  { key: 'participantes', label: 'Estudiantes participantes' },
  { key: 'horasTotales', label: 'Horas totales' },
  { key: 'proyectosFinalizados', label: 'Proyectos finalizados' },
  { key: 'estudiantesCon600', label: 'Estudiantes con 600 h' },
];

function Delta({ n }: { n: number }) {
  if (n === 0) return <span className="muted">sin cambio</span>;
  return <strong className={n > 0 ? 'imp-delta-up' : 'imp-delta-down'}>{n > 0 ? '+' : '−'}{formatNumber(Math.abs(n))}</strong>;
}

export default function ImportImpactPanel({ impacto, actualizar, horasActualizadas }: {
  impacto: ImportImpacto | null | undefined;
  actualizar: number;
  horasActualizadas: number;
}) {
  if (!impacto) return null;
  return (
    <section className="dash-chart-card imp-impact">
      <div className="imp-impact-head">
        <Activity size={18} />
        <strong>Impacto estimado al confirmar</strong>
        {actualizar > 0 ? (
          <span className="muted">
            · {formatNumber(actualizar)} participación{actualizar !== 1 ? 'es' : ''} existente{actualizar !== 1 ? 's' : ''} se
            actualiza{actualizar !== 1 ? 'n' : ''} (+{formatNumber(horasActualizadas)} h del CSS)
          </span>
        ) : null}
      </div>
      {impacto.ok ? (
        <div className="dash-table-wrapper">
          <table className="dash-table imp-compare">
            <thead>
              <tr><th>Indicador</th><th>Hoy</th><th>Después de confirmar</th><th>Cambio</th></tr>
            </thead>
            <tbody>
              {FILAS.map(({ key, label }) => (
                <tr key={key} className={impacto.delta[key] !== 0 ? 'imp-diff' : ''}>
                  <td>{label}</td>
                  <td>{formatNumber(impacto.antes[key])}</td>
                  <td>{formatNumber(impacto.despues[key])}</td>
                  <td><Delta n={impacto.delta[key]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="imp-review-hint danger">
          No se pudo simular la confirmación: {impacto.error}. Confirmar también fallaría; revise los conflictos.
        </p>
      )}
    </section>
  );
}
