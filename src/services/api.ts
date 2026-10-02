const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    // Intentar parsear el JSON de error del backend; si falla, usar el texto plano
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.error ?? json.message ?? text);
    } catch {
      throw new Error(text || `Error ${response.status}`);
    }
  }

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
  genderSummary: { hombres: number; mujeres: number };
};

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
  return request<{ hombres: number; mujeres: number }>('/dashboard/genero');
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
  const res = await fetch(`${API_BASE}/projects/${projectId}/enrollments/${enrollmentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.message ?? 'No se pudo eliminar la inscripción');
  }
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
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.message ?? 'No se pudo eliminar el proyecto');
  }
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