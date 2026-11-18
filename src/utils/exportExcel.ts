/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import type { CarreraAnioRow, EstudiantesMunicipioRow, ProyectosMunicipioRow } from '../services/api';

const COL = {
  azulOscuro: 'FF1E3A5F',
  azulMedio:  'FF2F68EC',
  azulClaro:  'FFD6E4FF',
  verdeFondo: 'FFD1FAE5',
  amarFondo:  'FFFEF9C3',
  morFondo:   'FFEDE9FE',
  grisClaro:  'FFF3F4F6',
  blanco:     'FFFFFFFF',
  negro:      'FF111827',
  textWhite:  'FFFFFFFF',
};

type HAlign = 'left' | 'center' | 'right';

function applyCell(
  ws: ExcelJS.Worksheet,
  row: number, col: number,
  value: ExcelJS.CellValue,
  opts: {
    bold?: boolean; size?: number; fontArgb?: string;
    fillArgb?: string; hAlign?: HAlign;
    wrapText?: boolean; bordered?: boolean;
  } = {}
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  (cell as any).font = { name: 'Arial', bold: opts.bold ?? false, size: opts.size ?? 11, color: { argb: opts.fontArgb ?? COL.negro } };
  if (opts.fillArgb) (cell as any).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fillArgb } };
  cell.alignment = { horizontal: opts.hAlign ?? 'left', vertical: 'middle', wrapText: opts.wrapText ?? true };
  if (opts.bordered) {
    const b = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
    cell.border = { top: b, bottom: b, left: b, right: b };
  }
}

function mergeSet(
  ws: ExcelJS.Worksheet,
  row: number, c1: number, c2: number,
  value: ExcelJS.CellValue,
  opts: Parameters<typeof applyCell>[4] = {}
) {
  if (c1 !== c2) ws.mergeCells(row, c1, row, c2);
  applyCell(ws, row, c1, value, opts);
}

async function captureEl(el: HTMLElement): Promise<string> {
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  return canvas.toDataURL('image/png').split(',')[1];
}

async function embedChart(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  chartCaptures: Record<string, string>,
  chartId: string,
  startRow: number, startCol: number,
  endCol: number, heightRows: number,
): Promise<number> {
  const b64 = chartCaptures[chartId];
  if (!b64) return startRow + heightRows;
  const imageId = wb.addImage({ base64: b64, extension: 'png' });
  (ws as any).addImage(imageId, {
    tl: { col: startCol - 1, row: startRow - 1 },
    br: { col: endCol,       row: startRow - 1 + heightRows },
  });
  return startRow + heightRows;
}

export async function exportToExcelFormatted(
  metrics: {
    totalEstudiantesExterno: number;
    totalProyectos: number;
    totalInstituciones: number;
    totalMunicipios: number;
    totalHombres: number;
    totalMujeres: number;
    metricasPorInstitucion: Array<{
      nombre: string;
      nombreFull?: string;
      tipo: string;
      ubicacion: string;
      total: number;
      activos: number;
      progreso: number;
      cerrados: number;
      estudiantes: number;
      facultades: number;
    }>;
    tendenciaAnual: Array<{ anio: string; estudiantes: number; proyectos: number }>;
  },
  alumnosPorCarreraAnio: CarreraAnioRow[],
  estudiantesPorMunicipio: EstudiantesMunicipioRow[],
  proyectosPorMunicipio: ProyectosMunicipioRow[],
) {
  const fecha = new Date().toLocaleDateString('es-SV', { year: 'numeric', month: 'long', day: 'numeric' });
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const total = metrics.totalHombres + metrics.totalMujeres;
  const pctH = total > 0 ? Math.round((metrics.totalHombres / total) * 100) : 50;
  const pctM = 100 - pctH;

  const chartCaptures: Record<string, string> = {};
  const chartIds = [
    'chart-carreras', 'chart-genero', 'chart-tendencia',
    'chart-municipios-estudiantes', 'chart-municipios-proyectos', 'chart-instituciones',
  ];
  // Los gráficos del dashboard tienen scroll interno (.dash-scroll): durante la
  // captura se despliegan completos para que la imagen no salga recortada.
  document.body.classList.add('dash-exporting');
  try {
    for (const id of chartIds) {
      const el = document.querySelector<HTMLElement>(`[data-export-id="${id}"]`);
      if (el) {
        try { chartCaptures[id] = await captureEl(el); } catch { /* skip */ }
      }
    }
  } finally {
    document.body.classList.remove('dash-exporting');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Horas Sociales';
  wb.created = new Date();

  // ── HOJA 1: Dashboard visual ──────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Dashboard', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: COL.azulMedio } },
  });
  ws1.views = [{ state: 'normal', showGridLines: false }];
  ws1.getColumn(1).width = 5;
  for (let c = 2; c <= 12; c++) ws1.getColumn(c).width = 13.5;

  let r = 1;
  const COLS = 12;

  // Banner
  ws1.mergeCells(r, 1, r + 2, COLS);
  applyCell(ws1, r, 1,
    'SISTEMA DE GESTIÓN DE HORAS SOCIALES\nDashboard de Servicio Social Universitario',
    { bold: true, size: 18, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' }
  );
  [r, r + 1, r + 2].forEach(rr => ws1.getRow(rr).height = 22);
  r += 3;

  mergeSet(ws1, r, 1, COLS, `Fecha de generación: ${fecha}`,
    { fillArgb: COL.azulClaro, hAlign: 'center', size: 10 });
  ws1.getRow(r).height = 18;
  r += 2;

  mergeSet(ws1, r, 1, COLS, 'INDICADORES CLAVE DE DESEMPEÑO',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulMedio });
  ws1.getRow(r).height = 22;
  r++;

  const kpis = [
    { label: 'Estudiantes en\nServicio Social Externo', val: metrics.totalEstudiantesExterno, sub: `Total activos ${new Date().getFullYear()}`, argb: COL.azulMedio },
    { label: 'Proyectos\nTotales',                     val: metrics.totalProyectos,           sub: 'Todas las instituciones',               argb: 'FF21C08A'    },
    { label: 'Instituciones\nAliadas',                 val: metrics.totalInstituciones,       sub: 'Públicas y privadas',                   argb: 'FF7C5CBF'    },
    { label: 'Municipios con\nProyectos',              val: metrics.totalMunicipios,          sub: 'Cobertura nacional',                    argb: 'FF00B4D8'    },
    { label: 'Hombres en\nServicio Social',            val: metrics.totalHombres,             sub: `${pctH}% del total`,                    argb: COL.azulMedio },
    { label: 'Mujeres en\nServicio Social',            val: metrics.totalMujeres,             sub: `${pctM}% del total`,                    argb: 'FFD9488F'    },
  ];
  const kpiCols = [1, 5, 9];

  for (let pass = 0; pass < 2; pass++) {
    const lr = r; const vr = r + 1; const sr = r + 2;
    ws1.getRow(lr).height = 28; ws1.getRow(vr).height = 34; ws1.getRow(sr).height = 18;
    for (let k = 0; k < 3; k++) {
      const kpi = kpis[pass * 3 + k];
      const c1 = kpiCols[k], c2 = c1 + 3;
      ws1.mergeCells(lr, c1, lr, c2);
      applyCell(ws1, lr, c1, kpi.label,
        { bold: true, size: 10, fontArgb: COL.textWhite, fillArgb: kpi.argb, hAlign: 'center', bordered: true });
      ws1.mergeCells(vr, c1, vr, c2);
      applyCell(ws1, vr, c1, kpi.val,
        { bold: true, size: 22, fontArgb: kpi.argb, fillArgb: COL.blanco, hAlign: 'center', bordered: true });
      ws1.mergeCells(sr, c1, sr, c2);
      applyCell(ws1, sr, c1, kpi.sub,
        { size: 9, fontArgb: COL.negro, fillArgb: COL.grisClaro, hAlign: 'center', bordered: true });
    }
    r += 4;
  }
  r++;

  // Gráfico: Carreras
  mergeSet(ws1, r, 1, COLS, 'ALUMNOS EN HORAS SOCIALES POR CARRERA Y AÑO',
    { bold: true, size: 12, fontArgb: COL.textWhite, fillArgb: COL.azulMedio });
  ws1.getRow(r).height = 22; r++;
  mergeSet(ws1, r, 1, COLS, 'Número de estudiantes realizando horas sociales, filtrando por año académico',
    { size: 9, fillArgb: COL.azulClaro });
  ws1.getRow(r).height = 15; r++;
  for (let rr = r; rr < r + 22; rr++) ws1.getRow(rr).height = 15;
  r = await embedChart(wb, ws1, chartCaptures, 'chart-carreras', r, 1, COLS, 22);

  // Gráficos: Género + Tendencia
  mergeSet(ws1, r, 1, 6,    'HOMBRES Y MUJERES EN HORAS SOCIALES',
    { bold: true, size: 12, fontArgb: COL.textWhite, fillArgb: COL.azulMedio });
  mergeSet(ws1, r, 7, COLS, 'TENDENCIA ANUAL DE ESTUDIANTES EXTERNOS',
    { bold: true, size: 12, fontArgb: COL.textWhite, fillArgb: 'FF21C08A' });
  ws1.getRow(r).height = 22; r++;
  const dualStart = r;
  for (let rr = dualStart; rr < dualStart + 20; rr++) ws1.getRow(rr).height = 15;
  await embedChart(wb, ws1, chartCaptures, 'chart-genero',    dualStart, 1, 6,    20);
  r = await embedChart(wb, ws1, chartCaptures, 'chart-tendencia', dualStart, 7, COLS, 20);

  // Gráficos: Municipios
  mergeSet(ws1, r, 1, 6,    'ESTUDIANTES POR MUNICIPIO',
    { bold: true, size: 12, fontArgb: COL.textWhite, fillArgb: COL.azulMedio });
  mergeSet(ws1, r, 7, COLS, 'PROYECTOS POR MUNICIPIO',
    { bold: true, size: 12, fontArgb: COL.textWhite, fillArgb: 'FF7C5CBF' });
  ws1.getRow(r).height = 22; r++;
  const munStart = r;
  for (let rr = munStart; rr < munStart + 20; rr++) ws1.getRow(rr).height = 15;
  await embedChart(wb, ws1, chartCaptures, 'chart-municipios-estudiantes', munStart, 1, 6,    20);
  r = await embedChart(wb, ws1, chartCaptures, 'chart-municipios-proyectos',    munStart, 7, COLS, 20);

  // Gráfico: Instituciones
  mergeSet(ws1, r, 1, COLS, 'MÉTRICAS DE PROYECTOS POR INSTITUCIÓN',
    { bold: true, size: 12, fontArgb: COL.textWhite, fillArgb: COL.azulMedio });
  ws1.getRow(r).height = 22; r++;
  for (let rr = r; rr < r + 22; rr++) ws1.getRow(rr).height = 15;
  r = await embedChart(wb, ws1, chartCaptures, 'chart-instituciones', r, 1, COLS, 22);
  r++;

  // Tabla detallada
  mergeSet(ws1, r, 1, COLS, 'TABLA DETALLADA POR INSTITUCIÓN',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' });
  ws1.getRow(r).height = 24; r++;
  mergeSet(ws1, r, 1, COLS, 'Resumen completo — estudiantes en servicio social externo por institución aliada',
    { size: 9, fillArgb: COL.azulClaro });
  ws1.getRow(r).height = 15; r++;

  ws1.getColumn(1).width = 30; ws1.getColumn(2).width = 10; ws1.getColumn(3).width = 22;
  for (let c = 4; c <= 9; c++) ws1.getColumn(c).width = 13;

  ['Institución', 'Tipo', 'Ubicación', 'Total Proy.', 'Activos', 'En Prog.', 'Cerrados', 'Est. Ext.', 'Facultades']
    .forEach((h, i) => applyCell(ws1, r, i + 1, h, {
      bold: true, size: 10, fontArgb: COL.textWhite, fillArgb: COL.azulMedio,
      hAlign: i === 0 ? 'left' : 'center', bordered: true,
    }));
  ws1.getRow(r).height = 18; r++;

  metrics.metricasPorInstitucion.forEach((inst, idx) => {
    const bg = idx % 2 === 0 ? COL.blanco : COL.grisClaro;
    applyCell(ws1, r, 1, inst.nombreFull ?? inst.nombre, { fillArgb: bg, bordered: true });
    applyCell(ws1, r, 2, inst.tipo, { fillArgb: inst.tipo === 'Pública' ? COL.azulClaro : COL.morFondo, hAlign: 'center', size: 9, bordered: true });
    applyCell(ws1, r, 3, inst.ubicacion,   { fillArgb: bg, bordered: true });
    applyCell(ws1, r, 4, inst.total,       { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws1, r, 5, inst.activos,     { fillArgb: COL.verdeFondo, hAlign: 'center', bordered: true });
    applyCell(ws1, r, 6, inst.progreso,    { fillArgb: COL.amarFondo,  hAlign: 'center', bordered: true });
    applyCell(ws1, r, 7, inst.cerrados,    { fillArgb: COL.morFondo,   hAlign: 'center', bordered: true });
    applyCell(ws1, r, 8, inst.estudiantes, { fillArgb: bg, hAlign: 'center', bold: true, bordered: true });
    applyCell(ws1, r, 9, inst.facultades,  { fillArgb: bg, hAlign: 'center', bordered: true });
    ws1.getRow(r).height = 16;
    r++;
  });

  const mp = metrics.metricasPorInstitucion;
  ws1.mergeCells(r, 1, r, 3);
  applyCell(ws1, r, 1, 'TOTALES', { bold: true, fillArgb: COL.azulOscuro, fontArgb: COL.textWhite, bordered: true });
  [
    mp.reduce((s, i) => s + i.total, 0),
    mp.reduce((s, i) => s + i.activos, 0),
    mp.reduce((s, i) => s + i.progreso, 0),
    mp.reduce((s, i) => s + i.cerrados, 0),
    metrics.totalEstudiantesExterno,
    mp.reduce((s, i) => s + i.facultades, 0),
  ].forEach((v, i) =>
    applyCell(ws1, r, i + 4, v, { bold: true, fillArgb: COL.azulOscuro, fontArgb: COL.textWhite, hAlign: 'center', bordered: true })
  );
  ws1.getRow(r).height = 18;

  // ── HOJA 2: Datos numéricos ───────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Datos', { properties: { tabColor: { argb: 'FF21C08A' } } });
  ws2.views = [{ state: 'normal', showGridLines: false }];
  ws2.getColumn(1).width = 30; ws2.getColumn(2).width = 16; ws2.getColumn(3).width = 16;
  for (let c = 4; c <= 12; c++) ws2.getColumn(c).width = 14;

  let r2 = 1;
  const years = Array.from(
    new Set(alumnosPorCarreraAnio.flatMap(row => Object.keys(row).filter(k => k !== 'carrera')))
  ).sort();
  const C2 = 1 + years.length + 1;

  mergeSet(ws2, r2, 1, C2, 'ALUMNOS POR CARRERA Y AÑO',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' });
  ws2.getRow(r2).height = 22; r2 += 2;

  applyCell(ws2, r2, 1, 'Carrera', { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true });
  years.forEach((y, i) => applyCell(ws2, r2, i + 2, y, { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true }));
  applyCell(ws2, r2, years.length + 2, 'Total', { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true });
  ws2.getRow(r2).height = 18; r2++;

  alumnosPorCarreraAnio.forEach((d, idx) => {
    const bg = idx % 2 === 0 ? COL.blanco : COL.grisClaro;
    const tot = years.reduce((s, y) => s + Number(d[y] ?? 0), 0);
    applyCell(ws2, r2, 1, d.carrera, { fillArgb: bg, bordered: true });
    years.forEach((y, i) => applyCell(ws2, r2, i + 2, Number(d[y] ?? 0), { fillArgb: bg, hAlign: 'right', bordered: true }));
    applyCell(ws2, r2, years.length + 2, tot, { bold: true, fillArgb: bg, hAlign: 'right', bordered: true });
    ws2.getRow(r2).height = 16; r2++;
  });
  r2 += 2;

  mergeSet(ws2, r2, 1, 4, 'DISTRIBUCIÓN POR GÉNERO',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' });
  ws2.getRow(r2).height = 22; r2 += 2;
  ['Género', 'Estudiantes', '% del Total'].forEach((h, i) =>
    applyCell(ws2, r2, i + 1, h, { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true }));
  ws2.getRow(r2).height = 18; r2++;
  [['Hombres', metrics.totalHombres, `${pctH}%`], ['Mujeres', metrics.totalMujeres, `${pctM}%`]].forEach(([l, v, p], idx) => {
    const bg = idx % 2 === 0 ? COL.blanco : COL.grisClaro;
    applyCell(ws2, r2, 1, l as string, { fillArgb: bg, bordered: true });
    applyCell(ws2, r2, 2, v as number, { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 3, p as string, { fillArgb: bg, hAlign: 'center', bordered: true });
    ws2.getRow(r2).height = 16; r2++;
  });
  applyCell(ws2, r2, 1, 'TOTAL', { bold: true, fillArgb: COL.azulOscuro, fontArgb: COL.textWhite, bordered: true });
  applyCell(ws2, r2, 2, total,   { bold: true, fillArgb: COL.azulOscuro, fontArgb: COL.textWhite, hAlign: 'center', bordered: true });
  applyCell(ws2, r2, 3, '100%',  { bold: true, fillArgb: COL.azulOscuro, fontArgb: COL.textWhite, hAlign: 'center', bordered: true });
  ws2.getRow(r2).height = 18; r2 += 2;

  mergeSet(ws2, r2, 1, 4, 'TENDENCIA ANUAL',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' });
  ws2.getRow(r2).height = 22; r2 += 2;
  ['Año', 'Estudiantes Externos', 'Proyectos'].forEach((h, i) =>
    applyCell(ws2, r2, i + 1, h, { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true }));
  ws2.getRow(r2).height = 18; r2++;
  metrics.tendenciaAnual.forEach((d, idx) => {
    const bg = idx % 2 === 0 ? COL.blanco : COL.grisClaro;
    applyCell(ws2, r2, 1, d.anio,        { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 2, d.estudiantes, { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 3, d.proyectos,   { fillArgb: bg, hAlign: 'center', bordered: true });
    ws2.getRow(r2).height = 16; r2++;
  });
  r2 += 2;

  mergeSet(ws2, r2, 1, 3, 'ESTUDIANTES POR MUNICIPIO',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' });
  ws2.getRow(r2).height = 22; r2 += 2;
  ['#', 'Municipio', 'Estudiantes'].forEach((h, i) =>
    applyCell(ws2, r2, i + 1, h, { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true }));
  ws2.getRow(r2).height = 18; r2++;
  estudiantesPorMunicipio.forEach((d, idx) => {
    const bg = idx % 2 === 0 ? COL.blanco : COL.grisClaro;
    applyCell(ws2, r2, 1, idx + 1,       { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 2, d.municipio,   { fillArgb: bg, bordered: true });
    applyCell(ws2, r2, 3, d.estudiantes, { fillArgb: bg, hAlign: 'center', bordered: true });
    ws2.getRow(r2).height = 16; r2++;
  });
  r2 += 2;

  mergeSet(ws2, r2, 1, 5, 'PROYECTOS POR MUNICIPIO',
    { bold: true, size: 13, fontArgb: COL.textWhite, fillArgb: COL.azulOscuro, hAlign: 'center' });
  ws2.getRow(r2).height = 22; r2 += 2;
  ['#', 'Municipio', 'Total Proyectos', 'Activos', '% Activos'].forEach((h, i) =>
    applyCell(ws2, r2, i + 1, h, { bold: true, fontArgb: COL.textWhite, fillArgb: COL.azulMedio, hAlign: 'center', bordered: true }));
  ws2.getRow(r2).height = 18; r2++;
  proyectosPorMunicipio.forEach((d, idx) => {
    const bg = idx % 2 === 0 ? COL.blanco : COL.grisClaro;
    const pct = d.proyectos > 0 ? `${Math.round((d.activos / d.proyectos) * 100)}%` : '0%';
    applyCell(ws2, r2, 1, idx + 1,       { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 2, d.municipio,   { fillArgb: bg, bordered: true });
    applyCell(ws2, r2, 3, d.proyectos,   { fillArgb: bg, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 4, d.activos,     { fillArgb: COL.verdeFondo, hAlign: 'center', bordered: true });
    applyCell(ws2, r2, 5, pct,           { fillArgb: bg, hAlign: 'center', bordered: true });
    ws2.getRow(r2).height = 16; r2++;
  });

  // ── Descarga ──────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EduMap_Dashboard_${fechaArchivo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}