/**
 * Zona de arrastre para los reportes del CSS. Acepta varios PDF/XLS/XLSX a la vez,
 * valida extensión, tamaño y cantidad (mismos límites por defecto que el backend)
 * y muestra la lista antes de subir. La validación real del contenido la hace el backend.
 *
 * Con PDF en la lista ofrece además «Generar Excel para revisar»: descarga una plantilla
 * con lo extraído para corregirla antes de importar (la plantilla se sube aquí mismo).
 */
import { FileDown, FileSpreadsheet, FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { formatBytes } from './importLabels';

export const IMPORT_MAX_FILE_MB = 15;
export const IMPORT_MAX_FILES = 20;
const ACCEPTED = ['.pdf', '.xls', '.xlsx'];

function extension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

function fileKey(file: File) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export default function ImportDropzone({
  files,
  onFilesChange,
  onSubmit,
  uploading: analyzing,
  onGenerateTemplate,
  generatingTemplate = false,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
  uploading: boolean;
  /** PDF de la lista → plantilla Excel para revisar (los demás archivos se ignoran). */
  onGenerateTemplate?: () => void;
  generatingTemplate?: boolean;
}) {
  // Mientras se analiza o se genera la plantilla, la lista no se puede cambiar.
  const uploading = analyzing || generatingTemplate;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  function addFiles(incoming: FileList | File[]) {
    const problems: string[] = [];
    const next = [...files];
    const known = new Set(files.map(fileKey));

    for (const file of Array.from(incoming)) {
      if (!ACCEPTED.includes(extension(file.name))) {
        problems.push(`${file.name}: solo se aceptan PDF, XLS o XLSX.`);
      } else if (file.size > IMPORT_MAX_FILE_MB * 1024 * 1024) {
        problems.push(`${file.name}: supera ${IMPORT_MAX_FILE_MB} MB.`);
      } else if (known.has(fileKey(file))) {
        problems.push(`${file.name}: ya está en la lista.`);
      } else if (next.length >= IMPORT_MAX_FILES) {
        problems.push(`${file.name}: máximo ${IMPORT_MAX_FILES} archivos por lote.`);
      } else {
        next.push(file);
        known.add(fileKey(file));
      }
    }
    setRejected(problems);
    onFilesChange(next);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!uploading && event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const pdfCount = files.filter((f) => extension(f.name) === '.pdf').length;
  // Aviso temprano (por nombre): el backend rechaza el lote si la plantilla salió de alguno de estos PDF.
  const plantillas = files.filter((f) => extension(f.name) === '.xlsx' && /^plantilla-revision/i.test(f.name));

  return (
    <section className="imp-card">
      <div
        className={`imp-dropzone ${dragging ? 'dragging' : ''} ${uploading ? 'disabled' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Seleccionar o arrastrar archivos para importar"
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="imp-dropzone-icon">
          <UploadCloud size={30} strokeWidth={2} />
        </div>
        <strong>Arrastre aquí los reportes del CSS</strong>
        <span className="muted">
          o haga clic para seleccionarlos · PDF «Detalle de Horas por Proyecto», Excel «Memoria de Labores» o la
          plantilla de revisión ya corregida · hasta {IMPORT_MAX_FILES} archivos de {IMPORT_MAX_FILE_MB} MB
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {rejected.length > 0 ? (
        <ul className="imp-rejected-list" role="alert">
          {rejected.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <>
          <ul className="imp-file-list">
            {files.map((file) => {
              const isPdf = extension(file.name) === '.pdf';
              return (
                <li key={fileKey(file)} className="imp-file-row">
                  <span className={`imp-file-icon ${isPdf ? 'pdf' : 'xls'}`}>
                    {isPdf ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
                  </span>
                  <span className="imp-file-name" title={file.name}>{file.name}</span>
                  <span className="imp-file-size">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="imp-icon-btn"
                    aria-label={`Quitar ${file.name}`}
                    disabled={uploading}
                    onClick={() => onFilesChange(files.filter((f) => fileKey(f) !== fileKey(file)))}
                  >
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="imp-dropzone-footer">
            <span className="muted">
              {files.length} archivo{files.length !== 1 ? 's' : ''} · {formatBytes(totalBytes)}
            </span>
            <div className="imp-actions-row">
              <button type="button" className="secondary-btn" disabled={uploading} onClick={() => { setRejected([]); onFilesChange([]); }}>
                Limpiar
              </button>
              {onGenerateTemplate && pdfCount > 0 ? (
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={uploading}
                  onClick={onGenerateTemplate}
                  title="Descarga un Excel con lo extraído de los PDF para revisarlo y corregirlo antes de importar"
                >
                  {generatingTemplate ? <Loader2 size={18} className="imp-spin" /> : <FileDown size={18} />}
                  {generatingTemplate ? 'Generando Excel…' : 'Generar Excel para revisar'}
                </button>
              ) : null}
              <button type="button" className="primary-btn" disabled={uploading} onClick={onSubmit}>
                {analyzing ? <Loader2 size={18} className="imp-spin" /> : <UploadCloud size={18} />}
                {analyzing ? 'Analizando archivos…' : 'Analizar archivos'}
              </button>
            </div>
          </div>
          {plantillas.length > 0 && pdfCount > 0 ? (
            <p className="imp-template-warning" role="alert">
              La lista tiene una plantilla de revisión y también PDF. Si la plantilla salió de esos PDF, el lote se
              rechazará para no duplicar las filas: quite los PDF y suba solo la plantilla corregida.
            </p>
          ) : null}
          {onGenerateTemplate && pdfCount > 0 && plantillas.length === 0 ? (
            <p className="imp-template-hint">
              ¿Algún PDF trae filas cortadas entre páginas o tablas desordenadas? Genere el Excel, corríjalo y súbalo
              aquí en lugar de los PDF.
              {pdfCount < files.length ? ' Solo se incluyen los PDF de la lista.' : ''}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
