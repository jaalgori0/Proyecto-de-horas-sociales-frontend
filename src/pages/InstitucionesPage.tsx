import { MapPinned, Pencil, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import EditInstitutionModal from '../components/EditInstitutionModal';
import InstitutionCard from '../components/InstitutionCard';
import { BackLink } from '../components/ui';
import { instituciones } from '../data/instituciones';
import {
  getInstitutionById,
  getInstitutions,
  type InstitutionDetailResponse,
  type InstitutionListResponse,
  type InstitutionProjectResponse,
} from '../services/api';
import type { Institucion } from '../types';

function normalizeProjectStatus(estado: string) {
  if (estado === 'Cerrado') return 'Cerrado';
  if (estado === 'Activo') return 'Activo';
  return 'En progreso';
}

// ─── InstitucionesPage ────────────────────────────────────────────────────────
export function InstitucionesPage() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'nombre-asc' | 'nombre-desc'>('nombre-asc');
  const [items, setItems] = useState<InstitutionListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadInstitutions() {
      try {
        setLoading(true);
        setError('');
        const data = await getInstitutions();
        if (!active) return;
        setItems(data);
      } catch {
        if (!active) return;
        setError('No se pudo conectar con el backend. Mostrando datos de respaldo.');
        setItems(
          instituciones.map((institution) => ({
            id: institution.id,
            nombre: institution.nombre,
            tipo: institution.tipo ?? null,
            ubicacion: institution.ubicacion,
            image: institution.image ?? null,
            totalProyectosActivos: institution.proyectos.filter((project) => project.estado === 'Activo').length,
            totalEstudiantesAsignados: Number(
              institution.estadisticas.find(([, label]) => label.toLowerCase().includes('estudiantes'))?.[0] ?? 0
            ),
          }))
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInstitutions();

    return () => {
      active = false;
    };
  }, []);

  const institutionTypes = useMemo(
    () => ['Todos', ...Array.from(new Set(items.map((institution) => institution.tipo?.trim()).filter(Boolean))).sort()],
    [items]
  );

  const institutionImages = [
    'InstitutionDetailView.jpeg',
    'InstitutionDetailViewCopy.jpeg',
    'InstitutionsDirectory.jpeg',
    'ProjectsDirectoryDetailedView.jpeg',
    'MainMapDashboard.jpeg',
    'EmployeeLogin.jpeg',
    'StudentLogin.jpeg',
    'StudentsbyProject.jpeg',
    'StudentProjectDetail.jpeg',
    'InstitutionDetailView.jpeg',
  ];

  const filteredInstitutions = items
    .filter((inst) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query || [inst.nombre, inst.ubicacion, inst.tipo ?? ''].some((v) => v.toLowerCase().includes(query));
      const selectedType = institutionTypes[activeFilter];
      const matchesCategory = selectedType === 'Todos' || (inst.tipo ?? '') === selectedType;
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'nombre-desc') return b.nombre.localeCompare(a.nombre);
      return a.nombre.localeCompare(b.nombre);
    });

  return (
    <div className="directory-page wide-page">
      <header className="institutions-hero">
        <div className="hero-left">
          <h1 className="main-title">Instituciones aliadas</h1>
        </div>

        <div className="hero-right">
          <div className="hero-search-card">
            <div className="search-wrapper">
              <Search size={18} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Buscar instituciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              className="filter-action-btn"
              type="button"
              onClick={() => setSortBy((c) => (c === 'nombre-asc' ? 'nombre-desc' : 'nombre-asc'))}
            >
              <SlidersHorizontal size={16} />
              <span>{sortBy === 'nombre-asc' ? 'Ordenar A-Z' : 'Ordenar Z-A'}</span>
            </button>
          </div>
        </div>
      </header>

      {loading ? <p className="muted">Cargando instituciones...</p> : null}
      {!loading && error ? <p className="muted">{error}</p> : null}

      <div className="chip-row">
        {institutionTypes.map((type, index) => (
          <button
            key={type}
            className={`chip ${index === activeFilter ? 'active' : ''}`}
            onClick={() => setActiveFilter(index)}
            type="button"
          >
            {type}
          </button>
        ))}
      </div>

      <div className="institution-grid">
        {filteredInstitutions.map((inst, i) => {
          const imageSrc = inst.image ?? `/images/${institutionImages[i % institutionImages.length]}`;
          const cardInstitution: Institucion = {
            id: String(inst.id),
            nombre: inst.nombre,
            sigla: inst.nombre,
            ubicacion: inst.ubicacion,
            tipo: inst.tipo ?? undefined,
            image: inst.image ?? undefined,
            descripcion: '',
            estadisticas: [
              [String(inst.totalProyectosActivos), 'Proyectos activos'],
              [String(inst.totalEstudiantesAsignados), 'Estudiantes asignados'],
            ],
            proyectos: [],
          };
          return (
            <div key={inst.id} className="institution-card-link">
              <InstitutionCard institution={cardInstitution} imageUrl={imageSrc} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── InstitutionTabs ──────────────────────────────────────────────────────────
function InstitutionTabs({ institution }: { institution: InstitutionDetailResponse }) {
  const [tab, setTab] = useState<'general' | 'active' | 'progress' | 'closed'>('progress');

  return (
    <>
      <div className="tabs-row">
        {(['general', 'active', 'progress', 'closed'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} type="button" onClick={() => setTab(t)}>
            {t === 'general' ? 'General' : t === 'active' ? 'Proyectos activos' : t === 'progress' ? 'Proyectos en progreso' : 'Proyectos cerrados'}
          </button>
        ))}
      </div>

      <div className="institution-content">
        <section className="projects-zone" style={{ display: tab === 'active' ? 'block' : 'none' }}>
          <div className="section-heading-row">
            <h2>Proyectos activos</h2>
          </div>
          <div className="institution-project-grid">
            {institution.proyectosActivos.length
              ? institution.proyectosActivos.map((p) => (
                  <article key={p.id} className="compact-project-card">
                    <div className="project-summary-topline">{p.nombreInstitucion}</div>
                    <div className="compact-head">
                      <h3>{p.nombreProyecto}</h3>
                      <div className="pill status active">Activo</div>
                    </div>
                    <p className="muted with-icon">
                      <MapPinned size={15} />
                      {p.ubicacion}
                    </p>
                  </article>
                ))
              : <p>No hay proyectos activos.</p>}
          </div>
        </section>

        <section className="projects-zone" style={{ display: tab === 'progress' ? 'block' : 'none' }}>
          <div className="section-heading-row">
            <h2>Proyectos en progreso</h2>
          </div>
          <div className="institution-project-grid">
            {institution.proyectosEnProgreso.length
              ? institution.proyectosEnProgreso.map((p) => (
                  <article key={p.id} className="compact-project-card">
                    <div className="project-summary-topline">{p.nombreInstitucion}</div>
                    <div className="compact-head">
                      <h3>{p.nombreProyecto}</h3>
                      <div className="pill status planning">En progreso</div>
                    </div>
                    <p className="muted with-icon">
                      <MapPinned size={15} />
                      {p.ubicacion}
                    </p>
                  </article>
                ))
              : <p>No hay proyectos en progreso.</p>}
          </div>
        </section>

        <section className="projects-zone" style={{ display: tab === 'closed' ? 'block' : 'none' }}>
          <div className="section-heading-row"><h2>Proyectos cerrados</h2></div>
          <div className="institution-project-grid">
            {institution.proyectosCerrados.length
              ? institution.proyectosCerrados.map((p) => (
                  <article key={p.id} className="compact-project-card">
                    <div className="project-summary-topline">{p.nombreInstitucion}</div>
                    <div className="compact-head">
                      <h3>{p.nombreProyecto}</h3>
                      <div className="pill status closed">Cerrado</div>
                    </div>
                    <p className="muted with-icon">
                      <MapPinned size={15} />
                      {p.ubicacion}
                    </p>
                  </article>
                ))
              : <p>No hay proyectos cerrados.</p>}
          </div>
        </section>

        <section style={{ display: tab === 'general' ? 'block' : 'none' }}>
          <div className="section-heading-row"><h2>General</h2></div>
          <p>{institution.descripcion}</p>
        </section>
      </div>
    </>
  );
}

// ─── InstitucionDetallePage ───────────────────────────────────────────────────
export function InstitucionDetallePage() {
  const { id = '1' } = useParams();
  const [institution, setInstitution] = useState<InstitutionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInstitution() {
      try {
        setLoading(true);
        setError('');
        const data = await getInstitutionById(id);
        if (!active) return;
        setInstitution(data);
      } catch {
        if (!active) return;
        const fallback = instituciones.find((item) => String(item.id) === String(id)) ?? instituciones[0];
        const mappedProjects: InstitutionProjectResponse[] = fallback.proyectos.map((project) => ({
          id: project.id,
          nombreInstitucion: fallback.nombre,
          nombreProyecto: project.titulo,
          estadoProyecto: normalizeProjectStatus(project.estado) as InstitutionProjectResponse['estadoProyecto'],
          ubicacion: project.ubicacion,
        }));
        setInstitution({
          id: fallback.id,
          image: fallback.image ?? null,
          tipo: fallback.tipo ?? null,
          nombre: fallback.nombre,
          ubicacion: fallback.ubicacion,
          descripcion: fallback.descripcion,
          totalProyectosActivos: fallback.proyectos.filter((project) => project.estado !== 'Cerrado').length,
          totalEstudiantesAsignados: Number(
            fallback.estadisticas.find(([, label]) => label.toLowerCase().includes('estudiantes'))?.[0] ?? 0
          ),
          totalCarrerasAplicables: new Set(fallback.proyectos.flatMap((project) => project.carreras)).size,
          proyectosGenerales: mappedProjects,
          proyectosActivos: mappedProjects.filter((project) => project.estadoProyecto === 'Activo'),
          proyectosEnProgreso: mappedProjects.filter((project) => project.estadoProyecto === 'En progreso'),
          proyectosCerrados: mappedProjects.filter((project) => project.estadoProyecto === 'Cerrado'),
        });
        setError('No se pudo conectar con el backend. Mostrando datos de respaldo.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInstitution();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="detail-page wide-page">
        <BackLink to="/instituciones" label="Volver a instituciones" />
        <p className="muted">Cargando institución...</p>
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="detail-page wide-page">
        <BackLink to="/instituciones" label="Volver a instituciones" />
        <p className="muted">No se encontró la institución.</p>
      </div>
    );
  }

  return (
    <div className="detail-page wide-page">
      <div className="detail-toolbar">
        <BackLink to="/instituciones" label="Volver a instituciones" />
        <button className="primary-btn" type="button" onClick={() => setShowEdit(true)}>
          <Pencil size={16} />
          <span>Editar institución</span>
        </button>
      </div>
      {error ? <p className="muted">{error}</p> : null}

      {showEdit ? (
        <EditInstitutionModal
          institution={institution}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setInstitution(updated);
            setError('');
          }}
        />
      ) : null}

      <section className="institution-hero">
        <div className="checker-bg" />
        <div className="institution-header-row">
          {/* CORRECCIÓN: muestra la imagen si existe, o la inicial del nombre como fallback */}
          {institution.image ? (
            <img
              src={institution.image}
              alt={institution.nombre}
              className="floating-logo"
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'grid';
              }}
            />
          ) : null}
          <div
            className="floating-logo"
            style={{
              display: institution.image ? 'none' : 'grid',
              background: 'linear-gradient(135deg, #3b72f1, #21c08a)',
              placeItems: 'center',
              color: 'white',
              fontSize: '2rem',
              fontWeight: 900,
            }}
          >
            {institution.nombre.charAt(0).toUpperCase()}
          </div>

          <div className="institution-meta">
            <span className="eyebrow-tag">Universidad destacada</span>
            <span className="muted">{institution.ubicacion}</span>
            <h1>{institution.nombre}</h1>
            <p>{institution.descripcion}</p>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat-block">
            <strong>{institution.totalProyectosActivos}</strong>
            <span>Proyectos activos</span>
          </div>
          <div className="stat-block">
            <strong>{institution.totalEstudiantesAsignados}</strong>
            <span>Estudiantes asignados</span>
          </div>
          <div className="stat-block">
            <strong>{institution.totalCarrerasAplicables}</strong>
            <span>Carreras aplicables</span>
          </div>
        </div>
      </section>

      <InstitutionTabs institution={institution} />
    </div>
  );
}
