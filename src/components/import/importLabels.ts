/**
 * Textos y formato de la importación masiva. El backend devuelve códigos estables
 * (`motivos`, estados, pasos del resultado); aquí se traducen a texto para el usuario.
 * Un código nuevo que no esté en estos mapas se muestra legible (sin guiones bajos).
 */
import type {
  ImportBatchEstado,
  ImportItem,
  ImportItemEntidad,
  ImportItemEstado,
} from '../../services/api';

// ─── Estados ──────────────────────────────────────────────────────────────────
export const ITEM_ESTADOS: ImportItemEstado[] = ['NUEVO', 'IGNORADO', 'ADVERTENCIA', 'CONFLICTO'];

export const itemEstadoConfig: Record<ImportItemEstado, { label: string; plural: string; color: string; bg: string; dot: string; help: string }> = {
  NUEVO: {
    label: 'Nuevo', plural: 'Nuevos', color: '#0d6d3e', bg: '#dcfce7', dot: '#16a34a',
    help: 'No existen en la base: se insertarán al confirmar.',
  },
  IGNORADO: {
    label: 'Ignorado', plural: 'Ignorados', color: '#4b5563', bg: '#f3f4f6', dot: '#9ca3af',
    help: 'Ya existen y coinciden con el archivo: no se tocan.',
  },
  ADVERTENCIA: {
    label: 'Advertencia', plural: 'Advertencias', color: '#92400e', bg: '#fef3c7', dot: '#f59e0b',
    help: 'Se procesan con observaciones: campos vacíos que se completarán, participaciones que se actualizarán (Activo → Finalizada o ajuste aceptado) o datos que difieren (se conserva lo existente).',
  },
  CONFLICTO: {
    label: 'Conflicto', plural: 'Conflictos', color: '#9a3412', bg: '#ffedd5', dot: '#f97316',
    help: 'No se cargarán hasta resolverlos: filas inválidas (corríjalas o exclúyalas aquí mismo), ajustes de horas que esperan su decisión, o cambios que retroceden el historial (estrictos).',
  },
};

export const batchEstadoConfig: Record<ImportBatchEstado | 'EXPIRADO', { label: string; color: string; bg: string; dot: string }> = {
  PREVISUALIZADO: { label: 'Previsualizado', color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  CONFIRMADO: { label: 'Confirmado', color: '#0d6d3e', bg: '#dcfce7', dot: '#16a34a' },
  DESCARTADO: { label: 'Descartado', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
  EXPIRADO: { label: 'Expirado', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
};

export const entidadLabels: Record<ImportItemEntidad, { singular: string; plural: string }> = {
  INSTITUCION: { singular: 'Institución', plural: 'Instituciones' },
  PROYECTO: { singular: 'Proyecto', plural: 'Proyectos' },
  ESTUDIANTE: { singular: 'Estudiante', plural: 'Estudiantes' },
  PARTICIPACION: { singular: 'Participación', plural: 'Participaciones' },
  FILA_PDF: { singular: 'Fila de PDF', plural: 'Filas de PDF' },
  FILA_XLS: { singular: 'Fila de Excel', plural: 'Filas de Excel' },
};

export const ENTIDAD_ORDEN: ImportItemEntidad[] = ['PARTICIPACION', 'ESTUDIANTE', 'PROYECTO', 'INSTITUCION', 'FILA_PDF', 'FILA_XLS'];

const participacionEstado: Record<string, string> = {
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  RETIRADA: 'Retirada',
  ASIGNADA: 'Asignada',
  CANCELADA: 'Cancelada',
};

// ─── Motivos ──────────────────────────────────────────────────────────────────
const motivoLabels: Record<string, string> = {
  // Instituciones
  nombre_difiere_se_conserva_existente: 'El nombre difiere; se conserva el existente',
  nombre_repetido_con_otro_codigo_en_lote: 'El mismo nombre aparece con otro código en el lote',
  completa_codigo_css: 'Se completará el código CSS',
  nombre_en_uso_por_otro_codigo: 'Ya existe una institución con ese nombre y otro código',
  // Proyectos
  institucion_en_conflicto: 'Su institución está en conflicto',
  titulo_difiere_se_conserva_existente: 'El título difiere; se conserva el existente',
  fecha_inicio_difiere_se_conserva_existente: 'La fecha de inicio difiere; se conserva la existente',
  fecha_cierre_difiere_se_conserva_existente: 'La fecha de cierre difiere; se conserva la existente',
  fecha_cierre_incompatible_no_se_completa: 'La fecha de cierre es anterior al inicio; no se completa',
  adopta_proyecto_sin_correlativo: 'Se vincula a un proyecto creado en la app sin correlativo',
  fecha_fin_ajustada: 'Fecha de fin corregida (era anterior al inicio)',
  completa_campos_vacios: 'Se completarán campos vacíos',
  // Estudiantes
  carrera_difiere_se_conserva_existente: 'La carrera difiere; se conserva la existente',
  correo_institucional_en_uso: 'El correo institucional ya pertenece a otro estudiante',
  // Participaciones
  proyecto_en_conflicto: 'Su proyecto está en conflicto',
  estudiante_en_conflicto: 'Su estudiante está en conflicto',
  horas_difieren: 'Las horas difieren de las registradas',
  estado_difiere: 'El estado difiere del registrado',
  fecha_inicio_difiere: 'La fecha de inicio difiere',
  fecha_fin_difiere: 'La fecha de fin difiere',
  retroceso_de_estado: 'Retrocede el estado registrado (no se permite)',
  horas_disminuyen: 'Las horas bajan respecto de las registradas (no se permite)',
  finaliza_en_reporte: 'Finalizó en el reporte: se actualizará estado, cierre y horas',
  ajuste_horas_finalizada: 'Más horas en una participación ya finalizada',
  requiere_decision: 'Requiere su decisión: aceptar el reporte o conservar la base',
  decision_aceptar_reporte: 'Decisión: aceptar el reporte',
  decision_conservar_bd: 'Decisión: conservar lo de la base',
  fila_editada_en_revision: 'Fila corregida en la revisión',
  // Nombres equivalentes (mayúsculas, tildes, espacios, puntuación) — migración 014
  adopta_institucion_nombre_similar: 'Se vincula a una institución de la app con nombre equivalente',
  varias_instituciones_app_similares: 'Varias instituciones de la app tienen un nombre equivalente',
  institucion_app_similar_repetida_en_lote: 'Varias instituciones del lote coinciden con la misma de la app',
  institucion_similar_con_otro_codigo: 'Parecida a una institución con otro código CSS',
  titulo_similar_no_identico: 'El título difiere solo en formato (mayúsculas, tildes, puntuación)',
  requiere_vincular_proyecto_app: 'Coincide con un proyecto creado en la app: vincúlelo o confirme que es otro',
  vinculo_repetido: 'Dos correlativos vinculados al mismo proyecto de la app',
  vinculado_en_revision: 'Vinculado en la revisión a un proyecto de la app',
  se_crea_aunque_existe_en_app: 'Se crea aunque existe uno parecido en la app (confirmado)',
  similar_a_proyecto_importado: 'Parecido a un proyecto ya importado con otro correlativo',
  fila_excluida_en_revision: 'Fila excluida en la revisión',
  celda_dividida_por_posicion: 'Celda separada por posición (revisar)',
  fila_cortada_entre_paginas: 'Fila cortada entre páginas',
  // Filas inválidas
  carnet_invalido: 'Carnet inválido',
  nombre_vacio: 'Nombre vacío',
  cod_institucion_invalido: 'Código de institución inválido',
  institucion_vacia: 'Institución vacía',
  correlativo_invalido: 'Correlativo inválido',
  proyecto_vacio: 'Proyecto vacío',
  mojibake_sin_mapeo: 'Texto con caracteres dañados sin corrección',
  carrera_no_encontrada: 'Carrera no encontrada en el catálogo',
  estado_desconocido: 'Estado desconocido',
  fecha_inicio_invalida: 'Fecha de inicio inválida',
  fecha_fin_invalida: 'Fecha de fin inválida',
  horas_invalidas: 'Horas inválidas',
  fin_antes_de_inicio: 'La fecha de fin es anterior al inicio',
  estado_requiere_fin: 'El estado requiere fecha de fin',
  activo_con_fin: 'Activo pero con fecha de fin',
  activo_con_horas: 'Activo pero con horas asignadas',
  carnet_con_varios_nombres: 'El carnet aparece con varios nombres',
  carnet_con_varias_carreras: 'El carnet aparece con varias carreras',
  participacion_duplicada_en_lote: 'Participación repetida en el lote',
  proyecto_duplicado_en_lote: 'Proyecto repetido en el lote',
  // Archivos
  descuadre_con_totales: 'No cuadra con el total del reporte',
  lineas_no_reconocidas: 'Líneas no reconocidas',
  archivo_ya_importado_en_lote: 'Este archivo ya se importó en un lote confirmado',
  // Plantilla de revisión (Excel generado desde los PDF)
  sin_totales_de_control: 'La plantilla no trae los totales de los PDF de origen',
  hoja_truncada: 'La hoja es demasiado grande y se leyó solo en parte',
  carnet_completado_con_ceros: 'Carnet completado con ceros a la izquierda',
  fecha_leida_como_fecha_de_excel: 'Fecha convertida desde el formato de Excel',
  fila_agregada_en_revision: 'Fila agregada durante la revisión',
};

const cellLabels: Record<string, string> = {
  carnet: 'carnet', nombreCompleto: 'nombre', fechaInicio: 'fecha de inicio', fechaFin: 'fecha de fin',
  codInstitucion: 'código', institucion: 'institución', carrera: 'carrera', horasAsignadas: 'horas', estado: 'estado',
};

/**
 * Procedencia de una fila. En la plantilla de revisión (Excel) la "línea" es la fila de la
 * hoja Participaciones (la página es siempre 1): se muestra así para ubicarla en el Excel.
 */
export function describeOrigen(archivo: unknown, pagina: unknown, linea: unknown): string {
  const nombre = typeof archivo === 'string' ? archivo : '';
  if (/\.xlsx?$/i.test(nombre)) return linea != null ? `${nombre} · fila ${String(linea)} de Participaciones` : nombre;
  return `${nombre || '—'} · pág. ${pagina ?? '—'}${linea != null ? `, línea ${String(linea)}` : ''}`;
}

function humanize(code: string): string {
  const text = code.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "fecha_fin_ajustada:31/12/2025" → "Fecha de fin corregida (era anterior al inicio): 31/12/2025" */
export function motivoLabel(motivo: string): string {
  const [code, ...rest] = motivo.split(':');
  const arg = rest.join(':');
  const base = motivoLabels[code!] ?? humanize(code!);
  if (!arg) return base;
  if (code === 'celda_dividida_por_posicion' || code === 'fecha_leida_como_fecha_de_excel') return `${base}: ${cellLabels[arg] ?? arg}`;
  if (code === 'archivo_ya_importado_en_lote') return base;
  return `${base}: ${arg}`;
}

/** Motivos que solo informan (no son el problema principal) se muestran en gris. */
export function motivoTone(motivo: string): 'warn' | 'danger' | 'info' {
  const code = motivo.split(':')[0]!;
  if (code.startsWith('completa') || code === 'adopta_proyecto_sin_correlativo') return 'info';
  if (code === 'finaliza_en_reporte' || code.startsWith('decision_') || code === 'fila_editada_en_revision' || code === 'fila_excluida_en_revision') return 'info';
  if (code === 'retroceso_de_estado' || code === 'horas_disminuyen') return 'danger';
  if (code === 'requiere_vincular_proyecto_app' || code === 'vinculo_repetido' || code === 'varias_instituciones_app_similares'
      || code === 'institucion_app_similar_repetida_en_lote') return 'danger';
  if (code === 'vinculado_en_revision' || code === 'adopta_institucion_nombre_similar' || code === 'titulo_similar_no_identico') return 'info';
  if (code.endsWith('_difieren') || code.endsWith('_difiere') || code.includes('conflicto') || code.includes('invalid')) return 'danger';
  return 'warn';
}

// ─── Campos a completar ───────────────────────────────────────────────────────
export const completarLabels: Record<string, string> = {
  codigo_css: 'Código CSS',
  correlativo_css: 'Correlativo CSS',
  fecha_inicio: 'Fecha de inicio',
  fecha_cierre: 'Fecha de cierre',
  area_css: 'Área temática',
  alumnos_css: 'Alumnos (reporte CSS)',
};

// ─── Resultado de la confirmación ─────────────────────────────────────────────
export const resultadoLabels: Record<string, string> = {
  instituciones_insertadas: 'Instituciones nuevas',
  instituciones_completadas: 'Instituciones completadas',
  proyectos_insertados: 'Proyectos nuevos',
  proyectos_completados: 'Proyectos completados',
  estudiantes_insertados: 'Estudiantes nuevos',
  participaciones_insertadas: 'Participaciones nuevas',
  carreras_de_proyecto: 'Carreras vinculadas a proyectos',
  movimientos_de_horas: 'Movimientos de horas',
  participaciones_actualizadas: 'Participaciones actualizadas',
  movimientos_actualizados: 'Horas del CSS actualizadas',
  // Datos que el reporte no trae y el backend infiere (solo completa vacíos)
  generos_inferidos: 'Géneros inferidos por nombre',
  instituciones_ubicadas: 'Instituciones ubicadas',
  proyectos_ubicados: 'Proyectos ubicados',
};

export const RESULTADO_ORDEN = Object.keys(resultadoLabels);

// ─── Formato ──────────────────────────────────────────────────────────────────
const numberFormat = new Intl.NumberFormat('es-SV');
export const formatNumber = (n: number) => numberFormat.format(n);

/** "2026-02-14" o "2026-06-29T06:00:00+00:00" → "14/02/2026" (hora de El Salvador). */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('es-SV', { timeZone: 'America/El_Salvador', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function text(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

// ─── Presentación de un ítem ──────────────────────────────────────────────────
export function describeItem(item: ImportItem): { titulo: string; subtitulo: string } {
  const d = item.datos;
  switch (item.entidad) {
    case 'INSTITUCION':
      return { titulo: text(d.nombre), subtitulo: `Código CSS ${text(d.codigoCss)}` };
    case 'PROYECTO':
      return {
        titulo: text(d.titulo),
        subtitulo: [`Institución ${text(d.codigoCss)} · correlativo ${text(d.correlativo)}`, d.areaCss ? String(d.areaCss) : null]
          .filter(Boolean)
          .join(' · '),
      };
    case 'ESTUDIANTE':
      return { titulo: text(d.nombre), subtitulo: `Carnet ${text(d.carnet)} · ${text(d.carrera)}` };
    case 'PARTICIPACION':
      return {
        titulo: `${text(d.nombre)} (${text(d.carnet)})`,
        subtitulo: [
          text(d.proyecto),
          `${text(d.codigoCss)}/${text(d.correlativo)}`,
          `${formatNumber(Number(d.horas ?? 0))} h`,
          participacionEstado[String(d.estado)] ?? text(d.estadoReporte),
        ].join(' · '),
      };
    case 'FILA_PDF':
      return {
        titulo: d.nombre ? String(d.nombre) : d.carnet ? `Carnet ${String(d.carnet)}` : 'Fila sin datos legibles',
        subtitulo: describeOrigen(d.archivo, d.pagina, d.linea),
      };
    case 'FILA_XLS':
      return {
        titulo: text(d.proyecto ?? d.institucion),
        subtitulo: `${text(d.archivo)} · hoja ${text(d.hoja)}, fila ${text(d.fila)}`,
      };
  }
}

/** Para Ignorados: con qué registro existente coincide. */
export function describeMatch(item: ImportItem): string | null {
  const e = item.existente;
  if (!e) return null;
  switch (item.entidad) {
    case 'INSTITUCION':
      return `${text(e.nombre)}${e.codigoCss ? ` (código ${String(e.codigoCss)})` : ''}`;
    case 'PROYECTO':
      return `${text(e.titulo)} · ${text(e.estado)}`;
    case 'ESTUDIANTE':
      return `${text(e.nombre)} · ${text(e.carrera)}`;
    case 'PARTICIPACION':
      return `${participacionEstado[String(e.estado)] ?? text(e.estado)} · ${formatNumber(Number(e.horas ?? 0))} h`;
    default:
      return null;
  }
}

export type ComparisonRow = { campo: string; archivo: string; base: string | null; difiere: boolean };

/** Filas "en el archivo" vs "en la base" para el detalle de un ítem. */
export function compareItem(item: ImportItem): ComparisonRow[] {
  const d = item.datos;
  const e = item.existente;
  const row = (campo: string, archivo: string, base: string | null): ComparisonRow => ({
    campo,
    archivo,
    base,
    difiere: base !== null && base !== archivo && archivo !== '—',
  });
  const base = (value: unknown, format: (v: unknown) => string = text) => (e ? format(value) : null);

  switch (item.entidad) {
    case 'INSTITUCION':
      return [
        row('Nombre', text(d.nombre), base(e?.nombre)),
        row('Código CSS', text(d.codigoCss), base(e?.codigoCss)),
      ];
    case 'PROYECTO':
      return [
        row('Título', text(d.titulo), base(e?.titulo)),
        row('Fecha de inicio', formatDate(d.fechaInicio), base(e?.fechaInicio, formatDate)),
        row('Fecha de cierre', formatDate(d.fechaCierre), base(e?.fechaCierre, formatDate)),
        row('Área temática', text(d.areaCss), base(e?.areaCss)),
        row('Alumnos (reporte CSS)', text(d.alumnosCss), base(e?.alumnosCss)),
        ...(Array.isArray(d.candidatosApp) && d.candidatosApp.length > 0
          ? [row('Coincide en la app con', (d.candidatosApp as Array<{ titulo: string }>).map((c) => c.titulo).join(' · '), null)]
          : []),
        ...(Array.isArray(d.similaresImportados) && d.similaresImportados.length > 0
          ? [row('Parecido a importados', (d.similaresImportados as Array<{ titulo: string; correlativo: string }>)
              .map((c) => `${c.titulo} (correlativo ${c.correlativo})`).join(' · '), null)]
          : []),
      ];
    case 'ESTUDIANTE':
      return [
        row('Nombre', text(d.nombre), base(e?.nombre)),
        row('Carrera', text(d.carrera), base(e?.carrera)),
      ];
    case 'PARTICIPACION':
      return [
        row('Estado', participacionEstado[String(d.estado)] ?? text(d.estado), base(e?.estado, (v) => participacionEstado[String(v)] ?? text(v))),
        row('Horas', formatNumber(Number(d.horas ?? 0)), base(e?.horas, (v) => formatNumber(Number(v ?? 0)))),
        row('Inicio', formatDate(d.fechaInicio), base(e?.asignadaEn, formatDate)),
        row('Fin', formatDate(d.fechaFin), base(e?.cerradaEn, formatDate)),
        row('Origen', describeOrigen(d.archivo, d.pagina, d.linea), null),
      ];
    case 'FILA_PDF':
      return [
        row('Carnet', text(d.carnet), null),
        row('Nombre', text(d.nombre), null),
        row('Institución', `${text(d.codigoInstitucion)} · ${text(d.institucion)}`, null),
        row('Proyecto', `${text(d.correlativo)} · ${text(d.proyecto)}`, null),
        row('Carrera', text(d.carrera), null),
        row('Estado', text(d.estado), null),
        row('Fechas', `${text(d.fechaInicio)} → ${text(d.fechaFin)}`, null),
        row('Horas', text(d.horas), null),
        ...revisionRows(d, row),
      ];
    case 'FILA_XLS':
      return [
        row('Institución', `${text(d.codigoInstitucion)} · ${text(d.institucion)}`, null),
        row('Proyecto', `${text(d.correlativo)} · ${text(d.proyecto)}`, null),
        row('Fechas', `${text(d.fechaInicio)} → ${text(d.fechaFin)}`, null),
      ];
  }
}

/** Fila corregida o excluida en la revisión en línea: lo que traía el PDF y la justificación. */
function revisionRows(d: Record<string, unknown>, row: (campo: string, archivo: string, base: string | null) => ComparisonRow): ComparisonRow[] {
  const o = d.original as Record<string, unknown> | undefined;
  const filas: ComparisonRow[] = [];
  if (o && (d.editada === true || d.excluida === true)) {
    filas.push(row('Original del PDF', `${text(o.estado)} · ${text(o.horas)} h · ${text(o.fechaInicio)} → ${text(o.fechaFin)}`, null));
  }
  if (d.excluida === true) filas.push(row('Excluida', `${text(d.justificacion)} (${text(d.excluidaPor)})`, null));
  return filas;
}

/** Texto plano del ítem para la búsqueda. */
export function itemSearchText(item: ImportItem): string {
  const { titulo, subtitulo } = describeItem(item);
  return `${item.clave} ${titulo} ${subtitulo}`.toLowerCase();
}

export function formatCompletarValue(campo: string, value: unknown): string {
  return campo.startsWith('fecha') ? formatDate(value) : text(value);
}
