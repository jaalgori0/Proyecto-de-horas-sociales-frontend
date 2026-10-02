import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  MapPin,
  Plus,
  Search,
  Users,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import InscribirEstudianteModal from '../components/InscribirEstudianteModal';
import CreateProjectModal from '../components/CreateProjectModal';
import EditProjectModal from '../components/EditProjectModal/index';
import { FACULTY_FILTERS, facultyMatchesProject, resolveFacultyFromCareers, type FacultyFilter } from '../utils/faculties';
import { ProjectListCard } from '../components/ProjectCards';
import { BackLink, FilterGroup } from '../components/ui';
import { instituciones } from '../data/instituciones';
import {
  getProjectById,
  getProjects,
  updateProject,
  deleteProject,  
  type ProjectDetailResponse,
  type ProjectListResponse,
} from '../services/api';
import type { Proyecto } from '../types';

function resolveProjectImage(project: any) {
  return project?.imagen ?? project?.image ?? project?.imageUrl ?? project?.projectImage ?? null;
}

type VisibleProjectStatus = 'Activo' | 'En progreso' | 'Cerrado';

function toVisibleStatus(status?: string | null, estado?: string | null): VisibleProjectStatus {
  if (status === 'Cerrado' || estado === 'Cerrado') return 'Cerrado';
  if (status === 'Activo' || estado === 'Activo') return 'Activo';
  return 'En progreso';
}

function mapLocalProjectToDetail(project: Proyecto): ProjectDetailResponse {
  const institution = instituciones.find((item) => item.nombre === project.institucion || item.sigla === project.institucion);
  const fallbackImage = institution?.image ?? null;

  return {
    id: project.id,
    nombre: project.titulo,
    titulo: project.titulo,
    imagen: project.imagen ?? fallbackImage,
    status: toVisibleStatus(project.status ?? null, project.estado),
    estado: project.estado,
    institution: project.institucion,
    ubicacion: project.ubicacion,
    descripcion: project.descripcion,
    resumen: project.descripcion,
    equipo: project.equipo ?? [],
    estudiantes: [],
    estudiantesAsignados: project.equipo?.length ?? 0,
    cuposTexto: project.cuposTexto ?? undefined,
    cuposOcupados: project.cuposOcupados ?? project.equipo.length,
    cuposTotales: project.cuposTotales ?? null,
    carreras: project.carreras ?? [],
    facultad: project.facultad ?? resolveFacultyFromCareers(project.carreras ?? [], null),
    fechaInicio: null,
    fechaCierre: null,
    hombres: undefined,
    mujeres: undefined,
    desplegados: null,
  };
}

function mapDetailToProyecto(detail: any): Proyecto {
  return {
    id: String(detail.id),
    institucion: detail.institution ?? detail.institutionName ?? 'Institución',
    titulo: detail.titulo ?? detail.nombre ?? '',
    ubicacion: detail.ubicacion ?? '',
    estado: toVisibleStatus(detail.status, detail.estado),
    imagen: (detail as any).imagen ?? (detail as any).image ?? null,
    facultad: detail.facultad ?? resolveFacultyFromCareers(detail.carreras ?? [], null),
    carreras: detail.carreras ?? [],
    descripcion: detail.descripcion ?? detail.resumen ?? '',
    equipo: detail.equipo ?? [],
    cuposTexto: detail.cuposTexto ?? undefined,
    cuposOcupados: detail.cuposOcupados ?? detail.estudiantesAsignados ?? (detail.estudiantes ? detail.estudiantes.length : undefined),
    cuposTotales: detail.cuposTotales ?? null,
  } as Proyecto;
}

function findLocalProjectDetail(projectId: string) {
  for (const institution of instituciones) {
    const project = institution.proyectos.find((item) => String(item.id) === String(projectId));
    if (project) {
      return mapLocalProjectToDetail(project);
    }
  }
  return null;
}

// ─── ProyectosPage ────────────────────────────────────────────────────────────
export function ProyectosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modalNuevo = searchParams.get('nuevo') === '1';
  const [projectToEnroll, setProjectToEnroll] = useState<Proyecto | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState('Todas las facultades');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [selectedLocation, setSelectedLocation] = useState('Todas');
  const [sortBy] = useState<'recentes' | 'titulo' | 'ubicacion'>('recentes');
  const [projectsData, setProjectsData] = useState<Proyecto[]>(
    instituciones.flatMap((institution) => institution.proyectos)
  );
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState<string | null>(null); // ← NUEVO
  const [error, setError] = useState('');

  const mapStatus = (status?: string, estado?: string): Proyecto['estado'] => {
    if (estado === 'En planificación') return 'En progreso';
    if (status === 'Cerrado' || estado === 'Cerrado') return 'Cerrado';
    if (status === 'Activo' || estado === 'Activo') return 'Activo';
    return 'En progreso';
  };

  const mapProject = (project: ProjectListResponse): Proyecto => ({
    id: String(project.id),
    institucion: project.institution ?? 'Institución',
    titulo: project.titulo,
    ubicacion: project.ubicacion,
    estado: mapStatus(project.status, project.estado),
    imagen: (project as any).imagen ?? (project as any).image ?? (project as any).imageUrl ?? null,
    facultad: resolveFacultyFromCareers(project.carreras ?? [], (project as any).facultad ?? null),
    carreras: project.carreras ?? [],
    descripcion: project.descripcion ?? '',
    equipo: project.equipo ?? [],
    cuposTexto: project.cuposTexto,
    cuposOcupados: project.cuposOcupados,
    cuposTotales: project.cuposTotales,
  });

  async function fetchProjects() {
    try {
      setLoading(true);
      setError('');
      const apiProjects = await getProjects();
      setProjectsData(apiProjects.map(mapProject));
    } catch {
      setError('No se pudo conectar con el backend. Mostrando datos de respaldo.');
      setProjectsData(instituciones.flatMap((institution) => institution.proyectos));
    } finally {
      setLoading(false);
    }
  }

  async function fetchProjectById(projectId: string) {
    try {
      const detail = await getProjectById(projectId);
      const mapped: Proyecto = {
        id: String(detail.id),
        institucion: detail.institution ?? 'Institución',
        titulo: detail.titulo ?? detail.nombre ?? '',
        ubicacion: detail.ubicacion ?? '',
        estado: toVisibleStatus(detail.status, detail.estado),
        imagen: (detail as any).imagen ?? (detail as any).image ?? null,
        carreras: detail.carreras ?? [],
        descripcion: detail.descripcion ?? detail.resumen ?? '',
        equipo: detail.equipo ?? [],
        cuposTexto: detail.cuposTexto ?? undefined,
        cuposOcupados: detail.cuposOcupados ?? undefined,
        cuposTotales: detail.cuposTotales ?? null,
      };
      setProjectsData((prev) => prev.map((p) => (String(p.id) === String(projectId) ? mapped : p)));
    } catch {
      void fetchProjects();
    }
  }

  // ← NUEVO
  function showToast(msg: string) {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  }

  useEffect(() => {
    void fetchProjects();
  }, []);

  const statusOptions = ['Todos', 'Activo', 'En progreso', 'Cerrado'];

  const locationOptions = [
    'Todas',
    ...Array.from(new Set(projectsData.map((p) => p.ubicacion.split(',')[0] ?? p.ubicacion)))
      .filter(Boolean)
      .sort(),
  ];

  const filteredProjects = projectsData
    .filter((project) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery = !query || project.titulo.toLowerCase().includes(query);
      const matchesFaculty = facultyMatchesProject(selectedFaculty as FacultyFilter, project.facultad, project.carreras);
      const projectVisibleStatus =
        project.estado === 'Cerrado' ? 'Cerrado' : project.estado === 'Activo' ? 'Activo' : 'En progreso';
      const matchesStatus = selectedStatus === 'Todos' || projectVisibleStatus === selectedStatus;
      const matchesLocation =
        selectedLocation === 'Todas' ||
        project.ubicacion.toLowerCase().includes(selectedLocation.toLowerCase());
      return matchesQuery && matchesFaculty && matchesStatus && matchesLocation;
    })
    .sort((a, b) => {
      if (sortBy === 'titulo') return a.titulo.localeCompare(b.titulo);
      if (sortBy === 'ubicacion') return a.ubicacion.localeCompare(b.ubicacion);
      return b.id.localeCompare(a.id);
    });

  return (
    <div className={`directory-page wide-page ${modalNuevo ? 'modal-open' : ''}`}>
      <header className="page-hero">
        <div className="hero-left">
          <h1 className="main-title">Proyectos según carrera</h1>
        </div>
        <div className="hero-right">
          <div className="hero-search-card">
            <div className="search-wrapper">
              <Search size={18} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Buscar proyecto por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <button className="primary-btn" type="button" onClick={() => setSearchParams({ nuevo: '1' })}>
            <Plus size={18} />
            <span>Crear nuevo proyecto</span>
          </button>
        </div>
      </header>

      <div className="chip-row">
        {FACULTY_FILTERS.map((chip) => (
          <button
            key={chip}
            className={chip === selectedFaculty ? 'chip active' : 'chip'}
            type="button"
            onClick={() => setSelectedFaculty(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="content-split">
        <aside className="filter-rail">
          <FilterGroup title="Estado" options={statusOptions} selected={selectedStatus} onChange={setSelectedStatus} />
          <FilterGroup title="Ubicación" options={locationOptions} selected={selectedLocation} onChange={setSelectedLocation} />
        </aside>

        <section className="list-panel">
          {loading ? <p className="muted">Cargando proyectos...</p> : null}
          {!loading && error ? <p className="muted">{error}</p> : null}

          <div className="list-meta">
            <span>
              Mostrando <strong>{filteredProjects.length}</strong> proyectos
            </span>
          </div>

          <div className="project-feed">
            {filteredProjects.map((project) => (
              <ProjectListCard
                key={project.id}
                project={project}
                onEnroll={(selectedProject) => setProjectToEnroll(selectedProject)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* ← ACTUALIZADO: onSaved refresca la lista y muestra toast */}
      {modalNuevo ? (
        <CreateProjectModal
          onClose={() => setSearchParams({})}
          onSaved={() => {
            setSearchParams({});
            void fetchProjects();
            showToast('✓ Proyecto creado correctamente');
          }}
        />
      ) : null}

      {projectToEnroll ? (
        <InscribirEstudianteModal
          projectId={projectToEnroll.id}
          projectTitle={projectToEnroll.titulo}
          carrerasPermitidas={projectToEnroll.carreras} // <-- Aquí usamos la propiedad oficial 'carreras' de tu tipo Proyecto
          onClose={() => setProjectToEnroll(null)}
          onEnrolled={(updated) => {
            if (updated) {
              try {
                const mapped = mapDetailToProyecto(updated);
                setProjectsData((prev) => prev.map((p) => (String(p.id) === String(mapped.id) ? mapped : p)));
              } catch {
                void fetchProjectById(projectToEnroll.id);
              }
            } else {
              void fetchProjectById(projectToEnroll.id);
            }
          }}
        />
      ) : null}

      {/* ← NUEVO: Toast de éxito flotante */}
      {successToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: '#276749', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '0.9rem', zIndex: 9999,
        }}>
          {successToast}
        </div>
      )}
    </div>
  );
}

// ─── ProyectoDetallePage ──────────────────────────────────────────────────────
const estadoConfig: Record<string, { color: string; bg: string; dot: string }> = {
  Activo: { color: '#0d6d3e', bg: '#dcfce7', dot: '#16a34a' },
  'En progreso': { color: '#1d4ed8', bg: '#dbeafe', dot: '#3b82f6' },
  Cerrado: { color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
};

function StatCard({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 12,
        background: accent ? 'linear-gradient(135deg, #2f68ec, #1d55cc)' : '#f8faff',
        border: accent ? 'none' : '1px solid #e5eaf5',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: accent ? 'rgba(255,255,255,0.15)' : '#eef2fb',
          display: 'grid',
          placeItems: 'center',
          color: accent ? 'white' : '#2f68ec',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: accent ? 'rgba(255,255,255,0.75)' : '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: accent ? 'white' : '#1c2433', lineHeight: 1.2 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export function ProyectoDetallePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [statusDraft, setStatusDraft] = useState<VisibleProjectStatus>('En progreso');
  const [savingStatus, setSavingStatus] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function showToast(msg: string) {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  }

  async function handleDeleteProject() {
    if (!project) return;
    setDeletingProject(true);
    try {
      await deleteProject(project.id);
      showToast('✓ Proyecto eliminado correctamente');
      setTimeout(() => navigate('/proyectos'), 1500);
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'No se pudo eliminar el proyecto'}`);
      setDeletingProject(false);
    }
    setShowDeleteConfirm(false);
  }

  function loadProject(active: { value: boolean }) {
    setLoading(true);
    setError('');
    getProjectById(id)
      .then((data) => { if (active.value) setProject(data); })
      .catch((err: unknown) => {
        if (!active.value) return;
        const localProject = findLocalProjectDetail(id);
        if (localProject) {
          setProject(localProject);
          setError('');
          return;
        }
        setProject(null);
        setError(err instanceof Error ? err.message : 'No se pudo cargar el proyecto');
      })
      .finally(() => { if (active.value) setLoading(false); });
  }

  useEffect(() => {
    const active = { value: true };
    loadProject(active);
    return () => { active.value = false; };
  }, [id]);

  useEffect(() => {
    if (project) {
      setStatusDraft(toVisibleStatus(project.status, project.estado));
    }
  }, [project]);

  async function handleStatusChange(nextStatus: VisibleProjectStatus) {
    if (!project) return;
    setSavingStatus(true);
    try {
      const updated = await updateProject(project.id, { estado: nextStatus });
      setProject(updated);
      setStatusDraft(toVisibleStatus(updated.status, updated.estado));
    } finally {
      setSavingStatus(false);
    }
  }

  const formatDate = (value: string | null) => {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  if (loading) {
    return (
      <div className="detail-page wide-page">
        <BackLink to="/proyectos" label="Volver a proyectos" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <p className="muted">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="detail-page wide-page">
        <BackLink to="/proyectos" label="Volver a proyectos" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 8 }}>
          <h2>No se pudo cargar el proyecto</h2>
          <p className="muted">{error}</p>
        </div>
      </div>
    );
  }

  const estadoCfg = estadoConfig[project.estado] ?? estadoConfig['Cerrado'];
  const cuposOcupados = project.cuposOcupados ?? project.estudiantes.length;
  const cuposTotales = project.cuposTotales ?? null;
  const cuposDisponibles = cuposTotales != null ? Math.max(cuposTotales - cuposOcupados, 0) : null;

  const estudiantesConGenero = (project.estudiantes ?? []).filter(
    (s: any) => s.genero === 'Masculino' || s.genero === 'Femenino'
  );
  const tieneGenerosReales = estudiantesConGenero.length > 0;
  const hombres = tieneGenerosReales
    ? (project.estudiantes ?? []).filter((s: any) => s.genero === 'Masculino').length
    : (project.hombres ?? 0);
  const mujeres = tieneGenerosReales
    ? (project.estudiantes ?? []).filter((s: any) => s.genero === 'Femenino').length
    : (project.mujeres ?? 0);

  return (
    <div className="detail-page wide-page" style={{ paddingBottom: 64 }}>
      {/* Back navigation + Edit button */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link
          to="/proyectos"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#687182',
            transition: 'color 0.15s',
          }}
        >
          <ArrowLeft size={16} />
          Volver a proyectos
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'white',
              background: 'linear-gradient(135deg, #2f68ec, #1d55cc)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✏️ Editar proyecto
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletingProject}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'white',
              background: deletingProject ? '#f87171' : 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              cursor: deletingProject ? 'not-allowed' : 'pointer',
              opacity: deletingProject ? 0.7 : 1,
            }}
          >
            🗑️ {deletingProject ? 'Eliminando...' : 'Eliminar proyecto'}
          </button>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: '28px 32px',
            maxWidth: 440, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem', fontWeight: 800, color: '#1c2433' }}>
              ¿Eliminar este proyecto?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#687182', lineHeight: 1.6 }}>
              Esta acción no se puede deshacer. Se eliminarán el proyecto <strong>"{project?.nombre}"</strong> y todas sus inscripciones.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: '1px solid #d1d5db',
                  background: 'white', fontSize: '0.9rem', fontWeight: 600,
                  color: '#374151', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteProject()}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Sí, eliminar proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ← ACTUALIZADO: onSaved recarga datos y muestra toast */}
      {showEdit ? (
        <EditProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            const active = { value: true };
            loadProject(active);
            showToast('✓ Proyecto actualizado correctamente');
          }}
        />
      ) : null}

      {/* Hero */}
      <div
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid #e0e6f0',
          boxShadow: '0 4px 20px rgba(28,41,71,0.08)',
          marginBottom: 28,
          position: 'relative',
          minHeight: 240,
          background: 'linear-gradient(135deg, #1a2f6e 0%, #2f68ec 60%, #21c08a 100%)',
        }}
      >
        <img
          src={resolveProjectImage(project) ?? '/images/ProjectsDirectoryDetailedView.jpeg'}
          alt={project.nombre}
          onError={(e) => { try { e.currentTarget.src = '/images/ProjectsDirectoryDetailedView.jpeg'; } catch { } }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.34,
            filter: 'saturate(1.05) contrast(1.02)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '38px 40px 34px',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 260px',
            gap: 24,
            alignItems: 'end',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  background: estadoCfg.bg,
                  color: estadoCfg.color,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: estadoCfg.dot, flexShrink: 0 }} />
                {project.status ?? project.estado}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.06em' }}>
                {project.institution}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>•</span>
              <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} />
                {project.ubicacion}
              </span>
            </div>

            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 3vw, 2.35rem)', fontWeight: 800, color: 'white', lineHeight: 1.15 }}>
                {project.nombre}
              </h1>
              <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.84)', fontSize: '0.98rem', lineHeight: 1.6, maxWidth: 680 }}>
                {project.resumen ?? project.descripcion}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[
                { icon: <Calendar size={14} />, text: `Inicio: ${formatDate(project.fechaInicio)}` },
                { icon: <Calendar size={14} />, text: `Cierre: ${formatDate(project.fechaCierre)}` },
                { icon: <Users size={14} />, text: `${project.estudiantesAsignados ?? project.estudiantes.length} estudiantes` },
              ].map(({ icon, text }) => (
                <div
                  key={text}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(8px)',
                    color: 'rgba(255,255,255,0.94)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  {icon}
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              alignSelf: 'stretch',
              justifySelf: 'end',
              minHeight: 150,
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              boxShadow: '0 16px 28px rgba(0,0,0,0.14)',
            }}
          >
            <>
              <img
                src={resolveProjectImage(project) ?? ''}
                alt={project.nombre}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                style={{ width: '100%', height: '100%', minHeight: 150, objectFit: 'cover', display: 'block' }}
              />
              <div style={{ width: '100%', height: '100%', minHeight: 150, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.9)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    Proyecto
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, marginTop: 6 }}>{project.institution}</div>
                </div>
              </div>
            </>
          </div>
        </div>
      </div>

      {/* Body: two-column layout */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}
        className="project-detail-body"
      >
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* About */}
          <section
            style={{
              background: 'white',
              border: '1px solid #e0e6f0',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: '0 2px 8px rgba(28,41,71,0.04)',
            }}
          >
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#1c2433' }}>
              Acerca del proyecto
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#4a5a7a', lineHeight: 1.7 }}>
              {project.resumen ?? project.descripcion}
            </p>

            {project.carreras.length > 0 ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <BookOpen size={14} style={{ color: '#9aa3b5' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Carreras aplicables
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {project.carreras.map((c) => (
                    <span
                      key={c}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: '#eef2fb',
                        color: '#4a5a7a',
                        border: '1px solid #dde3ef',
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* Team */}
          <section
            style={{
              background: 'white',
              border: '1px solid #e0e6f0',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: '0 2px 8px rgba(28,41,71,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1c2433' }}>
                Equipo del proyecto
              </h2>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9aa3b5' }}>
                {(project.estudiantes?.length ?? 0) || (project.equipo?.length ?? 0)} miembro(s)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {project.estudiantes && project.estudiantes.length > 0
                ? project.estudiantes.map((student) => {
                  const initials = (student.nombre ?? '')
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                  return (
                    <div
                      key={`${student.carnet}-${student.nombre}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: '#f8faff',
                        border: '1px solid #e8edf8',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3972f0, #21c08a)',
                            color: 'white',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1c2433' }}>
                          {student.nombre}
                        </p>
                      </div>
                      <div style={{ height: 1, background: '#e8edf8', marginBottom: 8 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {student.carrera ? (
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#687182', fontWeight: 600 }}>{student.carrera}</p>
                        ) : null}
                        {student.carnet ? (
                          <p style={{ margin: 0, fontSize: '0.73rem', color: '#9aa3b5' }}>Carnet: {student.carnet}</p>
                        ) : null}
                        {student.email ? (
                          <p style={{ margin: 0, fontSize: '0.70rem', color: '#9aa3b5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email}</p>
                        ) : null}
                        {(student as any).genero ? (
                          <p style={{ margin: 0, fontSize: '0.73rem', color: '#9aa3b5' }}>
                            Género: {(student as any).genero}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
                : project.equipo && project.equipo.length > 0
                  ? project.equipo.map((name) => {
                    const initials = name.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
                    return (
                      <div
                        key={name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: '#f8faff',
                          border: '1px solid #e8edf8',
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3972f0 0%, #2a5ed4 100%)',
                            color: 'white',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>{name}</p>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#687182' }}>Colaborador</p>
                        </div>
                      </div>
                    );
                  })
                  : <p className="muted" style={{ gridColumn: '1 / -1' }}>No hay información del equipo.</p>
              }
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'white',
              border: '1px solid #e0e6f0',
              borderRadius: 16,
              padding: '20px',
              boxShadow: '0 2px 8px rgba(28,41,71,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 700, color: '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ficha rápida
            </h3>

            <StatCard icon={<UserCheck size={16} />} label="Estudiantes asignados" value={project.estudiantesAsignados ?? project.estudiantes.length} accent />

            {cuposTotales != null ? (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8faff', border: '1px solid #e5eaf5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cupos</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1c2433' }}>{cuposOcupados} / {cuposTotales}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#e9edf5', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min((cuposOcupados / cuposTotales) * 100, 100)}%`,
                      borderRadius: 999,
                      background: cuposDisponibles === 0
                        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : 'linear-gradient(90deg, #2f68ec, #21c08a)',
                    }}
                  />
                </div>
                {cuposDisponibles !== null ? (
                  <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: cuposDisponibles === 0 ? '#dc2626' : '#0d6d3e', fontWeight: 600 }}>
                    {cuposDisponibles === 0 ? 'Sin cupos disponibles' : `${cuposDisponibles} cupo${cuposDisponibles !== 1 ? 's' : ''} disponible${cuposDisponibles !== 1 ? 's' : ''}`}
                  </p>
                ) : null}
              </div>
            ) : null}

            <StatCard icon={<TrendingUp size={16} />} label="Hombres" value={hombres} />
            <StatCard icon={<TrendingUp size={16} />} label="Mujeres" value={mujeres} />

            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8faff', border: '1px solid #e5eaf5', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.78rem', color: '#9aa3b5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Estado del proyecto
                </span>
                <span className={`pill status ${statusDraft === 'Cerrado' ? 'closed' : statusDraft === 'Activo' ? 'active' : 'planning'}`}>
                  {statusDraft}
                </span>
              </div>
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as VisibleProjectStatus)}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #d8deea', padding: '10px 12px', fontSize: '0.9rem', color: '#1c2433', background: 'white' }}
              >
                <option value="Activo">Activo</option>
                <option value="En progreso">En progreso</option>
                <option value="Cerrado">Cerrado</option>
              </select>
              <button
                type="button"
                onClick={() => void handleStatusChange(statusDraft)}
                disabled={savingStatus}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: 'none',
                  padding: '10px 12px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: 'white',
                  background: savingStatus ? 'linear-gradient(135deg, #94a3b8, #64748b)' : 'linear-gradient(135deg, #2f68ec, #1d55cc)',
                  cursor: savingStatus ? 'not-allowed' : 'pointer',
                }}
              >
                {savingStatus ? 'Guardando...' : 'Cambiar estado'}
              </button>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8faff', border: '1px solid #e5eaf5', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#9aa3b5', fontWeight: 600 }}>Inicio</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1c2433' }}>{formatDate(project.fechaInicio)}</span>
              </div>
              <div style={{ height: 1, background: '#edf0f8' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#9aa3b5', fontWeight: 600 }}>Cierre</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1c2433' }}>{formatDate(project.fechaCierre)}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'white',
              border: '1px solid #e0e6f0',
              borderRadius: 16,
              padding: '16px 20px',
              boxShadow: '0 2px 8px rgba(28,41,71,0.04)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '0.7rem', fontWeight: 700, color: '#9aa3b5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Institución
            </p>
            <p style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: '#1c2433' }}>
              {project.institution}
            </p>
            <Link
              to="/instituciones"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: '#2f68ec' }}
            >
              Ver en directorio <ChevronRight size={13} />
            </Link>
          </div>
        </aside>
      </div>

      {/* ← NUEVO: Toast de éxito flotante en la página de detalle */}
      {successToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: '#276749', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '0.9rem', zIndex: 9999,
        }}>
          {successToast}
        </div>
      )}
    </div>
  );
}