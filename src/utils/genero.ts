/**
 * Filtro de género de los listados (Estudiantes por proyecto, Proyectos).
 *
 * El backend devuelve 'Masculino' | 'Femenino' | null. Todo lo que no sea uno de esos dos
 * (null, vacío o cualquier otro valor) se agrupa como "Otros": así un estudiante sin
 * género registrado nunca desaparece de los listados filtrados.
 */
export const GENERO_FILTERS = ['Todos', 'Mujeres', 'Hombres', 'Otros'] as const;

export type GeneroFilter = (typeof GENERO_FILTERS)[number];
export type GrupoGenero = Exclude<GeneroFilter, 'Todos'>;

export function grupoGenero(genero?: string | null): GrupoGenero {
  const t = (genero ?? '').trim().toLowerCase();
  if (t === 'femenino' || t === 'mujer') return 'Mujeres';
  if (t === 'masculino' || t === 'hombre') return 'Hombres';
  return 'Otros';
}

export function parseGeneroFilter(value: string | null | undefined): GeneroFilter {
  return (GENERO_FILTERS as readonly string[]).includes(value ?? '') ? (value as GeneroFilter) : 'Todos';
}

/**
 * Proyectos (solo traen conteos): participaciones por grupo de género. "Otros" = las que
 * no son de hombres ni de mujeres (estudiantes sin género registrado).
 */
export function conteoGeneroProyecto(p: { estudiantesAsignados?: number; hombres?: number; mujeres?: number }): Record<GrupoGenero, number> {
  const hombres = p.hombres ?? 0;
  const mujeres = p.mujeres ?? 0;
  return { Hombres: hombres, Mujeres: mujeres, Otros: Math.max((p.estudiantesAsignados ?? 0) - hombres - mujeres, 0) };
}
