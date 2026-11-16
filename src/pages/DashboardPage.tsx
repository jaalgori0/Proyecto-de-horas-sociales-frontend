import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  Download, FileSpreadsheet, Users, BookOpen,
  Building2, MapPin, GraduationCap, ChevronDown, UserCheck,
} from 'lucide-react';
import { exportToExcelFormatted } from '../utils/exportExcel';
import { Notice } from '../components/ui';
import {
  describeApiError,
  getInstitutions,
  getMapMarkers,
  getProjects,
  getDashboardSummary,
  getStudentsByCarreraAndYear,
  getStudentsByMunicipio,
  getProjectsByMunicipio,
  getInstitutionDetailTable,
  getTrendByYear,
  getGenderSummaryAPI,
  type DashboardSummaryResponse,
  type GenderSummaryResponse,
  type InstitutionListResponse,
  type MapMarkerResponse,
  type ProjectListResponse,
  type CarreraAnioRow,
  type EstudiantesMunicipioRow,
  type ProyectosMunicipioRow,
  type TablaInstitucionRow,
  type TrendYearRow,
} from '../services/api';

// ─── Paleta de colores ────────────────────────────────────────────────────────
const C = {
  blue: '#2f68ec',
  green: '#21c08a',
  pink: '#d9488f',
  yellow: '#f5a623',
  purple: '#7c5cbf',
  teal: '#14b8a6',
  orange: '#f97316',
  red: '#ef4444',
  gray: '#6b7280',
};
const PALETTE = [C.blue, C.green, C.pink, C.purple, C.yellow, C.teal, C.orange, C.red];

const SIN_UBICACION = 'Sin ubicación';
/** Instituciones que se grafican en "Métricas por institución" (la tabla muestra todas). */
const TOP_INSTITUCIONES = 15;

/**
 * Filas de /dashboard/carrera-anio: { carrera, facultad, '2025': n, ... }.
 * Se dejan solo `carrera` y las columnas de año (4 dígitos) para que el selector
 * de años y la exportación a Excel no traten `facultad` como si fuera un año.
 */
function sanitizeCarreraAnio(rows: CarreraAnioRow[]): CarreraAnioRow[] {
  return rows.map((row) => {
    const clean: CarreraAnioRow = { carrera: row.carrera };
    for (const [key, value] of Object.entries(row)) {
      if (/^\d{4}$/.test(key)) clean[key] = Number(value ?? 0);
    }
    return clean;
  });
}

// ─── Hook de métricas derivadas ───────────────────────────────────────────────
// Solo datos reales de la API. Si una llamada falla, sus valores quedan en 0/vacío
// y la página muestra un aviso (nunca datos de ejemplo).
function useMetrics(
  apiProjects: ProjectListResponse[],
  apiInstitutions: InstitutionListResponse[],
  apiMarkers: MapMarkerResponse[],
  apiSummary: DashboardSummaryResponse | null,
  apiInstitucionTabla: TablaInstitucionRow[],
  apiTendencia: TrendYearRow[],
  apiGenero: GenderSummaryResponse | null,
  apiProyectosMunicipio: ProyectosMunicipioRow[],
) {
  return useMemo(() => {
    const totalEstudiantesExterno = apiSummary?.totalStudentsExternal ?? 0;
    const totalProyectos = apiSummary?.totalProjects ?? apiProjects.length;
    const totalInstituciones = apiSummary?.totalInstitutions ?? apiInstitutions.length;

    // Req 2 — Género: endpoint dedicado; si no, el del summary; si no, los marcadores reales.
    const genero = apiGenero ?? apiSummary?.genderSummary ?? null;
    const totalHombres = genero?.hombres ?? apiMarkers.reduce((s, m) => s + Number(m.hombres ?? 0), 0);
    const totalMujeres = genero?.mujeres ?? apiMarkers.reduce((s, m) => s + Number(m.mujeres ?? 0), 0);
    const totalSinGenero = Number(genero?.sinDato ?? 0);

    const generoData = [
      { name: 'Hombres', value: totalHombres },
      { name: 'Mujeres', value: totalMujeres },
    ];

    // Req 5/6/7 — directo del backend
    const metricasPorInstitucion = apiInstitucionTabla;

    // "Sin ubicación" agrupa proyectos sin municipio registrado: no es un municipio.
    const totalMunicipios =
      apiSummary?.totalMunicipalities ??
      apiProyectosMunicipio.filter((m) => m.municipio !== SIN_UBICACION).length;

    const tendenciaAnual = apiTendencia.length > 0 ? apiTendencia : (apiSummary?.trendByYear ?? []);

    return {
      totalEstudiantesExterno, totalProyectos, totalInstituciones,
      totalMunicipios, totalHombres, totalMujeres, totalSinGenero,
      generoData, metricasPorInstitucion, tendenciaAnual,
    };
  }, [apiProjects, apiInstitutions, apiMarkers, apiSummary, apiInstitucionTabla, apiTendencia, apiGenero, apiProyectosMunicipio]);
}

// exportToExcel está en src/utils/exportExcel.ts — importado arriba como exportToExcelFormatted

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="dash-kpi-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="dash-kpi-icon">{icon}</div>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <strong className="dash-kpi-value">{value}</strong>
        {sub && <span className="dash-kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '', exportId }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string; exportId?: string;
}) {
  return (
    <div className={`dash-chart-card ${className}`} {...(exportId ? { 'data-export-id': exportId } : {})}>
      <div className="dash-chart-header">
        <h3 className="dash-chart-title">{title}</h3>
        {subtitle && <p className="dash-chart-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dash-tooltip">
      {label && <p className="dash-tooltip-label">{label}</p>}
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

// Req 1 — Gráfico con selector de año
function CarrerasChart({ data: source }: { data: CarreraAnioRow[] }) {
  // Calcula dinámicamente qué años existen en los datos (solo claves de 4 dígitos)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    source.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (/^\d{4}$/.test(key)) yearsSet.add(key);
      });
    });
    return Array.from(yearsSet).sort();
  }, [source]);

  const [anio, setAnio] = useState<string>(availableYears[availableYears.length - 1] ?? '');

  // Si los datos cambian (ej: llegan del backend) y el año seleccionado ya no existe,
  // selecciona el más reciente disponible
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(anio)) {
      setAnio(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, anio]);

  const data = source
    .map((d) => ({ carrera: d.carrera, alumnos: Number(d[anio] ?? 0) }))
    .sort((a, b) => b.alumnos - a.alumnos);

  return (
    <ChartCard
      title="Alumnos en Horas Sociales por Carrera y Año"
      subtitle="Número de estudiantes realizando horas sociales, filtrando por año académico"
      exportId="chart-carreras"
    >
      {source.length === 0 ? (
        <p className="empty-chart">No hay estudiantes con participaciones registradas para mostrar.</p>
      ) : null}
      <div className="dash-year-selector">
        {availableYears.map((y) => (
          <button key={y} type="button" className={`dash-year-btn ${anio === y ? 'active' : ''}`} onClick={() => setAnio(y)}>
            {y}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 96, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="carrera" tick={{ fontSize: 11 }} width={96} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="alumnos" name="Alumnos" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [apiProjects, setApiProjects] = useState<ProjectListResponse[]>([]);
  const [apiInstitutions, setApiInstitutions] = useState<InstitutionListResponse[]>([]);
  const [apiMarkers, setApiMarkers] = useState<MapMarkerResponse[]>([]);
  const [apiSummary, setApiSummary] = useState<DashboardSummaryResponse | null>(null);
  const [apiCarreraAnio, setApiCarreraAnio] = useState<CarreraAnioRow[]>([]);
  const [apiEstudiantesMunicipio, setApiEstudiantesMunicipio] = useState<EstudiantesMunicipioRow[]>([]);
  const [apiProyectosMunicipio, setApiProyectosMunicipio] = useState<ProyectosMunicipioRow[]>([]);
  const [apiInstitucionTabla, setApiInstitucionTabla] = useState<TablaInstitucionRow[]>([]);
  const [apiTendencia, setApiTendencia] = useState<TrendYearRow[]>([]);
  const [apiGenero, setApiGenero] = useState<GenderSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Secciones cuya carga falló (se muestran en un aviso, sin datos de ejemplo).
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const metrics = useMetrics(apiProjects, apiInstitutions, apiMarkers, apiSummary, apiInstitucionTabla, apiTendencia, apiGenero, apiProyectosMunicipio);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const total = metrics.totalHombres + metrics.totalMujeres;
  const hayGenero = total > 0;
  const pctH = hayGenero ? Math.round((metrics.totalHombres / total) * 100) : 0;
  const pctM = hayGenero ? 100 - pctH : 0;
  const currentYear = new Date().getFullYear();

  // Datos para los gráficos de municipios (solo API)
  const estudiantesMunicipioData = apiEstudiantesMunicipio;
  const proyectosMunicipioData = apiProyectosMunicipio;
  const soloSinUbicacion =
    proyectosMunicipioData.length > 0 && proyectosMunicipioData.every((m) => m.municipio === SIN_UBICACION);

  // Top N para el gráfico: más proyectos primero; a igualdad, más estudiantes.
  const topInstituciones = useMemo(
    () =>
      [...metrics.metricasPorInstitucion]
        .sort((a, b) => b.total - a.total || b.estudiantes - a.estudiantes || a.nombre.localeCompare(b.nombre))
        .slice(0, TOP_INSTITUCIONES),
    [metrics.metricasPorInstitucion]
  );

  useEffect(() => {
    let active = true;

    // Cada sección se carga por separado: si una falla, las demás se muestran
    // igual y el aviso indica exactamente qué faltó.
    async function loadDashboardData() {
      setLoading(true);
      const errores: string[] = [];
      const intentar = async <T,>(seccion: string, carga: () => Promise<T>, aplicar: (data: T) => void) => {
        try {
          const data = await carga();
          if (active) aplicar(data);
        } catch (err) {
          errores.push(`${seccion}: ${describeApiError(err)}`);
        }
      };

      await Promise.all([
        intentar('Proyectos', getProjects, setApiProjects),
        intentar('Instituciones', getInstitutions, setApiInstitutions),
        intentar('Marcadores del mapa', getMapMarkers, setApiMarkers),
        intentar('Resumen', getDashboardSummary, setApiSummary),
        intentar('Alumnos por carrera y año', getStudentsByCarreraAndYear, (rows) => setApiCarreraAnio(sanitizeCarreraAnio(rows))),
        intentar('Estudiantes por municipio', getStudentsByMunicipio, setApiEstudiantesMunicipio),
        intentar('Proyectos por municipio', getProjectsByMunicipio, setApiProyectosMunicipio),
        intentar('Tabla por institución', getInstitutionDetailTable, setApiInstitucionTabla),
        intentar('Tendencia anual', getTrendByYear, setApiTendencia),
        intentar('Género', getGenderSummaryAPI, setApiGenero),
      ]);

      if (!active) return;
      setLoadErrors(errores);
      setLoading(false);
    }

    loadDashboardData();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Todas las secciones fallaron con el mismo error de conexión → un solo mensaje claro.
  const errorUnico =
    loadErrors.length > 0 && new Set(loadErrors.map((e) => e.slice(e.indexOf(': ') + 2))).size === 1
      ? loadErrors[0].slice(loadErrors[0].indexOf(': ') + 2)
      : null;

  return (
    <div className="dashboard-page wide-page">

      {/* Encabezado */}
      <div className="dash-header">
        <div>
          <h1>Dashboard de Servicio Social</h1>
        </div>
        <div className="dash-export-group">
          <div className="dash-export-wrapper">
            <button className="primary-btn" type="button" onClick={() => setExportOpen((o) => !o)}>
              <Download size={16} /> Exportar <ChevronDown size={14} />
            </button>
            {exportOpen && (
              <div className="dash-export-dropdown">
                <button type="button" onClick={() => { window.print(); setExportOpen(false); }}>
                  <Download size={15} /> Exportar como PDF
                </button>
                <button type="button" onClick={async () => {
                  setExportOpen(false);
                  setExportLoading(true);
                  try {
                    await exportToExcelFormatted(
                      metrics,
                      apiCarreraAnio,
                      estudiantesMunicipioData,
                      proyectosMunicipioData,
                    );
                  } finally {
                    setExportLoading(false);
                  }
                }}>
                  <FileSpreadsheet size={15} /> {exportLoading ? 'Generando Excel…' : 'Exportar como Excel'}
                </button> 
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? <p className="muted">Cargando datos del dashboard...</p> : null}
      {!loading && loadErrors.length > 0 ? (
        <Notice
          title={
            loadErrors.length === 10
              ? 'No se pudieron cargar los datos del dashboard'
              : `No se pudieron cargar ${loadErrors.length} de 10 secciones del dashboard`
          }
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {loadErrors.length === 10 && errorUnico ? (
            errorUnico
          ) : (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {loadErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div>Las cifras de esas secciones aparecen en 0 o vacías; no se muestran datos de ejemplo.</div>
        </Notice>
      ) : null}

      {/* KPIs — incluye el total de externos (Req 6) y el desglose de género (Req 2) */}
      <div className="dash-kpi-grid">
        <KpiCard icon={<UserCheck size={22} />} label="Estudiantes en Servicio Social Externo" value={metrics.totalEstudiantesExterno} sub={`Total activos ${currentYear}`} color={C.blue} />
        <KpiCard icon={<BookOpen size={22} />} label="Proyectos Totales" value={metrics.totalProyectos} sub="Todas las instituciones" color={C.green} />
        <KpiCard icon={<Building2 size={22} />} label="Instituciones Aliadas" value={metrics.totalInstituciones} sub="Públicas y privadas" color={C.purple} />
        <KpiCard icon={<MapPin size={22} />} label="Municipios con Proyectos" value={metrics.totalMunicipios} sub="Cobertura nacional" color={C.teal} />
        <KpiCard icon={<Users size={22} />} label="Hombres en Servicio Social" value={metrics.totalHombres} sub={hayGenero ? `${pctH}% del total` : 'Sin datos de género'} color={C.blue} />
        <KpiCard icon={<GraduationCap size={22} />} label="Mujeres en Servicio Social" value={metrics.totalMujeres} sub={hayGenero ? `${pctM}% del total` : 'Sin datos de género'} color={C.pink} />
      </div>

      {/* Req 1 — Alumnos por carrera y año */}
      <CarrerasChart data={apiCarreraAnio} />

      {/* Req 2 — Género + Tendencia anual */}
      <div className="dash-grid-2">
         <ChartCard title="Hombres y Mujeres en Horas Sociales" subtitle="Distribución por género de los estudiantes en servicio social externo" exportId="chart-genero">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={metrics.generoData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value">
                <Cell fill={C.blue} />
                <Cell fill={C.pink} />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          {hayGenero ? (
            <div className="dash-gender-bar">
              <div className="dash-gender-segment men" style={{ width: `${pctH}%` }}><span>{pctH}% H</span></div>
              <div className="dash-gender-segment women" style={{ width: `${pctM}%` }}><span>{pctM}% M</span></div>
            </div>
          ) : (
            <p className="empty-chart">
              No hay datos de género registrados
              {metrics.totalSinGenero > 0 ? ` (${metrics.totalSinGenero} estudiantes sin este dato)` : ''}.
            </p>
          )}
          {hayGenero && metrics.totalSinGenero > 0 ? (
            <p className="muted" style={{ fontSize: '0.85rem', margin: '8px 0 0' }}>
              {metrics.totalSinGenero} estudiantes no tienen género registrado y no se incluyen.
            </p>
          ) : null}
        </ChartCard>

        <ChartCard title="Tendencia Anual de Estudiantes Externos" subtitle="Evolución histórica de la participación en servicio social por año" exportId="chart-tendencia">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metrics.tendenciaAnual} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="estudiantes" name="Estudiantes" stroke={C.blue} strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="proyectos" name="Proyectos" stroke={C.green} strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {soloSinUbicacion ? (
        <Notice variant="info" title="Los proyectos aún no tienen municipio registrado">
          Los gráficos por municipio agrupan todo en “{SIN_UBICACION}” hasta que se registre la ubicación de los proyectos.
        </Notice>
      ) : null}

      {/* Req 3 — Estudiantes por municipio */}
      <ChartCard title="Número de Estudiantes por Municipio" subtitle="Distribución de estudiantes en servicio social externo según municipio de ejecución del proyecto" exportId="chart-municipios-estudiantes">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={estudiantesMunicipioData} margin={{ top: 4, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="municipio" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="estudiantes" name="Estudiantes" radius={[6, 6, 0, 0]}>
              {estudiantesMunicipioData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Req 4 — Proyectos por municipio */}
       <ChartCard title="Número de Proyectos por Municipio" subtitle="Total de proyectos registrados versus proyectos actualmente activos por municipio" exportId="chart-municipios-proyectos">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={proyectosMunicipioData} margin={{ top: 4, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="municipio" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="proyectos" name="Total Proyectos" fill={C.purple} radius={[6, 6, 0, 0]} />
            <Bar dataKey="activos" name="Activos" fill={C.green} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Req 5 — Métricas por institución (gráfico apilado) */}
      <ChartCard
        title="Métricas de Proyectos por Institución"
        subtitle={
          metrics.metricasPorInstitucion.length > TOP_INSTITUCIONES
            ? `Top ${TOP_INSTITUCIONES} de ${metrics.metricasPorInstitucion.length} instituciones por total de proyectos (activos, en progreso y cerrados). La tabla inferior incluye todas.`
            : 'Comparativa de proyectos activos, en progreso y cerrados por cada institución aliada'
        }
        exportId="chart-instituciones"
      >
        {topInstituciones.length === 0 ? (
          <p className="empty-chart">No hay instituciones para mostrar.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, topInstituciones.length * 30 + 60)}>
            <BarChart data={topInstituciones} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="nombre"
                width={230}
                interval={0}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: string) => (value.length > 34 ? `${value.slice(0, 33)}…` : value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="activos" name="Activos" fill={C.green} stackId="a" />
              <Bar dataKey="progreso" name="En progreso" fill={C.yellow} stackId="a" />
              <Bar dataKey="cerrados" name="Cerrados" fill={C.gray} stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Req 5 + Req 6 — Tabla detallada */}
      <div className="dash-chart-card">
        <div className="dash-chart-header">
          <h3 className="dash-chart-title">Tabla Detallada por Institución</h3>
          <p className="dash-chart-subtitle">Resumen completo incluyendo estudiantes en servicio social externo por institución aliada</p>
        </div>
        <div className="dash-table-wrapper">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Institución</th>
                <th>Tipo</th>
                <th>Ubicación</th>
                <th>Total Proyectos</th>
                <th>Activos</th>
                <th>En Progreso</th>
                <th>Cerrados</th>
                <th>Estudiantes Externos</th>
                <th>Facultades</th>
              </tr>
            </thead>
            <tbody>
              {metrics.metricasPorInstitucion.map((inst) => (
                <tr key={inst.nombre}>
                  <td>
                    <div className="dash-inst-name">
                      <strong>{inst.nombre}</strong>
                      <span className="dash-inst-full">{inst.nombreFull}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`dash-badge ${inst.tipo === 'Pública' ? 'public' : 'private'}`}>{inst.tipo}</span>
                  </td>
                  <td>{inst.ubicacion}</td>
                  <td className="dash-num">{inst.total}</td>
                  <td className="dash-num dash-num-green">{inst.activos}</td>
                  <td className="dash-num dash-num-yellow">{inst.progreso}</td>
                  <td className="dash-num dash-num-purple">{inst.cerrados}</td>
                  <td className="dash-num"><strong>{inst.estudiantes}</strong></td>
                  <td className="dash-num">{inst.facultades}</td>
                </tr>
              ))}
              <tr className="dash-table-total">
                <td colSpan={3}><strong>TOTALES</strong></td>
                <td className="dash-num"><strong>{metrics.metricasPorInstitucion.reduce((s, i) => s + i.total, 0)}</strong></td>
                <td className="dash-num"><strong>{metrics.metricasPorInstitucion.reduce((s, i) => s + i.activos, 0)}</strong></td>
                <td className="dash-num"><strong>{metrics.metricasPorInstitucion.reduce((s, i) => s + i.progreso, 0)}</strong></td>
                <td className="dash-num"><strong>{metrics.metricasPorInstitucion.reduce((s, i) => s + i.cerrados, 0)}</strong></td>
                <td className="dash-num"><strong>{metrics.totalEstudiantesExterno}</strong></td>
                <td className="dash-num"><strong>{metrics.metricasPorInstitucion.reduce((s, i) => s + i.facultades, 0)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
