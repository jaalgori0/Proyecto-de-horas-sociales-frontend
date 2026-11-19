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
  imagen?: string;
  descripcion: string;
  equipo: string[];
  /** Códigos de clasificación (SS_INTERNO, SS_EXTERNO, PROFESIONALIZANTE, CONTACTO_REALIDAD). */
  clasificaciones?: string[];
};

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
