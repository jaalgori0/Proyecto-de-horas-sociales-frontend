/**
 * Estado de cada archivo del lote: procesado/rechazado, conciliación contra los
 * totales impresos en el reporte, avisos y líneas que el extractor no reconoció.
 */
import { AlertTriangle, CheckCircle2, ChevronDown, FileSpreadsheet, FileText, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { ImportFile } from '../../services/api';
import { MotivoTag } from './ImportBadges';
import { formatBytes, formatNumber } from './importLabels';

const controlLabels: Record<string, string> = {
  alumnos: 'Alumnos',
  horas: 'Horas',
  proyectos: 'Proyectos',
};

/** true si algún archivo procesado no cuadra con los totales de su reporte. */
export function hasReconciliationMismatch(archivos: ImportFile[]) {
  return archivos.some((a) => a.estado === 'PROCESADO' && a.conciliacion.some((c) => !c.ok));
}

function FileRow({ file }: { file: ImportFile }) {
  const [open, setOpen] = useState(false);
  const rejected = file.estado === 'RECHAZADO';
  const mismatch = file.conciliacion.some((c) => !c.ok);
  const isPdf = file.tipo === 'PDF_DETALLE_HORAS' || file.archivo.toLowerCase().endsWith('.pdf');
  // descuadre_* ya se ve en la tabla de conciliación; lineas_no_reconocidas, en el detalle.
  const avisos = file.advertencias.filter((a) => !a.startsWith('descuadre_con_totales') && !a.startsWith('lineas_no_reconocidas'));

  const StatusIcon = rejected ? XCircle : mismatch ? AlertTriangle : CheckCircle2;
  const statusClass = rejected ? 'danger' : mismatch ? 'warn' : 'ok';
  const statusText = rejected ? 'Rechazado' : mismatch ? 'No cuadra' : 'Procesado';

  return (
    <li className={`imp-filecard imp-filecard-${statusClass}`}>
      <div className="imp-filecard-head">
        <span className={`imp-file-icon ${isPdf ? 'pdf' : 'xls'}`}>
          {isPdf ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
        </span>
        <div className="imp-filecard-title">
          <strong title={file.archivo}>{file.archivo}</strong>
          <span className="muted">
            {rejected
              ? formatBytes(file.bytes)
              : [
                  file.tipo === 'PDF_DETALLE_HORAS' ? 'Detalle de horas' : 'Memoria de labores',
                  file.periodoDesde ? `${file.periodoDesde} – ${file.periodoHasta}` : null,
                  `${formatNumber(file.filas)} filas`,
                  file.paginas ? `${file.paginas} pág.` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </span>
        </div>
        <span className={`imp-file-status imp-file-status-${statusClass}`}>
          <StatusIcon size={16} />
          {statusText}
        </span>
      </div>

      {rejected ? <p className="imp-filecard-reason">{file.motivo}</p> : null}

      {!rejected && file.conciliacion.length > 0 ? (
        <div className="imp-reconcile">
          {file.conciliacion.map((c) => (
            <div key={c.control} className={`imp-reconcile-cell ${c.ok ? '' : 'mismatch'}`}>
              <span className="imp-reconcile-label">{controlLabels[c.control] ?? c.control}</span>
              <strong>{formatNumber(c.extraido)}</strong>
              <span className="imp-reconcile-ref">
                {c.reporte === null ? 'sin total impreso' : c.ok ? 'cuadra con el reporte' : `el reporte dice ${formatNumber(c.reporte)}`}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {avisos.length > 0 ? (
        <div className="imp-tags">
          {avisos.map((a) => <MotivoTag key={a} motivo={a} />)}
        </div>
      ) : null}

      {file.lineasNoReconocidas.length > 0 ? (
        <div className="imp-unparsed">
          <button type="button" className="imp-link-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <ChevronDown size={14} className={open ? 'imp-rotate' : ''} />
            {file.lineasNoReconocidas.length} línea{file.lineasNoReconocidas.length !== 1 ? 's' : ''} no reconocida
            {file.lineasNoReconocidas.length !== 1 ? 's' : ''}
          </button>
          {open ? (
            <ul>
              {file.lineasNoReconocidas.map((l) => (
                <li key={`${l.ubicacion}-${l.texto}`}>
                  <code>{l.ubicacion}</code> {l.texto}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function ImportFilesPanel({ archivos }: { archivos: ImportFile[] }) {
  const procesados = archivos.filter((a) => a.estado === 'PROCESADO').length;
  // Todo procesado y cuadrado: colapsado, para que la vista previa quede a la vista.
  const allGood = procesados === archivos.length && !hasReconciliationMismatch(archivos);
  const [open, setOpen] = useState(!allGood);
  return (
    <section className="dash-chart-card">
      <button type="button" className="imp-section-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`imp-file-status imp-file-status-${allGood ? 'ok' : 'warn'}`}>
          {allGood ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
        </span>
        <span className="imp-section-toggle-copy">
          <span className="dash-chart-title">Archivos y conciliación</span>
          <span className="dash-chart-subtitle">
            {procesados} de {archivos.length} archivo{archivos.length !== 1 ? 's' : ''} procesado
            {procesados !== 1 ? 's' : ''}
            {allGood ? ' · todos cuadran con los totales impresos en el reporte' : ' · revise los archivos marcados'}
          </span>
        </span>
        <ChevronDown size={18} className={open ? 'imp-rotate' : ''} />
      </button>
      {open ? (
        <ul className="imp-filecards">
          {archivos.map((file) => <FileRow key={file.archivo} file={file} />)}
        </ul>
      ) : null}
    </section>
  );
}
