export const FACULTY_FILTERS = [
  'Todas las facultades',
  'Ingeniería y Arquitectura',
  'Ciencias Sociales y Humanidades',
  'Ciencias Económicas y Empresariales',
] as const;

export type FacultyFilter = (typeof FACULTY_FILTERS)[number];

const facultyCareerMap: Record<Exclude<FacultyFilter, 'Todas las facultades'>, string[]> = {
  'Ingeniería y Arquitectura': [
    'arquitectura',
    'ingenieria',
    'ingeniería',
    'electronica',
    'electrónica',
    'civil',
    'ambiental',
    'sistemas',
    'mecanica',
    'mecánica',
    'industrial',
    'construccion',
    'construcción',
  ],
  'Ciencias Sociales y Humanidades': [
    'sociologia',
    'sociología',
    'historia',
    'psicologia',
    'psicología',
    'educacion',
    'educación',
    'trabajo social',
    'trabajos sociales',
    'humanidades',
    'filosofia',
    'filosofía',
  ],
  'Ciencias Económicas y Empresariales': [
    'comunicacion',
    'comunicación',
    'mercadeo',
    'marketing',
    'publicidad',
    'diseno',
    'diseño',
    'administracion',
    'administración',
    'relaciones publicas',
    'relaciones públicas',
  ],
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function includesNormalized(haystack: string, needle: string) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

export function normalizeFacultyLabel(value?: string | null) {
  const text = normalizeText(value ?? '');
  if (!text) return '';

  const fixed = FACULTY_FILTERS.find((faculty) => normalizeText(faculty) === text);
  if (fixed) return fixed;

  if (text.includes('ingenier') || text.includes('arquitect')) return 'Arquitectura e Ingenierías';
  if (text.includes('sociolog') || text.includes('psicolog') || text.includes('educ')) return 'Ciencias Sociales y Humanidades';
  if (text.includes('mercade') || text.includes('comunic') || text.includes('administr') || text.includes('disen')) return 'Comunicación y Mercadeo';

  return value?.trim() ?? '';
}

/** Etiqueta para proyectos sin facultad conocida (sin facultad, carreras ni estudiantes). */
export const SIN_FACULTAD = 'Sin facultad';

/** true si el valor es una de las facultades oficiales de FACULTY_FILTERS. */
function isOfficialFaculty(value: string): value is Exclude<FacultyFilter, 'Todas las facultades'> {
  return value !== 'Todas las facultades' && FACULTY_FILTERS.includes(value as FacultyFilter);
}

export function resolveFacultyFromCareers(careers: string[] = [], fallback?: string | null) {
  const normalizedFallback = normalizeFacultyLabel(fallback);
  if (isOfficialFaculty(normalizedFallback)) {
    return normalizedFallback;
  }

  for (const faculty of FACULTY_FILTERS.slice(1) as Exclude<FacultyFilter, 'Todas las facultades'>[]) {
    const keywords = facultyCareerMap[faculty];
    if (careers.some((career) => keywords.some((keyword) => includesNormalized(career, keyword)))) {
      return faculty;
    }
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

  const normalizedSelected = normalizeText(selectedFaculty);
  const normalizedProjectFaculty = normalizeText(projectFaculty ?? '');
  if (normalizedSelected && normalizedSelected === normalizedProjectFaculty) return true;

  // Si el proyecto ya trae una facultad oficial (la deriva el backend por llaves
  // foráneas), es la única que cuenta: no se adivina por palabras de las carreras.
  if (isOfficialFaculty(normalizeFacultyLabel(projectFaculty))) return false;

  const resolvedFaculty = resolveFacultyFromCareers(careers, projectFaculty);
  if (normalizeText(resolvedFaculty) === normalizedSelected) return true;

  const keywords = facultyCareerMap[selectedFaculty as Exclude<FacultyFilter, 'Todas las facultades'>] ?? [];
  return careers.some((career) => keywords.some((keyword) => includesNormalized(career, keyword)));
}
