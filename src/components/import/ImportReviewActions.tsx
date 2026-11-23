/**
 * Revisión en línea de un ítem de la vista previa (sin editar Excel).
 *
 *  • Fila de PDF: editar estado/horas/fechas, acciones de un clic para "Activo con fecha
 *    de fin" (quitar la fecha o marcar Finalizado), excluir con justificación, conservar
 *    una de las filas duplicadas (excluye las demás) y restaurar una fila excluida.
 *  • Participación: decidir los aumentos de horas en participaciones ya finalizadas
 *    (aceptar el reporte o conservar la base) y corregir la fila de origen.
 *  • Proyecto: si coincide (nombre equivalente) con proyectos creados en la app, vincularlo
 *    a uno de ellos o confirmar que es otro proyecto (en vez de crear copias en silencio).
 *
 * Toda acción exige justificación (queda en la bitácora del lote). El backend vuelve a
 * clasificar con las mismas reglas: una corrección inválida sigue en Conflictos.
 */
import { Check, Link2, Loader2, Pencil, PlusCircle, RotateCcw, Scale, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { ImportDecision, ImportItem, ImportProjectLinkDecision, ImportRowCambios } from '../../services/api';

export type ReviewHandlers = {
  busy: boolean;
  onEdit: (rowId: number, cambios: ImportRowCambios, justificacion: string) => Promise<boolean>;
  onExclude: (rowIds: number[], justificacion: string) => Promise<boolean>;
  onRestore: (rowId: number, justificacion: string) => Promise<boolean>;
  onDecide: (clave: string, decision: ImportDecision, justificacion: string) => Promise<boolean>;
  onLink: (clave: string, decision: ImportProjectLinkDecision, projectId: string | null, justificacion: string) => Promise<boolean>;
};

const SIN_FECHA = '01/01/1900';
const ESTADOS = ['Activo', 'Finalizado', 'Abandonado'] as const;
type EstadoReporte = (typeof ESTADOS)[number];

/** 'DD/MM/AAAA' → 'AAAA-MM-DD' (input type="date"); '' si no aplica. */
function reporteToIso(value: unknown): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? ''));
  return m && String(value) !== SIN_FECHA ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
function isoToReporte(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

type Valores = { estado: string; horas: string; fechaInicio: string; fechaFin: string };

/** Valores vigentes de la fila (con su corrección), en formato del formulario. */
function valoresDe(item: ImportItem): Valores {
  const d = item.datos;
  if (item.entidad === 'PARTICIPACION') {
    return {
      estado: String(d.estadoReporte ?? ''),
      horas: d.horas == null ? '' : String(d.horas),
      fechaInicio: typeof d.fechaInicio === 'string' ? d.fechaInicio.slice(0, 10) : '',
      fechaFin: typeof d.fechaFin === 'string' ? d.fechaFin.slice(0, 10) : '',
    };
  }
  return {
    estado: String(d.estado ?? ''),
    horas: d.horas == null ? '' : String(d.horas),
    fechaInicio: reporteToIso(d.fechaInicio),
    fechaFin: reporteToIso(d.fechaFin),
  };
}

type Modo =
  | { tipo: 'editar' }
  | { tipo: 'justificar'; titulo: string; sugerida: string; run: (j: string) => Promise<boolean>; peligro?: boolean };

function EditForm({ item, busy, onCancel, onSubmit }: {
  item: ImportItem;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (cambios: ImportRowCambios, justificacion: string) => Promise<boolean>;
}) {
  const inicial = valoresDe(item);
  const [estado, setEstado] = useState(inicial.estado);
  const [horas, setHoras] = useState(inicial.horas);
  const [fechaInicio, setFechaInicio] = useState(inicial.fechaInicio);
  const [fechaFin, setFechaFin] = useState(inicial.fechaFin);
  const [sinFin, setSinFin] = useState(inicial.fechaFin === '');
  const [justificacion, setJustificacion] = useState('');
  const editada = item.datos.editada === true;

  const cambios: ImportRowCambios = {};
  if (estado !== inicial.estado && (ESTADOS as readonly string[]).includes(estado)) cambios.estado = estado as EstadoReporte;
  if (horas !== inicial.horas && horas.trim() !== '') cambios.horas = Number(horas);
  if (fechaInicio !== inicial.fechaInicio && fechaInicio) cambios.fechaInicio = isoToReporte(fechaInicio);
  const finActual = sinFin ? '' : fechaFin;
  if (finActual !== inicial.fechaFin) cambios.fechaFin = sinFin || !fechaFin ? SIN_FECHA : isoToReporte(fechaFin);

  const horasValidas = horas.trim() === '' || /^\d{1,6}$/.test(horas.trim());
  const sinCambios = Object.keys(cambios).length === 0;
  const finAntes = !sinFin && fechaFin && fechaInicio && fechaFin < fechaInicio;
  const puedeGuardar = !busy && !sinCambios && horasValidas && justificacion.trim().length >= 5;

  return (
    <form
      className="imp-review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (puedeGuardar && (await onSubmit(cambios, justificacion.trim()))) onCancel();
      }}
    >
      <div className="imp-review-grid">
        <label>
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {!ESTADOS.includes(estado as EstadoReporte) ? <option value={estado}>{estado || '—'}</option> : null}
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          <span>Horas</span>
          <input type="number" min={0} max={999999} step={1} value={horas} onChange={(e) => setHoras(e.target.value)} />
        </label>
        <label>
          <span>Fecha de inicio</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </label>
        <label>
          <span>Fecha de fin</span>
          <input type="date" value={sinFin ? '' : fechaFin} disabled={sinFin} onChange={(e) => setFechaFin(e.target.value)} />
          <span className="imp-review-check">
            <input type="checkbox" checked={sinFin} onChange={(e) => setSinFin(e.target.checked)} /> Sin fecha de fin
          </span>
        </label>
      </div>
      {!horasValidas ? <p className="imp-review-hint danger">Las horas deben ser un número entero.</p> : null}
      {finAntes ? (
        <p className="imp-review-hint danger">La fecha de fin es anterior al inicio: la base no la acepta y la fila seguirá en conflicto.</p>
      ) : null}
      {estado === 'Activo' && !sinFin ? (
        <p className="imp-review-hint">Un estado «Activo» no lleva fecha de fin: marque «Sin fecha de fin» o cambie el estado.</p>
      ) : null}
      <label className="imp-review-just">
        <span>Justificación (obligatoria)</span>
        <textarea rows={2} maxLength={500} value={justificacion} placeholder="Por qué se corrige (queda en la bitácora del lote)"
          onChange={(e) => setJustificacion(e.target.value)} />
      </label>
      <div className="imp-actions-row">
        {editada ? (
          <button type="button" className="secondary-btn" disabled={busy || justificacion.trim().length < 5}
            title="Vuelve a los valores extraídos del PDF"
            onClick={async () => {
              if (await onSubmit({ estado: null, horas: null, fechaInicio: null, fechaFin: null }, justificacion.trim())) onCancel();
            }}>
            <RotateCcw size={16} /> Volver a lo del PDF
          </button>
        ) : null}
        <button type="button" className="secondary-btn" disabled={busy} onClick={onCancel}><X size={16} /> Cancelar</button>
        <button type="submit" className="primary-btn" disabled={!puedeGuardar}>
          {busy ? <Loader2 size={16} className="imp-spin" /> : <Check size={16} />} Guardar corrección
        </button>
      </div>
    </form>
  );
}

function JustifyForm({ titulo, sugerida, peligro, busy, onCancel, run }: {
  titulo: string; sugerida: string; peligro?: boolean; busy: boolean;
  onCancel: () => void; run: (justificacion: string) => Promise<boolean>;
}) {
  const [justificacion, setJustificacion] = useState(sugerida);
  const ok = justificacion.trim().length >= 5;
  return (
    <form className="imp-review-form" onSubmit={async (e) => {
      e.preventDefault();
      if (ok && !busy && (await run(justificacion.trim()))) onCancel();
    }}>
      <strong>{titulo}</strong>
      <label className="imp-review-just">
        <span>Justificación (obligatoria)</span>
        <textarea rows={2} maxLength={500} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
      </label>
      <div className="imp-actions-row">
        <button type="button" className="secondary-btn" disabled={busy} onClick={onCancel}><X size={16} /> Cancelar</button>
        <button type="submit" className={peligro ? 'imp-danger-btn' : 'primary-btn'} disabled={!ok || busy}>
          {busy ? <Loader2 size={16} className="imp-spin" /> : <Check size={16} />} Confirmar
        </button>
      </div>
    </form>
  );
}

export default function ImportReviewActions({ item, items, review }: { item: ImportItem; items: ImportItem[]; review: ReviewHandlers }) {
  const [modo, setModo] = useState<Modo | null>(null);
  const d = item.datos;
  const rowId = typeof d.pdfRowId === 'number' ? d.pdfRowId : d.pdfRowId != null ? Number(d.pdfRowId) : null;
  const excluida = d.excluida === true;
  const esFila = item.entidad === 'FILA_PDF';
  const esParticipacion = item.entidad === 'PARTICIPACION';
  const activoConFin = item.motivos.includes('activo_con_fin');
  const duplicada = item.motivos.includes('participacion_duplicada_en_lote');
  const admiteDecision = esParticipacion && item.motivos.includes('ajuste_horas_finalizada');
  const corregible = rowId !== null && !excluida && (esFila || (esParticipacion && (item.estado === 'CONFLICTO' || d.editada === true)));

  const candidatosApp = item.entidad === 'PROYECTO' && Array.isArray(d.candidatosApp)
    ? (d.candidatosApp as Array<{ id: string; titulo: string; estado: string }>)
    : [];
  const vinculo = (d.vinculo ?? null) as { decision: ImportProjectLinkDecision; projectId: string | null } | null;

  if (rowId === null && !admiteDecision && candidatosApp.length === 0) return null;

  const justificar = (titulo: string, sugerida: string, run: (j: string) => Promise<boolean>, peligro = false) =>
    setModo({ tipo: 'justificar', titulo, sugerida, run, peligro });

  if (modo?.tipo === 'editar' && rowId !== null) {
    return <EditForm item={item} busy={review.busy} onCancel={() => setModo(null)}
      onSubmit={(cambios, j) => review.onEdit(rowId, cambios, j)} />;
  }
  if (modo?.tipo === 'justificar') {
    return <JustifyForm titulo={modo.titulo} sugerida={modo.sugerida} peligro={modo.peligro} busy={review.busy}
      onCancel={() => setModo(null)} run={modo.run} />;
  }

  // Otras filas del mismo duplicado (misma participación repetida en el lote).
  const claveDuplicado = (d.detalles as Record<string, unknown> | undefined)?.participacion_duplicada_en_lote;
  const otrasDuplicadas = duplicada
    ? items.filter((i) => i.id !== item.id && i.entidad === 'FILA_PDF'
        && (i.datos.detalles as Record<string, unknown> | undefined)?.participacion_duplicada_en_lote === claveDuplicado)
        .map((i) => Number(i.datos.pdfRowId)).filter((n) => Number.isFinite(n))
    : [];

  return (
    <div className="imp-review-actions">
      {candidatosApp.map((c) => (
        <button key={c.id} type="button" className="secondary-btn"
          disabled={review.busy || (vinculo?.decision === 'VINCULAR' && vinculo.projectId === c.id)}
          title="El proyecto del reporte es el mismo que se creó en la app: se le asigna este correlativo"
          onClick={() => justificar(`Vincular a «${c.titulo}» (creado en la app)`,
            'Es el mismo proyecto que se registró en la app.',
            (j) => review.onLink(item.clave, 'VINCULAR', c.id, j))}>
          <Link2 size={16} /> Vincular a «{c.titulo}»
        </button>
      ))}
      {candidatosApp.length > 0 ? (
        <button type="button" className="secondary-btn" disabled={review.busy || vinculo?.decision === 'CREAR_NUEVO'}
          onClick={() => justificar('Crear un proyecto nuevo', 'Es un proyecto distinto del que existe en la app.',
            (j) => review.onLink(item.clave, 'CREAR_NUEVO', null, j))}>
          <PlusCircle size={16} /> Es otro proyecto: crear nuevo
        </button>
      ) : null}

      {admiteDecision ? (
        <>
          <button type="button" className="secondary-btn" disabled={review.busy || item.motivos.includes('decision_aceptar_reporte')}
            onClick={() => justificar('Aceptar las horas del reporte', 'El reporte del CSS corrige las horas de esta participación finalizada.',
              (j) => review.onDecide(item.clave, 'ACEPTAR_REPORTE', j))}>
            <Scale size={16} /> Aceptar reporte
          </button>
          <button type="button" className="secondary-btn" disabled={review.busy || item.motivos.includes('decision_conservar_bd')}
            onClick={() => justificar('Conservar las horas de la base', 'Se conservan las horas registradas hasta verificar con el CSS.',
              (j) => review.onDecide(item.clave, 'CONSERVAR_BD', j))}>
            <Scale size={16} /> Conservar base
          </button>
        </>
      ) : null}

      {corregible && activoConFin ? (
        <>
          <button type="button" className="secondary-btn" disabled={review.busy}
            onClick={() => justificar('Quitar la fecha de fin', 'Activo en el reporte: se quita la fecha de fin.',
              (j) => review.onEdit(rowId!, { fechaFin: SIN_FECHA }, j))}>
            Quitar fecha de fin
          </button>
          <button type="button" className="secondary-btn" disabled={review.busy}
            onClick={() => justificar('Marcar como Finalizado', 'Tiene fecha de fin: se marca como Finalizado.',
              (j) => review.onEdit(rowId!, { estado: 'Finalizado' }, j))}>
            Marcar Finalizado
          </button>
        </>
      ) : null}

      {corregible && duplicada && otrasDuplicadas.length > 0 ? (
        <button type="button" className="secondary-btn" disabled={review.busy}
          onClick={() => justificar('Conservar esta fila y excluir la repetida',
            'Participación repetida en el reporte: se conserva esta fila.',
            (j) => review.onExclude(otrasDuplicadas, j))}>
          <Check size={16} /> Conservar esta fila
        </button>
      ) : null}

      {corregible ? (
        <>
          <button type="button" className="secondary-btn" disabled={review.busy} onClick={() => setModo({ tipo: 'editar' })}>
            <Pencil size={16} /> {esParticipacion ? 'Corregir fila de origen' : 'Editar'}
          </button>
          <button type="button" className="imp-danger-btn" disabled={review.busy}
            onClick={() => justificar('Excluir la fila del lote', '', (j) => review.onExclude([rowId!], j), true)}>
            <Trash2 size={16} /> Excluir
          </button>
        </>
      ) : null}

      {excluida && rowId !== null ? (
        <button type="button" className="secondary-btn" disabled={review.busy}
          onClick={() => justificar('Devolver la fila al lote', 'Se restaura: la fila es válida.', (j) => review.onRestore(rowId, j))}>
          <RotateCcw size={16} /> Restaurar
        </button>
      ) : null}
    </div>
  );
}
