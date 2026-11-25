export type EstadoProyecto = 'Activo' | 'En progreso' | 'En planificación' | 'En convocatoria' | 'Cerrado';

export type Proyecto = {
  id: string;
  institucion: string;
  institucionNombre?: string;
  titulo: string;
  ubicacion: string;
  estado: EstadoProyecto;
  status?: 'Activo' | 'En progreso' | 'Cerrado';
  facultad?: string;
  carreras: string[];
  fechaLimite?: string;
  cupos?: string;
  cuposOcupados?: number;
  cuposTotales?: number | null;
  cuposTexto?: string;
  /** Estudiantes inscritos (ASIGNADA/EN_CURSO/FINALIZADA), calculado por el backend. */
  estudiantesAsignados?: number;
  hombres?: number;
  mujeres?: number;
  imagen?: string;
  descripcion: string;
  equipo: string[];
  /** Códigos de clasificación (SS_INTERNO, SS_EXTERNO, PROFESIONALIZANTE, CONTACTO_REALIDAD). */
  clasificaciones?: string[];
  /** De dónde viene el proyecto (ver origenProyecto). Solo informa: nunca oculta el proyecto. */
  origen?: OrigenProyecto;
};

/**
 * Origen de un proyecto respecto al reporte oficial del CSS («Memoria de Labores»):
 *  - REPORTE_CSS: viene en el Excel CSS (en_reporte_css).
 *  - SOLO_PDF: tiene correlativo del CSS pero solo aparece en los reportes de horas (PDF).
 *  - APP: creado en la app (sin correlativo del CSS).
 *  - INTERNO: proyecto de sistema (asignaciones manuales / convalidaciones).
 */
export type OrigenProyecto = 'REPORTE_CSS' | 'SOLO_PDF' | 'APP' | 'INTERNO';

export const ORIGEN_PROYECTO_LABELS: Record<OrigenProyecto, string> = {
  REPORTE_CSS: 'Reporte CSS',
  SOLO_PDF: 'Solo en PDF',
  APP: 'Creado en la app',
  INTERNO: 'Interno',
};

export function origenProyecto(p: { enReporteCss?: boolean; esSistema?: boolean; correlativoCss?: string | null }): OrigenProyecto | undefined {
  if (p.enReporteCss === undefined && p.esSistema === undefined) return undefined; // backend anterior
  if (p.esSistema) return 'INTERNO';
  if (p.enReporteCss) return 'REPORTE_CSS';
  return p.correlativoCss ? 'SOLO_PDF' : 'APP';
}

export type Institucion = {
  id: string;
  nombre: string;
  sigla: string;
  ubicacion: string;
  direccion?: string;
  contactoNombre?: string;
  contactoEmail?: string;
  telefono?: string;
  tipo?: string;
  image?: string;
  descripcion: string;
  estadisticas: [string, string][];
  proyectos: Proyecto[];
};

export type Estudiante = {
  nombre: string;
  cargo?: string;
  carrera: string;
  avatar: string;
  carnet?: string;   
  email?: string;    
};

export type ProyectoMapa = Proyecto & {
  resumen: string;
  personas: number;
  hombres?: number;
  mujeres?: number;
  /** Lugar del proyecto en el mapa (ver ProjectMapResponse). */
  departamento?: string;
  municipio?: string | null;
  enMapa?: boolean;
};

export type MarcadorMapa = {
  id: string;
  projectId: string | null;
  label: string;
  hombres: number;
  mujeres: number;
  lat: number;
  lng: number;
};

export type ProyectoEstudiante = {
  id: string;
  titulo: string;
  facultad: string;
  ubicacion: string;
  estudiantes: Estudiante[];
};

export type MiembroEquipo = {
  nombre: string;
  cargo: string;
  carrera: string;
  activo: boolean;
};
