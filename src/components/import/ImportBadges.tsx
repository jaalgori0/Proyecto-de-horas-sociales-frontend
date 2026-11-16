import type { ImportBatchEstado, ImportItemEstado } from '../../services/api';
import { batchEstadoConfig, itemEstadoConfig, motivoLabel, motivoTone } from './importLabels';

function Pill({ label, color, bg, dot }: { label: string; color: string; bg: string; dot: string }) {
  return (
    <span className="imp-pill" style={{ color, background: bg }}>
      <span className="imp-pill-dot" style={{ background: dot }} />
      {label}
    </span>
  );
}

export function ItemEstadoBadge({ estado }: { estado: ImportItemEstado }) {
  const cfg = itemEstadoConfig[estado];
  return <Pill label={cfg.label} color={cfg.color} bg={cfg.bg} dot={cfg.dot} />;
}

export function BatchEstadoBadge({ estado, expirado = false }: { estado: ImportBatchEstado; expirado?: boolean }) {
  const cfg = batchEstadoConfig[expirado && estado === 'PREVISUALIZADO' ? 'EXPIRADO' : estado];
  return <Pill label={cfg.label} color={cfg.color} bg={cfg.bg} dot={cfg.dot} />;
}

export function MotivoTag({ motivo }: { motivo: string }) {
  return <span className={`imp-tag imp-tag-${motivoTone(motivo)}`}>{motivoLabel(motivo)}</span>;
}
