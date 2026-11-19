import { Mail, MapPinned, Pencil, Phone, Plus, Search, SlidersHorizontal, User } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EditInstitutionModal from '../components/EditInstitutionModal';
import InstitutionCard from '../components/InstitutionCard';
import { BackLink, Notice } from '../components/ui';
import {
  ApiError,
  describeApiError,
  getInstitutionById,
  getInstitutions,
  type InstitutionDetailResponse,
  type InstitutionListResponse,
} from '../services/api';
import type { Institucion } from '../types';

// ─── InstitucionesPage ────────────────────────────────────────────────────────
export function InstitucionesPage() {
  const [activeFilter, setActiveFilter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'nombre-asc' | 'nombre-desc'>('nombre-asc');
  const [items, setItems] = useState<InstitutionListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadInstitutions() {
      try {
        setLoading(true);
        setError('');
        const data = await getInstitutions();
        if (!active) return;
        setItems(data);
      } catch (err) {
        if (!active) return;
        // Sin datos de respaldo: se muestra el error real y la lista queda vacía.
        setError(describeApiError(err, 'No se pudieron cargar las instituciones.'));
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInstitutions();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const institutionTypes = useMemo(
    () => ['Todos', ...Array.from(new Set(items.map((institution) => institution.tipo?.trim()).filter(Boolean))).sort()],
    [items]
  );

  const filteredInstitutions = items
    .filter((inst) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [inst.nombre, inst.ubicacion, inst.tipo ?? '', inst.contactoNombre ?? ''].some((v) =>
          v.toLowerCase().includes(query),
        );
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

            <button className="primary-btn" type="button" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              <span>Nueva institución</span>
            </button>
          </div>
        </div>
      </header>

      {showCreate ? (
        <EditInstitutionModal
          onClose={() => setShowCreate(false)}
          onSaved={(created) => {
            setReloadKey((k) => k + 1);
            // Tras el aviso de éxito, se abre el detalle de la nueva institución.
            setTimeout(() => navigate(`/instituciones/${created.id}`), 1200);
          }}
        />
      ) : null}

      {loading ? <p className="muted">Cargando instituciones...</p> : null}
      {!loading && error ? (
        <Notice title="No se pudieron cargar las instituciones" onRetry={() => setReloadKey((k) => k + 1)}>
          {error}
        </Notice>
      ) : null}

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
        {filteredInstitutions.map((inst) => {
          const cardInstitution: Institucion = {
            id: String(inst.id),
            nombre: inst.nombre,
            sigla: inst.nombre,
            ubicacion: inst.ubicacion,
            telefono: inst.telefono ?? undefined,
            contactoNombre: inst.contactoNombre ?? undefined,
            contactoEmail: inst.contactoEmail ?? undefined,
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
              <InstitutionCard institution={cardInstitution} imageUrl={inst.image} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── InstitutionTabs ──────────────────────────────────────────────────────────
function InstitutionTabs({ institution }: { institution: InstitutionDetailResponse }) {
  const [tab, setTab] = useState<'active' | 'progress' | 'closed'>('progress');

  return (
    <>
      <div className="tabs-row">
        {(['active', 'progress', 'closed'] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} type="button" onClick={() => setTab(t)}>
            {t === 'active' ? 'Proyectos activos' : t === 'progress' ? 'Proyectos en progreso' : 'Proyectos cerrados'}
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
      </div>
    </>
  );
}

// ─── InstitutionContactInfo ───────────────────────────────────────────────────
/** Ubicación y contacto visibles en el detalle; los datos vacíos se indican como "Sin registrar". */
function InstitutionContactInfo({ institution }: { institution: InstitutionDetailResponse }) {
  const ubicacion = [institution.ubicacion, institution.direccion].map((v) => v?.trim()).filter(Boolean).join(' · ');
  const items: Array<{ icon: ReactNode; label: string; value: string | null | undefined; href?: string }> = [
    { icon: <MapPinned size={16} />, label: 'Ubicación', value: ubicacion },
    { icon: <User size={16} />, label: 'Contacto', value: institution.contactoNombre },
    {
      icon: <Phone size={16} />,
      label: 'Teléfono',
      value: institution.telefono,
      href: institution.telefono ? `tel:${institution.telefono.replace(/[^\d+]/g, '')}` : undefined,
    },
    {
      icon: <Mail size={16} />,
      label: 'Correo',
      value: institution.contactoEmail,
      href: institution.contactoEmail ? `mailto:${institution.contactoEmail}` : undefined,
    },
  ];
  return (
    <dl className="institution-contact-grid">
      {items.map((item) => (
        <div key={item.label} className="institution-contact-item">
          <dt>
            {item.icon}
            {item.label}
          </dt>
          <dd>
            {item.value?.trim() ? (
              item.href ? <a href={item.href}>{item.value}</a> : item.value
            ) : (
              <span className="muted">Sin registrar</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── InstitucionDetallePage ───────────────────────────────────────────────────
export function InstitucionDetallePage() {
  const { id = '1' } = useParams();
  const [institution, setInstitution] = useState<InstitutionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInstitution() {
      try {
        setLoading(true);
        setError('');
        setNotFound(false);
        const data = await getInstitutionById(id);
        if (!active) return;
        setInstitution(data);
      } catch (err) {
        if (!active) return;
        // Sin datos de respaldo: se muestra el error real.
        setInstitution(null);
        setNotFound(err instanceof ApiError && err.status === 404);
        setError(describeApiError(err, 'No se pudo cargar la institución.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInstitution();

    return () => {
      active = false;
    };
  }, [id, reloadKey]);

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
        {notFound ? (
          <Notice variant="info" title="No se encontró la institución">
            Es posible que haya sido eliminada o que el enlace sea incorrecto.
          </Notice>
        ) : (
          <Notice title="No se pudo cargar la institución" onRetry={() => setReloadKey((k) => k + 1)}>
            {error}
          </Notice>
        )}
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
            <h1>{institution.nombre}</h1>
          </div>
        </div>
        <InstitutionContactInfo institution={institution} />
        {institution.descripcion?.trim() ? (
          <p className="institution-description">{institution.descripcion}</p>
        ) : null}
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
