import type { ProyectoMapa, MarcadorMapa, ProyectoEstudiante, EstadoProyecto } from '../types';

export const proyectosMapa: ProyectoMapa[] = [
  {
    id: 'cerro-verde',
    institucion: 'Universidad de El Salvador',
    titulo: 'Reforestación en Cerro Verde',
    ubicacion: 'Santa Ana, El Salvador',
    estado: 'Activo',
    carreras: ['Biología', 'Ciencias Ambientales', 'Educación'],
    descripcion: 'Equipo ambiental que trabaja con guardaparques y comunidades locales para restaurar flora nativa.',
    equipo: ['Ana García', 'Carlos Méndez', 'Sofía Rodríguez', 'Diego Torres'],
    resumen: 'Proyecto ambiental sostenible centrado en recuperación de especies nativas y trabajo comunitario.',
    personas: 4,
  },
  {
    id: 'alfabetizacion-digital',
    institucion: 'Universidad Centroamericana',
    titulo: 'Alfabetización digital para escuelas rurales',
    ubicacion: 'Chalatenango, El Salvador',
    estado: 'En progreso',
    carreras: ['Educación', 'Informática', 'Sociología'],
    descripcion: 'Talleres de habilidades digitales, acceso a computadoras y navegación segura para niñas, niños y adultos.',
    equipo: ['Valeria Cruz', 'Diego Flores', 'Ana López'],
    resumen: 'Programa práctico para habilidades digitales, acceso a computadoras y hábitos seguros en internet.',
    personas: 6,
  },
  {
    id: 'paneles-solares',
    institucion: 'Universidad Don Bosco',
    titulo: 'Paneles solares para comunidades',
    ubicacion: 'San Miguel, El Salvador',
    estado: 'En planificación',
    carreras: ['Ingeniería', 'Electrónica', 'Gestión'],
    descripcion: 'Implementación de soluciones energéticas pequeñas para centros comunitarios y escuelas.',
    equipo: ['Luis Herrera', 'Karen Álvarez', 'Marta Flores'],
    resumen: 'Despliegue de soluciones de energía renovable a pequeña escala para comunidades y escuelas.',
    personas: 3,
  },
  {
    id: 'emprendimientos-locales',
    institucion: 'Escuela Mónica Herrera',
    titulo: 'Acompañamiento de comercio electrónico',
    ubicacion: 'Santa Tecla, El Salvador',
    estado: 'En progreso',
    carreras: ['Mercadeo', 'Administración', 'Diseño Gráfico'],
    descripcion: 'Acompañamiento a comerciantes para lanzar ventas en línea y fortalecer su presencia digital.',
    equipo: ['Camila Vargas', 'Andrés Morales', 'Luis Méndez'],
    resumen: 'Apoyo a comercios locales para vender por internet y mejorar su presencia digital.',
    personas: 5,
  },
  {
    id: 'salud-mental-comunitaria',
    institucion: 'Universidad Centroamericana',
    titulo: 'Salud mental comunitaria en barrios urbanos',
    ubicacion: 'San Salvador, El Salvador',
    estado: 'Cerrado',
    carreras: ['Psicología', 'Enfermería', 'Sociología'],
    descripcion: 'Brigadas psicosociales y acompañamiento comunitario para familias en zonas urbanas vulnerables.',
    equipo: ['Laura Castillo', 'José Martínez', 'Mariana López', 'Kevin Reyes', 'Elena Pérez'],
    resumen: 'Brigadas psicosociales para acompañar a familias en zonas urbanas con apoyo comunitario.',
    personas: 5,
  },
];

export const marcadoresMapa: MarcadorMapa[] = [
  { label: 'Santa Ana', hombres: 14, mujeres: 18, lat: 13.9940, lng: -89.5597, id: 'cerro-verde', projectId: 'cerro-verde' },
  { label: 'San Salvador', hombres: 45, mujeres: 52, lat: 13.6929, lng: -89.2182, id: 'alfabetizacion-digital', projectId: 'alfabetizacion-digital' },
  { label: 'Chalatenango', hombres: 8, mujeres: 12, lat: 14.0890, lng: -88.9450, id: 'alfabetizacion-digital-2', projectId: 'alfabetizacion-digital' },
  { label: 'Santa Tecla', hombres: 15, mujeres: 19, lat: 13.6761, lng: -89.2965, id: 'emprendimientos-locales', projectId: 'emprendimientos-locales' },
  { label: 'San Miguel', hombres: 22, mujeres: 20, lat: 13.4833, lng: -88.1833, id: 'paneles-solares', projectId: 'paneles-solares' },
  { label: 'Usulután', hombres: 6, mujeres: 9, lat: 13.3500, lng: -88.4500, id: 'paneles-solares-2', projectId: 'paneles-solares' },
];

export const proyectosEstudiantes: ProyectoEstudiante[] = [
  {
    id: 'alfabetizacion-digital',
    titulo: 'Alfabetización digital para comunidades rurales',
    facultad: 'Facultad de Ciencias Sociales y Humanidades',
    ubicacion: 'Chalatenango',
    estudiantes: [
      { nombre: 'Valeria Cruz', cargo: 'Líder del proyecto', carrera: 'Sociología', avatar: 'VC' },
      { nombre: 'Diego Flores', cargo: 'Desarrollador de plataforma', carrera: 'Informática', avatar: 'DF' },
      { nombre: 'Ana López', cargo: 'Diseñadora curricular', carrera: 'Educación', avatar: 'AL' },
    ],
  },
  {
    id: 'vivienda-sostenible',
    titulo: 'Prototipo de vivienda urbana sostenible',
    facultad: 'Facultad de Ingeniería y Arquitectura',
    ubicacion: 'San Salvador',
    estudiantes: [
      { nombre: 'Mateo Rivera', cargo: 'Arquitecto líder', carrera: 'Arquitectura', avatar: 'MR' },
      { nombre: 'Sofía Méndez', cargo: 'Analista estructural', carrera: 'Ingeniería Civil', avatar: 'SM' },
    ],
  },
  {
    id: 'emprendimientos-locales',
    titulo: 'Acompañamiento de comercio electrónico',
    facultad: 'Facultad de Comunicaciones y Mercadeo',
    ubicacion: 'Santa Tecla',
    estudiantes: [
      { nombre: 'Camila Vargas', cargo: 'Estratega de marca', carrera: 'Mercadeo', avatar: 'CV' },
      { nombre: 'Andrés Morales', cargo: 'Asesor financiero', carrera: 'Administración', avatar: 'AM' },
      { nombre: 'Luis Méndez', cargo: 'Creador de contenido', carrera: 'Comunicación', avatar: 'LM' },
    ],
  },
];

export const detalleProyecto = {
  titulo: 'Reforestación en Cerro Verde',
  estado: 'Activo' as EstadoProyecto,
  institucion: 'Universidad de El Salvador',
  ubicacion: 'Santa Ana, El Salvador',
  fechas: 'Ene 2024 - Dic 2024',
  desplegados: '4 estudiantes asignados',
  descripcion:
    'El proyecto de Reforestación en Cerro Verde busca restaurar la flora nativa en zonas degradadas del parque nacional. Los estudiantes trabajan con guardaparques y comunidades para plantar más de 5,000 árboles durante este año, mientras monitorean la salud del suelo y la recuperación de biodiversidad.\n\nLa iniciativa integra ciencia ambiental, vinculación comunitaria y logística sostenible para asegurar la supervivencia de los árboles sembrados.',
  objetivos: ['Plantar 5,000 árboles', 'Educación comunitaria', 'Monitoreo del suelo', 'Levantamiento de biodiversidad'],
  equipo: [
    { nombre: 'Ana García', cargo: 'Líder del proyecto / Botánica', carrera: 'Biología', activo: true },
    { nombre: 'Carlos Méndez', cargo: 'Coordinador logístico', carrera: 'Administración', activo: false },
    { nombre: 'Sofía Rodríguez', cargo: 'Enlace comunitario', carrera: 'Sociología', activo: true },
    { nombre: 'Diego Torres', cargo: 'Analista de datos', carrera: 'Informática', activo: false },
  ],
};

export const clasificacionEstado: Record<EstadoProyecto, string> = {
  Activo: 'active',
  'En planificación': 'planning',
  'En convocatoria': 'recruiting',
  'En progreso': 'recruiting',
  Cerrado: 'closed',
};
