const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  // Sin VITE_API_URL: backend actual (horas-sociales-core-backend) en el mismo host.
  const hostname = window.location.hostname;
  return `http://${hostname}:3000/api/v1`;
};

export const API_BASE = getApiBase();

// ─── Sesión ──────────────────────────────────────────────────────────────────
// El token de POST /auth/login viaja en `Authorization: Bearer <token>` en cada petición.
// Se guarda aparte del usuario para que `auth_user` siga siendo el mismo objeto de siempre.

const AUTH_USER_KEY = 'auth_user';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_EXPIRES_KEY = 'auth_expires_at';
/** A dónde se envía al usuario cuando su sesión no es válida (mismo destino que "Cerrar sesión"). */
export const LOGIN_PATH = '/login/estudiante';

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Guarda usuario + token tras un login correcto. */
export function saveSession(session: LoginResponse): void {
  const { token, expiresAt, ...user } = session;
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_EXPIRES_KEY, expiresAt);
  } catch {
    /* almacenamiento bloqueado: no se puede recordar la sesión */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRES_KEY);
  } catch {
    /* nada que limpiar */
  }
}

/** Rol del usuario de la sesión (ADMIN | COORDINADOR | CONSULTA), o null. Solo para mostrar/ocultar acciones: el backend decide. */
export function getSessionRole(): string | null {
  try {
    const user = JSON.parse(storageGet(AUTH_USER_KEY) ?? 'null') as { rol?: unknown } | null;
    return typeof user?.rol === 'string' ? user.rol : null;
  } catch {
    return null;
  }
}

/** Token vigente, o null si no hay sesión o ya venció. */
export function getAuthToken(): string | null {
  const token = storageGet(AUTH_TOKEN_KEY);
  if (!token) return null;
  const expiresAt = Date.parse(storageGet(AUTH_EXPIRES_KEY) ?? '');
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    clearSession();
    return null;
  }
  return token;
}

/** Sesión inválida en una ruta protegida: se limpia y se vuelve al login (una sola vez). */
let redirectingToLogin = false;
function handleUnauthorized(): void {
  clearSession();
  if (redirectingToLogin || window.location.pathname.startsWith('/login')) return;
  redirectingToLogin = true;
  window.location.assign(LOGIN_PATH);
}

/** Mensaje legible cuando el error no trae el JSON del backend (p. ej. HTML de nginx o Vercel). */
function friendlyHttpMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Su sesión no es válida o venció. Inicie sesión de nuevo.';
    case 403:
      return 'No tiene permiso para realizar esta operación.';
    case 404:
      return 'No se encontró el recurso solicitado.';
    case 408:
    case 504:
      return 'El servidor tardó demasiado en responder. Si estaba importando, revise el historial antes de reintentar.';
    case 413:
      return 'Los archivos son demasiado grandes para el servidor. Suba menos archivos o archivos más pequeños.';
    case 429:
      return 'Demasiadas peticiones seguidas. Espere un momento e intente de nuevo.';
    case 502:
    case 503:
      return 'El servidor no está disponible en este momento. Intente de nuevo en unos minutos.';
    default:
      return status >= 500 ? `Error del servidor (${status}). Intente de nuevo más tarde.` : `La petición falló (${status}).`;
  }
}

/**
 * Error de la API.
 *  - kind 'network': no hubo respuesta (backend apagado, URL o CORS incorrectos,
 *    conexión caída o timeout; en este último caso `code` es 'TIMEOUT').
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

type RequestOptions = {
  /** Aborta la petición pasado este tiempo (ApiError kind 'network', code 'TIMEOUT'). */
  timeoutMs?: number;
  /** Devuelve la Response tal cual (descargas de archivos) en vez de interpretar JSON. */
  raw?: boolean;
};

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  // Con FormData el navegador fija `multipart/form-data; boundary=…`: forzar JSON rompería la subida.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const token = getAuthToken();
  const controller = options.timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller?.signal ?? init?.signal,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    if (controller?.signal.aborted) {
      throw new ApiError(
        'network',
        `El servidor no respondió en ${Math.round((options.timeoutMs ?? 0) / 1000)} segundos.`,
        { code: 'TIMEOUT' },
      );
    }
    throw new ApiError(
      'network',
      `No se pudo conectar con el servidor (${API_BASE}). Verifique su conexión y que el backend esté en ejecución.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Formato del backend: { error: { code, message, details } }. Si la respuesta no es ese
    // JSON (HTML de un proxy en un 413/502/504, texto vacío…), se usa un mensaje según el código.
    const text = await response.text().catch(() => '');
    let message = friendlyHttpMessage(response.status);
    let code: string | undefined;
    let details: unknown;
    try {
      const json = JSON.parse(text);
      const err = json?.error;
      if (err && typeof err === 'object') {
        message = typeof err.message === 'string' && err.message ? err.message : message;
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
      /* respuesta no JSON: se conserva el mensaje según el código HTTP */
    }
    // 401 en una ruta protegida = sesión vencida o inválida. En /auth/* (login fallido) no se redirige.
    if (response.status === 401 && !path.startsWith('/auth/')) handleUnauthorized();
    throw new ApiError('http', message, { status: response.status, code, details });
  }

  if (options.raw) return response as unknown as T;
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ─── Clasificación de proyectos (no excluyentes) ─────────────────────────────
export const PROJECT_CLASIFICACIONES = ['SS_INTERNO', 'SS_EXTERNO', 'PROFESIONALIZANTE', 'CONTACTO_REALIDAD'] as const;
export type ProjectClasificacion = (typeof PROJECT_CLASIFICACIONES)[number];
export const PROJECT_CLASIFICACION_LABELS: Record<ProjectClasificacion, string> = {
  SS_INTERNO: 'Servicio social interno',
  SS_EXTERNO: 'Servicio social externo',
  PROFESIONALIZANTE: 'Profesionalizante',
  CONTACTO_REALIDAD: 'Contacto con la realidad',
};

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
  /** Al menos una. Las horas se registran como internas si incluye SS_INTERNO. */
  clasificaciones: ProjectClasificacion[];
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
  /** Inscritos que ocupan cupo hoy (ASIGNADA/EN_CURSO). */
  cuposOcupados?: number;
  /** null = el proyecto no define límite de cupos (p. ej. importados del CSS). */
  cuposTotales?: number | null;
  /** Inscritos totales, incluidas participaciones finalizadas. */
  estudiantesAsignados?: number;
  clasificaciones?: ProjectClasificacion[];
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
  /** Departamento resuelto en el backend (clave del marcador), país, texto no reconocido o "Sin ubicación". */
  departamento: string;
  /** Municipio de El Salvador, si se conoce. */
  municipio: string | null;
  /** `departamento` es uno de los 14 departamentos: el proyecto tiene marcador en el mapa. */
  enMapa: boolean;
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
  direccion?: string | null;
  contactoNombre?: string | null;
  contactoEmail?: string | null;
  telefono?: string | null;
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
  sigla?: string | null;
  ubicacion: string;
  direccion?: string | null;
  contactoNombre?: string | null;
  contactoEmail?: string | null;
  telefono?: string | null;
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
  clasificaciones?: ProjectClasificacion[];
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
  clasificaciones?: ProjectClasificacion[];
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
  /** Estudiantes con participación en 2+ proyectos (historial completo). */
  totalStudentsMultiProject?: number;
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
/**
 * Por carrera y año. 'estudiantes' = personas distintas; 'participaciones' =
 * inscripciones (un estudiante en 3 proyectos cuenta 3).
 */
export type CarreraAnioMetrica = 'estudiantes' | 'participaciones';

export function getStudentsByCarreraAndYear(metrica: CarreraAnioMetrica = 'estudiantes') {
  return request<CarreraAnioRow[]>(`/dashboard/carrera-anio?metrica=${metrica}`);
}

/** Req 2 — Género (también disponible en summary.genderSummary) */
/** Sin `facultyId`: todas las facultades. Con él: solo estudiantes de esa facultad (por su carrera). */
export function getGenderSummaryAPI(facultyId?: string | number) {
  const query = facultyId ? `?facultyId=${encodeURIComponent(String(facultyId))}` : '';
  return request<GenderSummaryResponse>(`/dashboard/genero${query}`);
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

/** Estudiante con 2+ proyectos (historial completo, sin el proyecto de sistema). */
export type EstudianteMultiProyectoRow = {
  studentId: string;
  nombre: string;
  carnet: string;
  carrera: string;
  /** Proyectos distintos en los que participa o participó. */
  proyectos: number;
  /** De ellos, con participación activa hoy. */
  activos: number;
  titulos: string[];
};

export function getStudentsInMultipleProjects() {
  return request<EstudianteMultiProyectoRow[]>('/dashboard/estudiantes-multiproyecto');
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

/** Respuesta de POST /auth/login: el usuario más el token de sesión. Guárdela con saveSession(). */
export type LoginResponse = AuthUser & {
  token: string;
  /** ISO 8601. */
  expiresAt: string;
};

export function loginUser(payload: LoginPayload) {
  return request<LoginResponse>('/auth/login', {
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

export type InstitutionContactPayload = {
  contactoNombre?: string | null;
  contactoEmail?: string | null;
  telefono?: string | null;
};

export type UpdateInstitutionPayload = InstitutionContactPayload & {
  nombre?: string;
  ubicacion?: string;
  direccion?: string | null;
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

export type CreateInstitutionPayload = InstitutionContactPayload & {
  nombre: string;
  sigla?: string;
  ubicacion: string;
  direccion?: string;
  tipo?: string;
  descripcion: string;
  image_url?: string | null;
};

export function createInstitution(payload: CreateInstitutionPayload) {
  return request<InstitutionDetailResponse>('/institutions', {
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
  /** XLSX_PLANTILLA_REVISION: Excel generado desde los PDF (ver downloadReviewTemplate) y corregido a mano. */
  tipo: 'PDF_DETALLE_HORAS' | 'XLS_MEMORIA_LABORES' | 'XLSX_PLANTILLA_REVISION' | null;
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

export type ReviewTemplateDownload = {
  blob: Blob;
  filename: string;
  /** Participaciones extraídas de los PDF. */
  filas: number;
  /** Filas marcadas «Revisar» en la plantilla: cortadas entre páginas o con celdas separadas por posición. */
  filasConAdvertencias: number;
  lineasNoReconocidas: number;
};

/**
 * PDF «Detalle de Horas por Proyecto» (campo "files") → plantilla Excel para revisar y
 * corregir antes de importar. No escribe nada en la base. La plantilla corregida se sube
 * luego con uploadImport como cualquier otro archivo.
 */
export async function downloadReviewTemplate(formData: FormData): Promise<ReviewTemplateDownload> {
  const response = await request<Response>('/imports/review-template', { method: 'POST', body: formData }, { raw: true });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1] ?? match[2]!) : 'plantilla-revision.xlsx';
  const header = (name: string) => Number(response.headers.get(name) ?? 0) || 0;
  return {
    blob: await response.blob(),
    filename,
    filas: header('X-Plantilla-Filas'),
    filasConAdvertencias: header('X-Plantilla-Filas-Con-Advertencias'),
    lineasNoReconocidas: header('X-Plantilla-Lineas-No-Reconocidas'),
  };
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

/** Tiempo máximo de espera de la confirmación (un lote grande puede tardar). */
export const CONFIRM_TIMEOUT_MS = 60_000;

export type ConfirmImportResult =
  /** `recuperado`: se perdió la respuesta, pero al consultar el lote ya estaba confirmado. */
  | { status: 'confirmado'; batch: ImportBatchDetail; recuperado?: boolean }
  /** 409 PREVIEW_DESACTUALIZADA: la base cambió desde la vista previa; `batch` es la clasificación nueva. */
  | { status: 'desactualizado'; batch: ImportBatchDetail; message: string }
  /** Se perdió la respuesta y el lote todavía no figura como confirmado (puede seguir procesándose). */
  | { status: 'sin_respuesta'; batch: ImportBatchDetail; message: string };

export async function confirmImport(id: string): Promise<ConfirmImportResult> {
  try {
    const batch = await request<ImportBatchDetail>(
      `/imports/${encodeURIComponent(id)}/confirm`,
      { method: 'POST' },
      { timeoutMs: CONFIRM_TIMEOUT_MS },
    );
    return { status: 'confirmado', batch };
  } catch (error) {
    const details = error instanceof ApiError ? (error.details as { code?: string; lote?: ImportBatchDetail } | undefined) : undefined;
    if (error instanceof ApiError && error.status === 409 && details?.code === 'PREVIEW_DESACTUALIZADA' && details.lote) {
      return { status: 'desactualizado', batch: details.lote, message: error.message };
    }
    if (error instanceof ApiError && error.kind === 'network') {
      // La conexión se cortó o venció el timeout: el servidor pudo haber confirmado igual.
      // Se pregunta el estado real del lote en vez de adivinar.
      let batch: ImportBatchDetail;
      try {
        batch = await getImportDetail(id);
      } catch {
        throw new ApiError(
          'network',
          `${error.message} No se pudo verificar si el lote alcanzó a confirmarse: revise el historial antes de reintentar.`,
          { code: error.code },
        );
      }
      if (batch.estado === 'CONFIRMADO') return { status: 'confirmado', batch, recuperado: true };
      return {
        status: 'sin_respuesta',
        batch,
        message:
          `${error.message} El lote todavía figura como no confirmado; es posible que el servidor siga ` +
          'procesándolo. Espere un momento y actualice el historial antes de volver a confirmar.',
      };
    }
    throw error;
  }
}

export function discardImport(id: string) {
  return request<void>(`/imports/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Perfil del estudiante y horas manuales ──────────────────────────────────
// Rutas con sesión (requireAuth). POST /hour-movements exige rol ADMIN o COORDINADOR.

export type HourOrigin = 'IMPORTACION' | 'MANUAL';
export type HourNaturaleza = 'INTERNA' | 'EXTERNA';
export type EnrollmentEstado = 'ASIGNADA' | 'EN_CURSO' | 'FINALIZADA' | 'RETIRADA' | 'CANCELADA';

export type StudentHourMovement = {
  id: string;
  enrollmentId: string;
  projectId: string;
  proyecto: string;
  institucion: string;
  horas: number;
  naturaleza: HourNaturaleza;
  origen: HourOrigin;
  /** YYYY-MM-DD */
  fecha: string;
  concepto: string | null;
  descripcion: string | null;
  registradoPor: { id: string; nombre: string } | null;
  registradoEn: string;
};

export type StudentProgress = {
  requisito: number;
  horasTotales: number;
  horasInternas: number;
  horasExternas: number;
  horasImportadas: number;
  horasManuales: number;
  /** 0–100 truncado; 100 solo con el requisito cumplido. */
  porcentaje: number;
  completado: boolean;
  horasRestantes: number;
  horasExtra: number;
};

export type StudentParticipation = {
  enrollmentId: string;
  cargo: string;
  estado: EnrollmentEstado;
  asignadaEn: string;
  cerradaEn: string | null;
  horas: number;
  horasImportadas: number;
  horasManuales: number;
  proyecto: {
    id: string;
    titulo: string;
    naturaleza: HourNaturaleza;
    estado: 'Activo' | 'En progreso' | 'Cerrado';
    fechaInicio: string | null;
    fechaCierre: string | null;
    esSistema: boolean;
  };
  institucion: { id: string; nombre: string; sigla: string | null };
  movimientos: StudentHourMovement[];
};

export type StudentProfile = {
  student: {
    id: string;
    carnet: string;
    nombre: string;
    nombres: string | null;
    apellidos: string | null;
    correoInstitucional: string;
    emailPersonal: string | null;
    telefono: string | null;
    genero: 'Masculino' | 'Femenino' | null;
    avatarUrl: string | null;
    activo: boolean;
    carrera: { id: string; nombre: string };
    facultad: { id: string; nombre: string } | null;
  };
  progreso: StudentProgress;
  participaciones: StudentParticipation[];
};

export type ManualHoursPayload = {
  projectId: string;
  horas: number;
  /** Si se omite, se usa la naturaleza del proyecto. */
  naturaleza?: HourNaturaleza;
  /** YYYY-MM-DD, no futura. */
  fechaHoras: string;
  concepto: string;
};

export type ManualHoursResult = {
  profile: StudentProfile;
  movementId: string;
  /** true: la misma Idempotency-Key ya se había procesado (no se duplicó). */
  replayed: boolean;
};

export async function getStudentIdByCarnet(carnet: string): Promise<string> {
  const res = await request<{ data: { id: string; carnet: string } }>(
    `/students/by-carnet/${encodeURIComponent(carnet)}`,
  );
  return res.data.id;
}

export async function getStudentProfile(studentId: string): Promise<StudentProfile> {
  const res = await request<{ data: StudentProfile }>(`/students/${encodeURIComponent(studentId)}/profile`);
  return res.data;
}

/**
 * Asigna horas manualmente. `idempotencyKey` debe ser el mismo en los reintentos
 * de un mismo envío: el backend no duplica el movimiento.
 */
export async function addManualHours(
  studentId: string,
  payload: ManualHoursPayload,
  idempotencyKey: string,
): Promise<ManualHoursResult> {
  const res = await request<{ data: StudentProfile; meta: { movementId: string; replayed: boolean } }>(
    `/students/${encodeURIComponent(studentId)}/hour-movements`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Idempotency-Key': idempotencyKey },
    },
    { timeoutMs: 20_000 },
  );
  return { profile: res.data, movementId: res.meta.movementId, replayed: res.meta.replayed };
}

/** Revoca un movimiento MANUAL (403 si es importado del CSS). Devuelve el perfil actualizado. */
export async function deleteManualHours(
  studentId: string,
  movementId: string,
): Promise<{ profile: StudentProfile; deletedEnrollment: boolean }> {
  const res = await request<{ data: StudentProfile; meta: { movementId: string; deletedEnrollment: boolean } }>(
    `/students/${encodeURIComponent(studentId)}/hour-movements/${encodeURIComponent(movementId)}`,
    { method: 'DELETE' },
    { timeoutMs: 20_000 },
  );
  return { profile: res.data, deletedEnrollment: res.meta.deletedEnrollment };
}
