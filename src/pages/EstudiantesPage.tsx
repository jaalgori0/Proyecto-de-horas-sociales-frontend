import { ArrowRight, BookOpen, MapPin, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterGroup, Notice } from '../components/ui';
import { describeApiError, getProjectById, getProjects } from '../services/api';
import { FACULTY_FILTERS, facultyMatchesProject, resolveFacultyFromCareers, type FacultyFilter } from '../utils/faculties';
import { GENERO_FILTERS, grupoGenero, parseGeneroFilter, type GeneroFilter, type GrupoGenero } from '../utils/genero';

// ── tipos ─────────────────────────────────────────────────────────────────────
type StudentCardItem = {
  nombre: string;
  carrera: string;
  carnet: string;
  email: string | null;
  /** Sin género registrado → 'Otros'. */
  genero: GrupoGenero;
};

type StudentDirectoryProject = {
  id: string;
  titulo: string;
  facultad: string;
  institution: string;
  status: string;
  ubicacion: string;
  ubicacionBase: string;
  carreras: string[];
  estudiantes: StudentCardItem[];
  totalEstudiantes: number;
};

// ── estado badge ──────────────────────────────────────────────────────────────
const estadoConfig: Record<string, { color: string; bg: string; dot: string }> = {
  Activo: { color: '#0d6d3e', bg: '#dcfce7', dot: '#16a34a' },
  'En progreso': { color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  Cerrado: { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
};

function normalizeVisibleStatus(estado: string) {
  if (estado === 'Activo') return 'Activo';
  if (estado === 'Cerrado') return 'Cerrado';
  return 'En progreso';
}

function EstadoBadge({ estado }: { estado: string }) {
  const visibleEstado = normalizeVisibleStatus(estado);
  const cfg = estadoConfig[visibleEstado] ?? { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999,
      fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em',
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {estado}
    </span>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
/**
 * Iniciales para el avatar. Tolera null/undefined/vacío y nombres del histórico
 * CSS con puntuación ("APELLIDO1, APELLIDO2 NOMBRES") → "AA". Sin letras → "?".
 */
function getInitials(name: string | null | undefined) {
  const initials = (name ?? '')
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, '').charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || '?';
}

/** Opción del filtro para proyectos sin ubicación registrada (texto vacío o nulo en la BD). */
const SIN_UBICACION = 'Sin ubicación';

/** "Soyapango, San Salvador" → "Soyapango"; vacío o nulo → "Sin ubicación" (nunca una opción en blanco). */
function normalizeLocation(value: string | null | undefined) {
  const base = (value ?? '').split(',')[0]?.trim() ?? '';
  return base || SIN_UBICACION;
}

function normalizeStatus(estado: string) {
  if (estado === 'Activo') return 'Activo';
  if (estado === 'Cerrado') return 'Cerrado';
  return 'En progreso';
}

// ── página ────────────────────────────────────────────────────────────────────
export default function EstudiantesPage() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [facultyFilter, setFacultyFilter] = useState(searchParams.get('faculty') ?? 'Todas las facultades');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'Todos');
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') ?? 'Todas');
  const [generoFilter, setGeneroFilter] = useState<GeneroFilter>(parseGeneroFilter(searchParams.get('genero')));
  const [projects, setProjects] = useState<StudentDirectoryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [failedDetails, setFailedDetails] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDirectory() {
      try {
        setLoading(true);
        setError('');

        const list = await getProjects();
        const detailResults = await Promise.allSettled(
          list.map((p) => getProjectById(p.id))
        );

        if (!active) return;
        setFailedDetails(detailResults.filter((r) => r.status === 'rejected').length);

        const mapped: StudentDirectoryProject[] = list.map((project, index) => {
          const detail = detailResults[index]?.status === 'fulfilled' ? detailResults[index].value : null;
          const detailStudents = detail?.estudiantes ?? [];

          const students: StudentCardItem[] = detailStudents.map((s) => ({
            nombre: s.nombre?.trim() || 'Sin nombre',
            carrera: s.carrera ?? 'Sin carrera',
            carnet: s.carnet ?? '',
            email: s.email ?? null,
            genero: grupoGenero((s as { genero?: string | null }).genero),
          }));

          const fallback: StudentCardItem[] = Array.isArray(project.equipo)
            ? project.equipo.map((name) => ({ nombre: name, carrera: 'Sin carrera', carnet: '', email: null, genero: 'Otros' as const }))
            : [];

          const finalStudents = students.length > 0 ? students : fallback;
          const total = Number(detail?.estudiantesAsignados ?? project.personas ?? finalStudents.length);

          return {
            id: String(project.id),
            titulo: project.titulo,
            facultad: resolveFacultyFromCareers(
              [
                ...(detail?.carreras ?? []),
                ...(Array.isArray(project.equipo) ? project.equipo.map(() => '') : []),
              ].filter(Boolean) as string[],
              project.facultad,
            ),
            institution: detail?.institution ?? project.institution ?? project.facultad ?? 'Institución',
            status: normalizeStatus(detail?.status ?? project.status ?? 'En progreso'),
            ubicacion: project.ubicacion?.trim() ?? '',
            ubicacionBase: normalizeLocation(project.ubicacion),
            carreras: Array.from(new Set([
              ...(detail?.carreras ?? []),
              ...finalStudents.map((s) => s.carrera).filter((c) => c && c !== 'Sin carrera'),
            ])),
            estudiantes: finalStudents,
            totalEstudiantes: Number.isFinite(total) ? total : finalStudents.length,
          };
        });

        setProjects(mapped);
      } catch (err) {
        if (!active) return;
        // Sin datos de respaldo: se muestra el error real y la lista queda vacía.
        setError(describeApiError(err, 'No se pudieron cargar los estudiantes.'));
        setProjects([]);
        setFailedDetails(0);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDirectory();
    return () => { active = false; };
  }, [reloadKey]);

  // Estudiantes distintos (por carnet) entre todos los proyectos cargados. No depende de
  // ningún filtro: es el total general.
  const totalStudents = useMemo(
    () => new Set(projects.flatMap((p) => p.estudiantes.map((s) => s.carnet || s.nombre))).size,
    [projects]
  );

  // Estudiantes distintos por grupo de género (sin género registrado → "Otros").
  const studentsByGenero = useMemo(() => {
    const grupos: Record<GrupoGenero, Set<string>> = { Mujeres: new Set(), Hombres: new Set(), Otros: new Set() };
    for (const p of projects) for (const s of p.estudiantes) grupos[s.genero].add(s.carnet || s.nombre);
    return { Mujeres: grupos.Mujeres.size, Hombres: grupos.Hombres.size, Otros: grupos.Otros.size };
  }, [projects]);

  /** Estudiantes del proyecto que pasan el filtro de género. */
  const visibles = (project: StudentDirectoryProject) =>
    generoFilter === 'Todos' ? project.estudiantes : project.estudiantes.filter((s) => s.genero === generoFilter);

  // Orden alfabético en español; "Sin ubicación" siempre al final.
  const locationOptions = useMemo(() => {
    const bases = new Set(projects.map((p) => p.ubicacionBase));
    const conUbicacion = [...bases].filter((b) => b !== SIN_UBICACION).sort((a, b) => a.localeCompare(b, 'es'));
    return ['Todas', ...conUbicacion, ...(bases.has(SIN_UBICACION) ? [SIN_UBICACION] : [])];
  }, [projects]);

  const statusOptions = useMemo(
    () => ['Todos', 'Activo', 'En progreso', 'Cerrado'],
    []
  );

  const filteredProjects = projects.filter((project) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        project.titulo,
        project.facultad,
        project.institution,
        project.ubicacion,
        ...visibles(project).map((s) => `${s.nombre ?? ''} ${s.carrera ?? ''} ${s.carnet ?? ''}`),
      ].some((v) => v.toLowerCase().includes(query));
    // Con un género elegido, solo quedan los proyectos con al menos un estudiante de ese grupo.
    const matchesGenero = generoFilter === 'Todos' || visibles(project).length > 0;
    const matchesFaculty = facultyMatchesProject(facultyFilter as FacultyFilter, project.facultad, project.carreras);
    const matchesStatus =
      statusFilter === 'Todos' ||
      normalizeStatus(project.status) === statusFilter;
    const sel = locationFilter.trim().toLowerCase();
    const matchesLocation =
      sel === 'todas' ||
      (locationFilter === SIN_UBICACION
        ? project.ubicacionBase === SIN_UBICACION
        : project.ubicacionBase !== SIN_UBICACION &&
          (project.ubicacion.toLowerCase().includes(sel) || project.ubicacionBase.toLowerCase().includes(sel)));
    return matchesQuery && matchesFaculty && matchesStatus && matchesLocation && matchesGenero;
  });

  return (
    <div className="students-page wide-page">
      <header className="page-hero">
        <div className="hero-left">
          <h1 className="main-title">Estudiantes por proyecto</h1>
        </div>
        <div className="hero-right">
          <div className="hero-search-card">
            <div className="search-wrapper">
              <Search size={18} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Estudiante o proyecto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="chip-row">
        {FACULTY_FILTERS.map((chip) => (
          <button
            key={chip}
            className={chip === facultyFilter ? 'chip active' : 'chip'}
            type="button"
            onClick={() => setFacultyFilter(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="content-split students-layout">
        <aside className="filter-rail">
          <FilterGroup
            title="Estado"
            options={statusOptions}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <FilterGroup
            title="Ubicación del proyecto"
            options={locationOptions}
            selected={locationFilter}
            onChange={setLocationFilter}
          />
          <FilterGroup
            title="Género"
            options={[...GENERO_FILTERS]}
            selected={generoFilter}
            onChange={(opt) => setGeneroFilter(parseGeneroFilter(opt))}
          />
        </aside>

        <section className="list-panel project-team-feed">
          {loading ? <p className="muted">Cargando estudiantes...</p> : null}
          {!loading && error ? (
            <Notice title="No se pudieron cargar los estudiantes" onRetry={() => setReloadKey((k) => k + 1)}>
              {error}
            </Notice>
          ) : null}
          {!loading && !error && failedDetails > 0 ? (
            <Notice title="Datos incompletos" onRetry={() => setReloadKey((k) => k + 1)}>
              No se pudo cargar el detalle de {failedDetails} proyecto{failedDetails !== 1 ? 's' : ''}: sus
              estudiantes no aparecen en la lista.
            </Notice>
          ) : null}
          {!loading && !error ? (
            <div className="list-meta">
              <span>
                Mostrando <strong>{filteredProjects.length}</strong> de {projects.length} proyectos ·{' '}
                <strong>{totalStudents}</strong> estudiantes distintos en total
                {generoFilter !== 'Todos' ? (
                  <> · <strong>{studentsByGenero[generoFilter]}</strong> {generoFilter.toLowerCase()}
                    {generoFilter === 'Otros' ? ' (sin género registrado)' : ''}</>
                ) : null}
              </span>
            </div>
          ) : null}
          {!loading && !error && filteredProjects.length === 0 ? (
            <p className="muted">No se encontraron proyectos con esos filtros.</p>
          ) : null}

          {filteredProjects.map((project) => {
            const shown = visibles(project);
            const filtrando = generoFilter !== 'Todos';
            const restantes = (filtrando ? shown.length : project.totalEstudiantes) - 3;
            return (
            <article
              key={project.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 16,
                border: '1px solid #e0e6f0',
                background: 'linear-gradient(160deg, #fbfcff 0%, #ffffff 100%)',
                boxShadow: '0 2px 8px rgba(28,41,71,0.05), 0 4px 18px rgba(28,41,71,0.04)',
                overflow: 'hidden',
              }}
            >
              {/* ── cabecera del proyecto ── */}
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Fila 1: estado + institución + ubicación */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <EstadoBadge estado={project.status} />
                  <span style={{ color: '#2f68ec', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {project.institution}
                  </span>
                  <span style={{ color: '#c5ccd8' }}>•</span>
                  <span style={{ color: '#687182', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={11} />
                    {project.ubicacion || SIN_UBICACION}
                  </span>
                </div>

                {/* Fila 2: título */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.16rem',
                    lineHeight: 1.35,
                    color: '#1c2433',
                    fontWeight: 700,
                    flex: '1 1 auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {project.titulo}
                  </h3>
                </div>

                {/* Fila 3: facultad + carreras */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999,
                    background: '#eef2fb', border: '1px solid #dde3ef',
                    color: '#4a5a7a', fontSize: '1rem', fontWeight: 700,
                  }}>
                    {project.facultad}
                  </span>
                  {project.carreras.length > 0 ? (
                    <>
                      <BookOpen size={12} style={{ color: '#c5ccd8', flexShrink: 0 }} />
                      {project.carreras.map((c) => (
                        <span key={c} style={{
                          padding: '3px 10px', borderRadius: 999,
                          background: '#f0f4ff', border: '1px solid #dde3ef',
                          color: '#4a5a7a', fontSize: '1rem', fontWeight: 600,
                        }}>
                          {c}
                        </span>
                      ))}
                    </>
                  ) : null}
                </div>

              </div>
              {/* ── equipo del proyecto ── */}
              <div style={{ borderTop: '1px solid #edf0f8', padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {filtrando
                    ? `Equipo del proyecto · ${shown.length} de ${project.totalEstudiantes} estudiante${project.totalEstudiantes !== 1 ? 's' : ''} · ${generoFilter}`
                    : `Equipo del proyecto · ${project.totalEstudiantes} estudiante${project.totalEstudiantes !== 1 ? 's' : ''}`}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                    {shown.slice(0, 3).map((student, index) => (
                      <div
                        key={student.carnet || `${student.nombre}-${index}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '10px 12px',
                          borderRadius: 11,
                          background: 'white',
                          border: '1px solid #edf0f8',
                          boxShadow: '0 1px 4px rgba(28,41,71,0.04)',
                          minWidth: 0,
                        }}
                      >
                        {/* iniciales + nombre */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            display: 'grid', placeItems: 'center',
                            background: 'linear-gradient(135deg, #3972f0, #21c08a)',
                            color: 'white', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0,
                          }}>
                            {getInitials(student.nombre)}
                          </div>
                          <h4 style={{
                            margin: 0, fontSize: '0.95rem', color: '#1c2433', fontWeight: 800,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {/^\d{8}$/.test(student.carnet) ? (
                              <Link
                                className="student-profile-link"
                                to={`/estudiantes/${student.carnet}`}
                                title="Ver perfil del estudiante"
                              >
                                {student.nombre}
                              </Link>
                            ) : (
                              student.nombre
                            )}
                          </h4>
                        </div>

                        <div style={{ height: 1, background: '#f0f3fa', marginBottom: 6 }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.84rem', color: '#687182', fontWeight: 600 }}>
                            {student.carrera ?? 'Sin carrera'}
                          </span>
                          {student.carnet ? (
                            <span style={{ fontSize: '0.78rem', color: '#9aa3b5' }}>
                              Carnet: {student.carnet}
                            </span>
                          ) : null}
                          {student.email ? (
                            <span style={{ fontSize: '0.76rem', color: '#9aa3b5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {student.email}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {/* Contador "+ N más" si hay más de 3 estudiantes */}
                    {restantes > 0 ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '10px 12px', borderRadius: 11,
                        background: '#f0f3fa', border: '1px solid #e0e6f0',
                        color: '#687182', fontSize: '0.78rem', fontWeight: 700,
                      }}>
                        +{restantes} más
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 180 }}>
                    <Link
                      to={`/proyectos/${project.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10,
                        background: 'linear-gradient(135deg, #2f68ec, #1d55cc)',
                        color: 'white', fontSize: '0.95rem', fontWeight: 700,
                        boxShadow: '0 6px 16px rgba(47,104,236,0.2)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Ver detalles del proyecto
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
