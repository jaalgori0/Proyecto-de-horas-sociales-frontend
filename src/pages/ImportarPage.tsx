/**
 * Importación masiva de reportes del CSS (PDF «Detalle de Horas por Proyecto» y
 * Excel «Memoria de Labores»).
 *
 *   1. Arrastrar archivos → POST /imports → vista previa clasificada (no escribe nada).
 *   2. Revisar archivos/conciliación y las pestañas Nuevos · Ignorados · Advertencias · Conflictos.
 *   3. Confirmar → POST /imports/:id/confirm. Si la base cambió desde la vista previa, el
 *      backend responde 409 PREVIEW_DESACTUALIZADA con la clasificación nueva y se muestra esa.
 *   4. O descartar → DELETE /imports/:id.
 *
 * Revisión en línea (paso 2, sin editar Excel): en la vista previa cada conflicto se puede
 * corregir, excluir con justificación o decidir; el backend reclasifica con las mismas reglas,
 * recalcula el cuadre y el impacto, y deja todo en la bitácora del lote. Cada acción y la
 * confirmación envían la huella del lote en pantalla: si otra persona lo cambió, se muestra
 * la versión actual (409) en vez de escribir sobre ella.
 *
 * Paso opcional antes del 1: con PDF en la lista, «Generar Excel para revisar» →
 * POST /imports/review-template descarga una plantilla con lo extraído. Se corrige en
 * Excel y se sube aquí mismo (el backend la reconoce y la concilia con los totales del PDF).
 */
import { AlertTriangle, Clock, FileStack, PlusCircle, RefreshCw, Sparkles, Timer, UploadCloud } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Notice } from '../components/ui';
import ImportActions from '../components/import/ImportActions';
import { BatchEstadoBadge } from '../components/import/ImportBadges';
import ImportDropzone from '../components/import/ImportDropzone';
import ImportFilesPanel, { hasReconciliationMismatch } from '../components/import/ImportFilesPanel';
import ImportHistory from '../components/import/ImportHistory';
import ImportImpactPanel from '../components/import/ImportImpactPanel';
import ImportPreview from '../components/import/ImportPreview';
import type { ReviewHandlers } from '../components/import/ImportReviewActions';
import ImportReviewLog from '../components/import/ImportReviewLog';
import ImportResultSummary from '../components/import/ImportResultSummary';
import { ITEM_ESTADOS, formatDateTime, formatNumber } from '../components/import/importLabels';
import {
  confirmImport,
  decideImportParticipation,
  describeApiError,
  discardImport,
  downloadReviewTemplate,
  editImportRow,
  excludeImportRow,
  getImportDetail,
  getImports,
  linkImportProject,
  renewImport,
  restoreImportRow,
  uploadImport,
  type ReviewResult,
  type ImportBatchDetail,
  type ImportBatchListItem,
  type ImportConteo,
  type ImportItemEstado,
} from '../services/api';

type Banner = { variant: 'error' | 'info'; title: string; text: string } | null;

function KpiCard({ icon, label, value, sub, color }: { icon: ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="dash-kpi-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="dash-kpi-icon">{icon}</div>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <strong className="dash-kpi-value">{value}</strong>
        {sub ? <span className="dash-kpi-sub" style={{ color: 'var(--muted)' }}>{sub}</span> : null}
      </div>
    </div>
  );
}

function conteoDe(batch: ImportBatchDetail): ImportConteo {
  if ('total' in batch.resumen) return batch.resumen.total;
  const conteo: ImportConteo = { NUEVO: 0, IGNORADO: 0, ADVERTENCIA: 0, CONFLICTO: 0 };
  for (const item of batch.items) conteo[item.estado] += 1;
  return conteo;
}

/** Con revisión guardada, se avisa cuando faltan menos de esto para el vencimiento. */
const AVISO_VENCIMIENTO_MS = 3 * 60 * 60 * 1000;

/** La pestaña que abre primero: lo que más necesita atención. */
function initialTabFor(conteo: ImportConteo): ImportItemEstado {
  return (['CONFLICTO', 'ADVERTENCIA', 'NUEVO'] as const).find((e) => conteo[e] > 0) ?? 'IGNORADO';
}

export default function ImportarPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [batch, setBatch] = useState<ImportBatchDetail | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [busy, setBusy] = useState<'confirm' | 'discard' | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [renewing, setRenewing] = useState(false);
  /** Cambia al cargar otro lote o una clasificación nueva (la vista previa vuelve a la pestaña sugerida). */
  const [resetCount, setResetCount] = useState(0);
  /** Huella del lote en pantalla: se envía en cada acción de revisión y al confirmar. */
  const huellaRef = useRef<string | null>(null);
  useEffect(() => {
    huellaRef.current = batch?.huella ?? null;
  }, [batch]);
  const showBatch = useCallback((next: ImportBatchDetail | null) => {
    setBatch(next);
    setResetCount((n) => n + 1);
  }, []);

  const [history, setHistory] = useState<ImportBatchListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      setHistory(await getImports(20));
    } catch (err) {
      setHistoryError(describeApiError(err, 'No se pudo cargar el historial de importaciones.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleUpload() {
    if (files.length === 0) return;
    const formData = new FormData();
    for (const file of files) formData.append('files', file, file.name);
    setUploading(true);
    setBanner(null);
    try {
      const preview = await uploadImport(formData);
      showBatch(preview);
      setFiles([]);
      loadHistory();
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudieron analizar los archivos', text: describeApiError(err) });
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerateTemplate() {
    const pdfs = files.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) return;
    const formData = new FormData();
    for (const file of pdfs) formData.append('files', file, file.name);
    setGeneratingTemplate(true);
    setBanner(null);
    try {
      const plantilla = await downloadReviewTemplate(formData);
      const url = URL.createObjectURL(plantilla.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = plantilla.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      // Los PDF salen de la lista: subirlos junto con la plantilla duplicaría las filas.
      setFiles((current) => current.filter((file) => !pdfs.includes(file)));
      const dudosas = plantilla.filasConAdvertencias;
      const lineas = plantilla.lineasNoReconocidas;
      setBanner({
        variant: 'info',
        title: `Se descargó ${plantilla.filename}`,
        text:
          `${formatNumber(plantilla.filas)} participaciones extraídas` +
          (dudosas > 0
            ? `; ${formatNumber(dudosas)} marcada${dudosas !== 1 ? 's' : ''} «Revisar» (filtre esa columna)`
            : '; ninguna fila dudosa') +
          (lineas > 0 ? ` y ${formatNumber(lineas)} línea${lineas !== 1 ? 's' : ''} no reconocida${lineas !== 1 ? 's' : ''}` : '') +
          '. Corríjala en Excel y súbala aquí (en lugar de los PDF) para ver la vista previa.',
      });
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudo generar el Excel de revisión', text: describeApiError(err) });
    } finally {
      setGeneratingTemplate(false);
    }
  }

  async function openBatch(id: string) {
    if (busy !== null || loadingBatch || uploading || generatingTemplate) return;
    setLoadingBatch(true);
    setBanner(null);
    try {
      showBatch(await getImportDetail(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudo abrir el lote', text: describeApiError(err) });
    } finally {
      setLoadingBatch(false);
    }
  }

  async function handleConfirm() {
    if (!batch) return;
    setBusy('confirm');
    setBanner(null);
    try {
      const result = await confirmImport(batch.id, huellaRef.current);
      showBatch(result.batch);
      if (result.status === 'desactualizado') {
        setBanner({
          variant: 'info',
          title: 'La vista previa se actualizó',
          text: `${result.message} No se escribió nada en la base.`,
        });
      } else if (result.status === 'sin_respuesta') {
        setBanner({ variant: 'error', title: 'No se recibió respuesta del servidor', text: result.message });
      } else if (result.recuperado) {
        setBanner({
          variant: 'info',
          title: 'Importación confirmada',
          text: 'Se perdió la conexión durante la confirmación, pero el servidor alcanzó a registrarla. Este es el resultado.',
        });
      }
      loadHistory();
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudo confirmar la importación', text: describeApiError(err) });
    } finally {
      setBusy(null);
    }
  }

  /** Ejecuta una acción de revisión con la huella vigente. true si se aplicó. */
  async function runReview(action: (huella: string) => Promise<ReviewResult>): Promise<boolean> {
    if (!batch) return false;
    setReviewBusy(true);
    setBanner(null);
    try {
      const result = await action(huellaRef.current ?? '');
      setBatch(result.batch);
      huellaRef.current = result.batch.huella ?? null;
      if (result.status === 'desactualizado') {
        setBanner({
          variant: 'info',
          title: 'El lote cambió mientras lo revisaba',
          text: `${result.message} Se muestra la versión actual; su último cambio no se aplicó.`,
        });
        return false;
      }
      return true;
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudo aplicar el cambio', text: describeApiError(err) });
      return false;
    } finally {
      setReviewBusy(false);
    }
  }

  const reviewHandlers: ReviewHandlers | null =
    batch && batch.estado === 'PREVISUALIZADO' && !batch.expirado && busy === null
      ? {
          busy: reviewBusy,
          onEdit: (rowId, cambios, justificacion) =>
            runReview((huella) => editImportRow(batch.id, rowId, { huella, justificacion, cambios })),
          onExclude: async (rowIds, justificacion) => {
            for (const rowId of rowIds) {
              // Secuencial: cada exclusión devuelve la huella nueva que usa la siguiente.
              if (!(await runReview((huella) => excludeImportRow(batch.id, rowId, { huella, justificacion })))) return false;
            }
            return true;
          },
          onRestore: (rowId, justificacion) =>
            runReview((huella) => restoreImportRow(batch.id, rowId, { huella, justificacion })),
          onDecide: (clave, decision, justificacion) =>
            runReview((huella) => decideImportParticipation(batch.id, { huella, justificacion, clave, decision })),
          onLink: (clave, decision, projectId, justificacion) =>
            runReview((huella) =>
              linkImportProject(batch.id, { huella, justificacion, clave, decision, ...(projectId ? { projectId } : {}) })),
        }
      : null;

  async function handleRenew() {
    if (!batch) return;
    setRenewing(true);
    setBanner(null);
    try {
      setBatch(await renewImport(batch.id));
      setBanner({ variant: 'info', title: 'Vista previa renovada', text: 'Tiene 24 horas más para revisar y confirmar. Sus correcciones se conservan.' });
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudo renovar la vista previa', text: describeApiError(err) });
    } finally {
      setRenewing(false);
    }
  }

  async function handleDiscard() {
    if (!batch) return;
    setBusy('discard');
    setBanner(null);
    try {
      await discardImport(batch.id);
      showBatch(null);
      setBanner({ variant: 'info', title: 'Lote descartado', text: 'No se escribió nada en la base.' });
      loadHistory();
    } catch (err) {
      setBanner({ variant: 'error', title: 'No se pudo descartar el lote', text: describeApiError(err) });
    } finally {
      setBusy(null);
    }
  }

  const conteo = useMemo(() => (batch ? conteoDe(batch) : null), [batch]);

  const actionCounts = useMemo(() => {
    if (!batch || !conteo) return null;
    return {
      insertar: batch.items.filter((i) => i.accion === 'INSERTAR').length,
      completar: batch.items.filter((i) => i.accion === 'COMPLETAR').length,
      conflictos: conteo.CONFLICTO,
      horasNuevas: 'horasNuevas' in batch.resumen ? batch.resumen.horasNuevas : 0,
      actualizar: batch.items.filter((i) => i.accion === 'ACTUALIZAR').length,
      horasActualizadas: 'horasActualizadas' in batch.resumen ? (batch.resumen.horasActualizadas ?? 0) : 0,
    };
  }, [batch, conteo]);

  const blockedReason = useMemo(() => {
    if (!batch) return null;
    if (batch.expirado) return 'La vista previa expiró. Renuévela para confirmar (se conservan sus correcciones) o suba los archivos de nuevo.';
    if (hasReconciliationMismatch(batch.archivos)) {
      return 'Hay archivos cuyos totales no cuadran con el reporte. Revise la extracción antes de confirmar.';
    }
    if (batch.archivos.length > 0 && batch.archivos.every((a) => a.estado === 'RECHAZADO')) {
      return 'Todos los archivos fueron rechazados.';
    }
    return null;
  }, [batch]);

  const rechazados = batch?.archivos.filter((a) => a.estado === 'RECHAZADO').length ?? 0;
  const revisionTotal = batch?.revision ? batch.revision.ediciones + batch.revision.exclusiones + batch.revision.decisiones : 0;
  const vencePronto = batch?.estado === 'PREVISUALIZADO' && !batch.expirado && revisionTotal > 0
    && new Date(batch.expiraEn).getTime() - Date.now() < AVISO_VENCIMIENTO_MS;
  const impacto = batch && 'total' in batch.resumen ? batch.resumen.impacto : null;
  const editable = batch?.estado === 'PREVISUALIZADO';
  /** Mientras se sube, confirma, descarta o abre un lote, no se puede cambiar el lote en pantalla. */
  const locked = busy !== null || loadingBatch || uploading || generatingTemplate || reviewBusy || renewing;

  return (
    <div className="wide-page imp-page">
      <header className="page-hero">
        <div className="hero-left">
          <h1 className="main-title">Importar reportes</h1>
          <p className="main-description">
            Cargue los PDF de horas por proyecto y el Excel de memoria de labores del CSS. Revise la vista previa
            antes de confirmar: lo que ya existe nunca se sobrescribe.
          </p>
        </div>
        {batch ? (
          <div className="hero-right">
            <button type="button" className="secondary-btn" disabled={locked} onClick={() => { showBatch(null); setBanner(null); }}>
              <PlusCircle size={18} /> Nueva importación
            </button>
          </div>
        ) : null}
      </header>

      {banner ? (
        <Notice variant={banner.variant} title={banner.title}>{banner.text}</Notice>
      ) : null}

      {!batch ? (
        <ImportDropzone
          files={files}
          onFilesChange={setFiles}
          onSubmit={handleUpload}
          uploading={uploading}
          onGenerateTemplate={handleGenerateTemplate}
          generatingTemplate={generatingTemplate}
        />
      ) : null}

      {loadingBatch ? <p className="muted">Cargando lote…</p> : null}

      {batch && conteo && actionCounts ? (
        <div className="imp-batch">
          <div className="imp-batch-meta">
            <BatchEstadoBadge estado={batch.estado} expirado={batch.expirado} />
            <span className="muted">
              Lote creado {formatDateTime(batch.creadoEn)}
              {editable && !batch.expirado ? ` · la vista previa vence ${formatDateTime(batch.expiraEn)}` : ''}
            </span>
          </div>

          {editable && (batch.expirado || vencePronto) ? (
            <Notice
              variant={batch.expirado ? 'error' : 'info'}
              title={batch.expirado ? 'La vista previa venció' : 'La vista previa vence pronto'}
            >
              {batch.expirado
                ? 'No se puede seguir revisando ni confirmar hasta renovarla. '
                : `Vence ${formatDateTime(batch.expiraEn)}. `}
              {revisionTotal > 0
                ? `Tiene ${revisionTotal} corrección${revisionTotal !== 1 ? 'es' : ''} o decisión${revisionTotal !== 1 ? 'es' : ''} guardada${revisionTotal !== 1 ? 's' : ''}: se conservan al renovar (hasta 7 días después del vencimiento).`
                : 'Renuévela si todavía la necesita.'}
              <div className="imp-actions-row" style={{ marginTop: 8 }}>
                <button type="button" className="secondary-btn" disabled={locked} onClick={handleRenew}>
                  <RefreshCw size={16} className={renewing ? 'imp-spin' : ''} /> Renovar 24 horas
                </button>
              </div>
            </Notice>
          ) : null}

          <div className="dash-kpi-grid">
            <KpiCard
              icon={<FileStack size={22} />}
              label="Archivos"
              value={formatNumber(batch.archivos.length)}
              sub={rechazados > 0 ? `${rechazados} rechazado${rechazados !== 1 ? 's' : ''}` : 'todos procesados'}
              color="#2f68ec"
            />
            <KpiCard
              icon={<Sparkles size={22} />}
              label="Registros nuevos"
              value={formatNumber(actionCounts.insertar)}
              sub={`${formatNumber(conteo.IGNORADO)} ya existían`}
              color="#16a34a"
            />
            <KpiCard
              icon={<Timer size={22} />}
              label="Horas nuevas"
              value={formatNumber(actionCounts.horasNuevas)}
              sub="se suman al historial"
              color="#21c08a"
            />
            <KpiCard
              icon={<RefreshCw size={22} />}
              label="Actualizaciones"
              value={formatNumber(actionCounts.actualizar)}
              sub={actionCounts.actualizar > 0 ? `+${formatNumber(actionCounts.horasActualizadas)} h del CSS` : 'participaciones existentes'}
              color="#2563eb"
            />
            <KpiCard
              icon={<Clock size={22} />}
              label="Campos a completar"
              value={formatNumber(actionCounts.completar)}
              sub="solo campos vacíos"
              color="#f59e0b"
            />
            <KpiCard
              icon={<AlertTriangle size={22} />}
              label="Conflictos"
              value={formatNumber(conteo.CONFLICTO)}
              sub={conteo.CONFLICTO > 0 ? 'no se cargarán' : 'ninguno'}
              color="#f97316"
            />
          </div>

          {batch.estado === 'CONFIRMADO' ? (
            <ImportResultSummary resultado={batch.resultado} confirmadoEn={batch.confirmadoEn} conflictos={conteo.CONFLICTO} />
          ) : null}

          {editable ? (
            <ImportActions
              counts={actionCounts}
              blockedReason={blockedReason}
              busy={busy}
              onConfirm={handleConfirm}
              onDiscard={handleDiscard}
            />
          ) : null}

          {editable ? (
            <ImportImpactPanel
              impacto={impacto}
              actualizar={actionCounts.actualizar}
              horasActualizadas={actionCounts.horasActualizadas}
            />
          ) : null}

          <ImportFilesPanel archivos={batch.archivos} />

          {batch.items.length > 0 || ITEM_ESTADOS.some((e) => conteo[e] > 0) ? (
            <ImportPreview
              items={batch.items}
              conteo={conteo}
              initialTab={initialTabFor(conteo)}
              resetKey={`${batch.id}:${resetCount}`}
              review={reviewHandlers}
            />
          ) : (
            <Notice variant="info" title="Sin registros para clasificar">
              Ningún archivo produjo filas válidas. Revise los motivos de rechazo de cada archivo.
            </Notice>
          )}
        </div>
      ) : null}

      {batch ? <ImportReviewLog key={`${batch.id}:${batch.huella ?? ''}`} batchId={batch.id} total={revisionTotal} /> : null}

      {!batch && !uploading && !generatingTemplate && files.length === 0 ? (
        <div className="imp-howto">
          <UploadCloud size={18} />
          <span>
            El análisis no modifica la base: primero verá cuántos registros son nuevos, cuáles ya existen y cuáles
            tienen conflictos.
          </span>
        </div>
      ) : null}

      <ImportHistory
        batches={history}
        loading={historyLoading}
        error={historyError}
        activeId={batch?.id ?? null}
        disabled={locked}
        onOpen={openBatch}
        onRefresh={loadHistory}
      />
    </div>
  );
}
