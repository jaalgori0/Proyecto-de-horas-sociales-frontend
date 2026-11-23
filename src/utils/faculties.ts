/**
 * Facultades oficiales (mismos nombres que la tabla `faculties` del backend, migración 012)
 * y deducción de facultad a partir de carreras cuando un proyecto no la trae.
 *
 * La facultad de verdad la decide el backend por llaves foráneas (careers.faculty_id).
 * Aquí solo se:
 *  • normaliza cualquier etiqueta recibida (nombre oficial, etiqueta corta del backend
 *    "Comunicaciones y Mercadeo", o etiquetas antiguas) al nombre oficial, y
 *  • deduce la facultad por palabras clave de las carreras cuando no hay otra fuente.
 * Las palabras clave reflejan el reparto del catálogo oficial del backend.
 */
export const FACULTADES_OFICIALES = [
  'Facultad de Ingeniería y Arquitectura',
  'Facultad de Ciencias Sociales y Humanidades',
  'Facultad de Comunicaciones y Mercadeo',
] as const;

export type FacultadOficial = (typeof FACULTADES_OFICIALES)[number];

export const FACULTY_FILTERS = ['Todas las facultades', ...FACULTADES_OFICIALES] as const;

export type FacultyFilter = (typeof FACULTY_FILTERS)[number];

/** Etiqueta para proyectos sin facultad conocida (sin facultad, carreras ni estudiantes). */
export const SIN_FACULTAD = 'Sin facultad';

/**
 * Palabras clave (se comparan sin tildes ni mayúsculas) de las carreras de cada facultad.
 * Catálogo oficial:
 *  - Ingeniería y Arquitectura: Arquitectura, las ingenierías y Licenciatura en Diseño.
 *  - Ciencias Sociales y Humanidades: Ciencias Jurídicas, Psicología, Filosofía, Idioma
 *    Inglés (Lic./Prof.), Teología (Lic./Prof.).
 *  - Comunicaciones y Mercadeo: Comunicación Social, Mercadeo, Marketing Digital,
 *    Administración de Empresas, Contaduría (Pública/Técnico), Economía y Finanzas.
 * Ninguna palabra pertenece a dos facultades: "comunicacion social" no usa "social".
 */
const facultyCareerKeywords: Record<FacultadOficial, string[]> = {
  'Facultad de Ingeniería y Arquitectura': [
    'arquitectura',
    'ingenieria',
    'diseno',
  ],
  'Facultad de Ciencias Sociales y Humanidades': [
    'juridic',
    'derecho',
    'psicologia',
    'filosofia',
    'idioma',
    'ingles',
    'teologia',
    'humanidades',
    'sociologia',
    'educacion',
    'trabajo social',
  ],
  'Facultad de Comunicaciones y Mercadeo': [
    'comunicacion',
    'mercadeo',
    'marketing',
    'publicidad',
    'relaciones publicas',
    'administracion',
    'empresa',
    'contaduria',
    'economia',
    'finanzas',
  ],
};

/** Etiquetas antiguas o abreviadas que aún pueden llegar → nombre oficial. */
const LEGACY_ALIASES: Record<string, FacultadOficial> = {
  'arquitectura e ingenierias': 'Facultad de Ingeniería y Arquitectura',
  'ciencias economicas y empresariales': 'Facultad de Comunicaciones y Mercadeo',
  'facultad de ciencias economicas y empresariales': 'Facultad de Comunicaciones y Mercadeo',
  'comunicacion y mercadeo': 'Facultad de Comunicaciones y Mercadeo',
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Sin el prefijo "Facultad de": así compara el nombre oficial con la etiqueta corta del backend. */
function shortKey(value: string) {
  return normalizeText(value).replace(/^facultad de\s+/, '');
}

function includesNormalized(haystack: string, needle: string) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

/**
 * Cualquier etiqueta de facultad → nombre oficial ("Facultad de …").
 * Acepta el nombre oficial, la etiqueta corta del backend ("Comunicaciones y Mercadeo")
 * y etiquetas antiguas. Si no la reconoce, devuelve el texto recibido (recortado).
 */
export function normalizeFacultyLabel(value?: string | null): string {
  const text = normalizeText(value ?? '');
  if (!text) return '';
  const oficial = FACULTADES_OFICIALES.find((f) => shortKey(f) === shortKey(text));
  if (oficial) return oficial;
  return LEGACY_ALIASES[text] ?? value?.trim() ?? '';
}

/** true si el valor es una de las facultades oficiales. */
export function isOfficialFaculty(value: string): value is FacultadOficial {
  return (FACULTADES_OFICIALES as readonly string[]).includes(value);
}

/** Facultad oficial de UNA carrera por palabras clave (null si ninguna coincide). */
export function facultyOfCareer(career: string): FacultadOficial | null {
  for (const faculty of FACULTADES_OFICIALES) {
    if (facultyCareerKeywords[faculty].some((keyword) => includesNormalized(career, keyword))) return faculty;
  }
  return null;
}

/**
 * Facultad oficial de un proyecto: la que trae (`fallback`, normalizada) o, si no es
 * oficial, la de la primera carrera reconocible. Sin ninguna, SIN_FACULTAD.
 */
export function resolveFacultyFromCareers(careers: string[] = [], fallback?: string | null): string {
  const normalizedFallback = normalizeFacultyLabel(fallback);
  if (isOfficialFaculty(normalizedFallback)) return normalizedFallback;

  for (const career of careers) {
    const faculty = facultyOfCareer(career);
    if (faculty) return faculty;
  }

  // Sin facultad ni carreras reconocibles: no se asigna ninguna facultad por defecto.
  return normalizedFallback || SIN_FACULTAD;
}

export function facultyMatchesProject(
  selectedFaculty: FacultyFilter,
  projectFaculty: string | undefined,
  careers: string[] = [],
) {
  if (selectedFaculty === 'Todas las facultades') return true;

  // Si el proyecto ya trae una facultad oficial (la deriva el backend por llaves
  // foráneas), es la única que cuenta: no se adivina por palabras de las carreras.
  const normalizedProjectFaculty = normalizeFacultyLabel(projectFaculty);
  if (isOfficialFaculty(normalizedProjectFaculty)) return normalizedProjectFaculty === selectedFaculty;

  return careers.some((career) => facultyOfCareer(career) === selectedFaculty);
}
