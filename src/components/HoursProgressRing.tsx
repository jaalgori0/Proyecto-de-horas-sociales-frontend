/**
 * Rueda de progreso hacia el requisito de horas sociales (600 h).
 *
 *  - Menos del requisito: el anillo muestra el porcentaje (truncado por el
 *    backend: 599 h = 99 %) en azul.
 *  - Requisito cumplido: anillo completo en verde, total real y horas extra.
 *    El estado "completado" lleva ícono + texto, nunca solo color.
 */
import { CheckCircle2 } from 'lucide-react';
import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
import type { StudentProgress } from '../services/api';

const COLOR_PROGRESS = '#2f68ec'; // --blue
const COLOR_DONE = '#16a34a'; // verde de estado "Activo" (contraste ≥ 3:1 sobre blanco)
const COLOR_TRACK = '#eef2fb'; // --bg-deep

const fmt = new Intl.NumberFormat('es-SV');

export default function HoursProgressRing({ progreso, size = 220 }: { progreso: StudentProgress; size?: number }) {
  const { horasTotales, requisito, porcentaje, completado, horasExtra, horasRestantes } = progreso;
  const color = completado ? COLOR_DONE : COLOR_PROGRESS;
  const data = [{ name: 'avance', value: porcentaje, fill: color }];

  const summary = completado
    ? `${fmt.format(horasTotales)} de ${fmt.format(requisito)} horas: requisito cumplido${horasExtra > 0 ? `, ${fmt.format(horasExtra)} horas extra` : ''}`
    : `${fmt.format(horasTotales)} de ${fmt.format(requisito)} horas, ${porcentaje} por ciento`;

  return (
    <div className="hours-ring" role="img" aria-label={summary}>
      <div className="hours-ring-chart" style={{ width: size, height: size }}>
        <RadialBarChart
          width={size}
          height={size}
          cx="50%"
          cy="50%"
          innerRadius="78%"
          outerRadius="100%"
          barSize={16}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            dataKey="value"
            angleAxisId={0}
            cornerRadius={porcentaje > 0 && porcentaje < 100 ? 8 : 0}
            background={{ fill: COLOR_TRACK }}
            isAnimationActive
            animationDuration={700}
          />
        </RadialBarChart>
        <div className="hours-ring-center" aria-hidden="true">
          <strong className="hours-ring-value">{fmt.format(horasTotales)}</strong>
          <span className="hours-ring-of">de {fmt.format(requisito)} h</span>
          <span className="hours-ring-pct">{porcentaje}%</span>
        </div>
      </div>

      {completado ? (
        <div className="hours-ring-status done">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>
            Requisito cumplido
            {horasExtra > 0 ? <> · <strong>+{fmt.format(horasExtra)} h extra</strong></> : null}
          </span>
        </div>
      ) : (
        <div className="hours-ring-status">
          Faltan <strong>{fmt.format(horasRestantes)} h</strong> para el requisito
        </div>
      )}
    </div>
  );
}
