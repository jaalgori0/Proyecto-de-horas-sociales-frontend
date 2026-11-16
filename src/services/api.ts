const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // Sin VITE_API_URL: backend actual (horas-sociales-core-backend) en el mismo host.
  const hostname = window.location.hostname;
  return `http://${hostname}:3000/api/v1`;
};

export const API_BASE = getApiBase();

/**
 * Error de la API.
 *  - kind 'network': no hubo respuesta (backend apagado, URL o CORS incorrectos).
 *  - kind 'http': el backend respondió con un código de error; `message` es el
 *    mensaje legible que envía ({ error: { code, message, details } }).
 */
export class ApiError extends Error {
  readonly kind: 'network' | 'http';
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(kind: 'network' | 'http', message: string, extra: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = extra.status;
    this.code = extra.code;
    this.details = extra.details;
  }
}

/** Mensaje para mostrar al usuario a partir de cualquier error de una llamada a la API. */
export function describeApiError(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  // Con FormData el navegador fija `multipart/form-data; boundary=…`: forzar JSON rompería la subida.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      'network',
      `No se pudo conectar con el servidor (${API_BASE}). Verifique que el backend esté en ejecución.`,
    );
  }

  if (!response.ok) {
    // Formato del backend: { error: { code, message, details } }. Si no es JSON, se usa el texto.
    const text = await response.text();
    let message = text || `Error ${response.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
      const json = JSON.parse(text);
      const err = json?.error;
      if (err && typeof err === 'object') {
        message = err.message ?? message;
        code = err.code;
        details = err.details;
        // Errores de validación: se agregan los motivos concretos ("La contraseña debe tener…").
        if (Array.isArray(details)) {
          const motivos = details
            .map((d: { message?: unknown }) => (typeof d?.message === 'string' ? d.message : null))
            .filter(Boolean);
          if (motivos.length > 0) message = `${message}: ${motivos.join('; ')}`;
        }
      } else if (typeof err === 'string') {
        message = err;
      } else if (typeof json?.message === 'string') {
        message = json.message;
      }
    } catch {
      /* respuesta no JSON: se conserva el texto */
    }
    throw new ApiError('http', message, { status: response.status, code, details });
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type CreateProjectPayload = {
  institutionId?: string;
  institutionName: string;
  institutionType: string;
  institutionLocation: string;
  institutionDescription: string;
  institutionImage?: string | null;
  facultad: string;
  carreras: string[];
  titulo: string;
  ubicacion: string;
  descripcion: string;
  resumen?: string;
  fechaInicio?: string;
  fechaCierre?: string;
  cupos?: number;
  personas?: number;
  projectImage?: string | null;
  image?: string | null;
  students?: ProjectStudentPayload[];
};

export type ProjectStudentPayload = {
  nombre: string;
  carnet: string;
  carrera?: string;
  cargo?: string;
  activo?: boolean;
  genero?: 'Masculino' | 'Femenino' | null;
  avatar?: string | null;
  email?: string | null;
};

export type ProjectListResponse = {
  id: number | string;
  titulo: string;
  ubicacion: string;
  facultad: string;
  descripcion?: string;
  carreras?: string[];
  estado?: string;
  institution?: string;
  equipo: string[];
  personas?: number;
  status?: string;
  cuposTexto?: string;
  cuposOcupados?: number;
  cuposTotales?: number | null;
};

export type ProjectMapResponse = {
  id: number | string;
  institution: string;
  status: string;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  hombres: number;
  mujeres: number;
};

export type MapMarkerResponse = {
  id: number | string;
  label: string;
  hombres: number;
  mujeres: number;
  lat: number;
  lng: number;
  projectId: number | string | null;
};

export type InstitutionListResponse = {
  id: number | string;
  nombre: string;
  tipo?: string | null;
  ubicacion: string;
  image?: string | null;
  totalProyectosActivos: number;
  totalEstudiantesAsignados: number;
};

export type InstitutionProjectResponse = {
  id: number | string;
  nombreInstitucion: string;
  nombreProyecto: string;
  estadoProyecto: 'Activo' | 'En progreso' | 'Cerrado';
  ubicacion: string;
};

export type InstitutionDetailResponse = {
  id: number | string;
  image?: string | null;
  tipo?: string | null;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  totalProyectosActivos: number;
  totalEstudiantesAsignados: number;
  totalCarrerasAplicables: number;
  proyectosGenerales: InstitutionProjectResponse[];
  proyectosActivos: InstitutionProjectResponse[];
  proyectosEnProgreso: InstitutionProjectResponse[];
  proyectosCerrados: InstitutionProjectResponse[];
};

export type EnrollStudentPayload = {
  nombre: string;
  carnet: string;
  carrera: string;
  cargo?: string;
  activo?: boolean;
  genero?: 'Masculino' | 'Femenino' | null;
  email?: string | null;
};

export type ProjectDetailResponse = {
  id: number | string;
  nombre: string;
  titulo: string;
  imagen: string | null;
  status: string;
  estado: string;
  institution: string;
  institutionTipo?: string | null;
  institutionDescripcion?: string | null;
  institutionImageUrl?: string | null;
  facultad?: string;
  ubicacion: string;
  descripcion: string;
  resumen: string | null;
  equipo: string[];
  estudiantes: ProjectStudentPayload[];
  estudiantesAsignados?: number;
  cuposTexto?: string;
  cuposOcupados?: number;
  cuposTotales?: number | null;
  carreras: string[];
  fechaInicio: string | null;
  fechaCierre: string | null;
  hombres?: number;
  mujeres?: number;
  desplegados?: string | null;
};

export function parseCsvList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export function createProject(payload: CreateProjectPayload) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type UpdateProjectPayload = {
  institutionId?: string | number;
  institutionName?: string;
  institutionType?: string;
  institutionLocation?: string;
  institutionDescription?: string;
  institutionImage?: string | null;
  facultad?: string;
  carreras?: string[];
  titulo?: string;
  ubicacion?: string;
  descripcion?: string;
  resumen?: string;
  fechaInicio?: string;
  fechaCierre?: string;
  cupos?: number;
  estado?: string;
  status?: string;
  projectImage?: string | null;
  image?: string | null;
};

export function getProjects(filters?: {
  search?: string;
  status?: string;
  location?: string;
  faculty?: string;
  institutionId?: string | number;
}) {
  const params = new URLSearchParams();

  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.location) params.set('location', filters.location);
  if (filters?.faculty) params.set('faculty', filters.faculty);
  if (filters?.institutionId !== undefined && filters.institutionId !== null) {
    params.set('institutionId', String(filters.institutionId));
  }

  const query = params.toString();
  return request<ProjectListResponse[]>(`/projects${query ? `?${query}` : ''}`);
}

export function getProjectsForMap() {
  return request<ProjectMapResponse[]>('/projects/map');
}

export function getMapMarkers() {
  return request<MapMarkerResponse[]>('/dashboard/map-markers');
}

export function getInstitutions(filters?: { search?: string; type?: string; sortBy?: 'nombre-asc' | 'nombre-desc' }) {
  const params = new URLSearchParams();

  if (filters?.search) params.set('search', filters.search);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);

  const query = params.toString();
  return request<InstitutionListResponse[]>(`/institutions${query ? `?${query}` : ''}`);
}

export function getInstitutionById(institutionId: string | number) {
  return request<InstitutionDetailResponse>(`/institutions/${institutionId}`);
}

export function enrollStudent(projectId: string, payload: EnrollStudentPayload) {
  return request(`/projects/${projectId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getProjectById(projectId: string | number) {
  return request<ProjectDetailResponse>(`/projects/${projectId}`);
}

export function updateProject(projectId: string | number, payload: UpdateProjectPayload) {
  return request<ProjectDetailResponse>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export type DashboardSummaryResponse = {
  totalInstitutions: number;
  totalProjects: number;
  totalActiveEnrollments: number;
  totalMarkers: number;
  totalStudentsExternal: number;
  projectsByStatus: Array<{ estado: string; total: string }>;
  trendByYear: Array<{ anio: string; estudiantes: number; proyectos: number }>;
  genderSummary: GenderSummaryResponse;
  totalMunicipalities?: number;
};

/** `sinDato`: participantes sin género registrado (el histórico CSS no lo trae). */
export type GenderSummaryResponse = { hombres: number; mujeres: number; sinDato?: number };

export function getDashboardSummary() {
  return request<DashboardSummaryResponse>('/dashboard/summary');
}
// ── Tipos para los nuevos endpoints del dashboard ────────────────────────────

/** Req 1 — Alumnos por carrera y año: { carrera: string, '2024': number, ... } */
export type CarreraAnioRow = { carrera: string } & Record<string, number | string>;

/** Req 3 (tendencia) */
export type TrendYearRow = { anio: string; estudiantes: number; proyectos: number };

/** Req 4 — Estudiantes por municipio */
export type EstudiantesMunicipioRow = { municipio: string; estudiantes: number };

/** Req 5 — Proyectos por municipio */
export type ProyectosMunicipioRow = { municipio: string; proyectos: number; activos: number };

/** Req 6 + 7 — Métricas / tabla por institución */
export type TablaInstitucionRow = {
  nombreFull:  string;
  nombre:      string;
  tipo:        string;
  ubicacion:   string;
  total:       number;
  activos:     number;
  progreso:    number;
  cerrados:    number;
  estudiantes: number;
  facultades:  number;
};

// ── Llamadas API ─────────────────────────────────────────────────────────────

/** Req 1 — Alumnos en horas sociales por carrera y año */
export function getStudentsByCarreraAndYear() {
  return request<CarreraAnioRow[]>('/dashboard/carrera-anio');
}

/** Req 2 — Género (también disponible en summary.genderSummary) */
export function getGenderSummaryAPI() {
  return request<GenderSummaryResponse>('/dashboard/genero');
}

/** Req 3 — Tendencia anual */
export function getTrendByYear() {
  return request<TrendYearRow[]>('/dashboard/tendencia-anual');
}

/** Req 4 — Estudiantes por municipio */
export function getStudentsByMunicipio() {
  return request<EstudiantesMunicipioRow[]>('/dashboard/estudiantes-municipio');
}

/** Req 5 — Proyectos por municipio */
export function getProjectsByMunicipio() {
  return request<ProyectosMunicipioRow[]>('/dashboard/proyectos-municipio');
}

/** Req 6 — Métricas por institución */
export function getProjectMetricsByInstitution() {
  return request<TablaInstitucionRow[]>('/dashboard/metricas-institucion');
}

/** Req 7 — Tabla detallada por institución */
export function getInstitutionDetailTable() {
  return request<TablaInstitucionRow[]>('/dashboard/tabla-institucion');
}

/** Género por municipio (para marcadores del mapa) */
export type GeneroMunicipioRow = { municipio: string; hombres: number; mujeres: number };

export function getGenderByMunicipio() {
  return request<GeneroMunicipioRow[]>('/students/genero-municipio');
}

export type RegisterPayload = {
  nombre: string;
  apellido: string;
  correo: string;
  password: string;
};

export type LoginPayload = {
  correo: string;
  password: string;
};

export type AuthUser = {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  rol?: string;
};

export function registerUser(payload: RegisterPayload) {
  return request<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload) {
  return request<AuthUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeEnrollment(projectId: string, enrollmentId: string): Promise<void> {
  await request<void>(`/projects/${projectId}/enrollments/${enrollmentId}`, { method: 'DELETE' });
}

export function updateStudentEnrollment(
  projectId: string,
  enrollmentId: string,
  body: {
    nombre: string;
    carnet: string;
    carrera: string;
    genero?: 'Masculino' | 'Femenino' | '';
    email?: string;
  }
): Promise<unknown> {
  return request(`/projects/${projectId}/enrollments/${enrollmentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...body,
      genero: body.genero || null,
      email: body.email || null,
    }),
  });
}

export type UpdateInstitutionPayload = {
  nombre?: string;
  ubicacion?: string;
  descripcion?: string;
  tipo?: string | null;
  image_url?: string | null;
};

export function updateInstitution(institutionId: string | number, payload: UpdateInstitutionPayload) {
  return request<InstitutionDetailResponse>(`/institutions/${institutionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId: string | number): Promise<void> {
  await request<unknown>(`/projects/${projectId}`, { method: 'DELETE' });
}

export type CreateInstitutionPayload = {
  nombre: string;
  sigla: string;
  ubicacion: string;
  tipo?: string;
  descripcion: string;
  image_url?: string | null;
};

export function createInstitution(payload: CreateInstitutionPayload) {
  return request('/institutions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type FacultyResponse = {
  id: number | string;
  nombre: string;
};

export type CareerResponse = {
  id: number | string;
  nombre: string;
  faculty_id: number | string;
};

// Peticiones para Facultades y Carreras
export function getFaculties() {
  return request<FacultyResponse[]>('/faculties');
}

export function getCareers() {
  return request<CareerResponse[]>('/careers');
}
// ─── Importación masiva (POST /imports …) ─────────────────────────────────────
// Contrato del backend: src/modules/imports (horas-sociales-core-backend).

export type ImportBatchEstado = 'PREVISUALIZADO' | 'CONFIRMADO' | 'DESCARTADO';
export type ImportItemEstado = 'NUEVO' | 'IGNORADO' | 'ADVERTENCIA' | 'CONFLICTO';
export type ImportItemEntidad = 'INSTITUCION' | 'PROYECTO' | 'ESTUDIANTE' | 'PARTICIPACION' | 'FILA_PDF' | 'FILA_XLS';
export type ImportItemAccion = 'INSERTAR' | 'COMPLETAR' | 'NINGUNA';

export type ImportConteo = Record<ImportItemEstado, number>;

export type ImportResumen = {
  total: ImportConteo;
  porEntidad: Partial<Record<ImportItemEntidad, ImportConteo>>;
  /** Horas que entrarán con las participaciones nuevas. */
  horasNuevas: number;
};

export type ImportConciliacion = {
  control: string;
  extraido: number;
  reporte: number | null;
  ok: boolean;
};

export type ImportFile = {
  archivo: string;
  estado: 'PROCESADO' | 'RECHAZADO';
  motivo: string | null;
  tipo: 'PDF_DETALLE_HORAS' | 'XLS_MEMORIA_LABORES' | null;
  sha256: string;
  bytes: number;
  paginas: number | null;
  titulo: string | null;
  periodoDesde: string | null;
  periodoHasta: string | null;
  generadoEn: string | null;
  filas: number;
  advertencias: string[];
  conciliacion: ImportConciliacion[];
  lineasNoReconocidas: { archivo: string; ubicacion: string; texto: string; motivo: string }[];
};

export type ImportItem = {
  id: number;
  entidad: ImportItemEntidad;
  clave: string;
  estado: ImportItemEstado;
  accion: ImportItemAccion;
  motivos: string[];
  /** Lo que trae el archivo. */
  datos: Record<string, unknown>;
  /** Lo que ya hay en la base (si existe). */
  existente: Record<string, unknown> | null;
  /** Campo → valor que se llenará (solo campos vacíos). */
  completar: Record<string, unknown> | null;
};

/** Filas escritas por paso al confirmar: { estudiantes_insertados: { n: 1 }, movimientos_de_horas: { n: 1, horas: 600 } } */
export type ImportResultado = Record<string, { n: number; [extra: string]: number }>;

export type ImportBatchSummary = {
  id: string;
  estado: ImportBatchEstado;
  creadoPor: string;
  creadoEn: string;
  expiraEn: string;
  expirado: boolean;
  confirmadoPor: string | null;
  confirmadoEn: string | null;
  resumen: ImportResumen | Record<string, never>;
  resultado: ImportResultado | null;
};

export type ImportBatchListItem = ImportBatchSummary & { archivos: number };

export type ImportBatchDetail = ImportBatchSummary & {
  archivos: ImportFile[];
  items: ImportItem[];
};

/** Sube los archivos (campo "files") y devuelve la vista previa clasificada. No escribe en el maestro. */
export function uploadImport(formData: FormData) {
  return request<ImportBatchDetail>('/imports', { method: 'POST', body: formData });
}

export function getImports(limit = 20) {
  return request<ImportBatchListItem[]>(`/imports?limit=${limit}`);
}

export function getImportDetail(id: string, params: { estado?: ImportItemEstado; entidad?: ImportItemEntidad } = {}) {
  const query = new URLSearchParams();
  if (params.estado) query.set('estado', params.estado);
  if (params.entidad) query.set('entidad', params.entidad);
  const qs = query.toString();
  return request<ImportBatchDetail>(`/imports/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`);
}

export type ConfirmImportResult =
  | { status: 'confirmado'; batch: ImportBatchDetail }
  /** 409 PREVIEW_DESACTUALIZADA: la base cambió desde la vista previa; `batch` es la clasificación nueva. */
  | { status: 'desactualizado'; batch: ImportBatchDetail; message: string };

export async function confirmImport(id: string): Promise<ConfirmImportResult> {
  try {
    const batch = await request<ImportBatchDetail>(`/imports/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
    return { status: 'confirmado', batch };
  } catch (error) {
    const details = error instanceof ApiError ? (error.details as { code?: string; lote?: ImportBatchDetail } | undefined) : undefined;
    if (error instanceof ApiError && error.status === 409 && details?.code === 'PREVIEW_DESACTUALIZADA' && details.lote) {
      return { status: 'desactualizado', batch: details.lote, message: error.message };
    }
    throw error;
  }
}

export function discardImport(id: string) {
  return request<void>(`/imports/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
