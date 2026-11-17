import { CalendarDays, ChevronLeft, MapPinned, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clasificacionEstado } from '../data/proyectos';
import type { ProyectoMapa } from '../types';
import { Notice } from '../components/ui';
import {
  describeApiError,
  getMapMarkers,
  getProjectsForMap,
  getGenderByMunicipio,
  type ProjectDetailResponse,
} from '../services/api';
import { coordenadasDepartamentos } from '../data/departamentos';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


function normalizeVisibleStatus(status?: string | null): ProyectoMapa['estado'] {
  if (status === 'Cerrado') return 'Cerrado';
  if (status === 'Activo') return 'Activo';
  return 'En progreso';
}

/** Valor de `?lugar=` para los proyectos sin marcador (sin ubicación, extranjeros o no reconocidos). */
const LUGAR_FUERA_DEL_MAPA = 'fuera-del-mapa';
const VISTA_INICIAL = { center: [13.7, -88.9] as [number, number], zoom: 8 };
/** Desde este zoom los marcadores muestran el desglose por género; antes, un pin compacto (no se solapan). */
const ZOOM_DETALLE = 10;

/** Marcador pintado en el mapa (por departamento o ligado a un proyecto). */
type MapMarker = {
  id: string;
  projectId: string | null;
  /** Departamento del marcador: es la clave del filtro `?lugar=`. null en marcadores de proyecto. */
  lugar: string | null;
  label: string;
  proyectos: number;
  hombres: number;
  mujeres: number;
  lat: number;
  lng: number;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const plural = (n: number, singular: string, pluralForm = `${singular}s`) => `${n} ${n === 1 ? singular : pluralForm}`;

export default function MapaVistaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProyectoMapa[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Participantes cuya ubicación no corresponde a un departamento conocido (no se pintan).
  const [sinUbicacion, setSinUbicacion] = useState(0);
  const [projectDetail, setProjectDetail] = useState<ProjectDetailResponse | null>(null);
  const [zoomDetallado, setZoomDetallado] = useState(VISTA_INICIAL.zoom >= ZOOM_DETALLE);

  const proyectoId = searchParams.get('proyecto') ?? String(projects[0]?.id ?? '');
  const proyectoSeleccionado = projects.find((p) => String(p.id) === proyectoId) ?? projects[0];
  const mostrarDetalle = searchParams.has('proyecto');
  const lugarSeleccionado = searchParams.get('lugar');

  // ─── Navegación: el lugar elegido se conserva al abrir y cerrar el detalle de un proyecto.
  const seleccionarLugar = (lugar: string) => setSearchParams({ lugar });
  const limpiarLugar = () => setSearchParams({});
  const abrirProyecto = (id: string) =>
    setSearchParams(lugarSeleccionado ? { lugar: lugarSeleccionado, proyecto: id } : { proyecto: id });
  const volverALista = () => setSearchParams(lugarSeleccionado ? { lugar: lugarSeleccionado } : {});

  const proyectosVisibles = useMemo(() => {
    if (!lugarSeleccionado) return projects;
    if (lugarSeleccionado === LUGAR_FUERA_DEL_MAPA) return projects.filter((p) => !p.enMapa);
    return projects.filter((p) => p.departamento === lugarSeleccionado);
  }, [projects, lugarSeleccionado]);

  const proyectosFueraDelMapa = useMemo(() => projects.filter((p) => !p.enMapa).length, [projects]);

  /** Municipios del lugar elegido, de más a menos proyectos (subtítulo del encabezado). */
  const municipiosDelLugar = useMemo(() => {
    if (!lugarSeleccionado || lugarSeleccionado === LUGAR_FUERA_DEL_MAPA) return [];
    const conteo = new Map<string, number>();
    for (const p of proyectosVisibles) {
      const nombre = p.municipio ?? 'Sin municipio';
      conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    }
    return [...conteo].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  }, [proyectosVisibles, lugarSeleccionado]);

  // ─── Leer hombres/mujeres DIRECTO desde el proyecto (vienen de la BD via /projects/map)
  const getGeneroData = (projectId: string) => {
    const project = projects.find((p) => String(p.id) === projectId);
    if (project) {
      return { hombres: project.hombres ?? 0, mujeres: project.mujeres ?? 0 };
    }
    return { hombres: 0, mujeres: 0 };
  };

  const focoMapa = '50% 50%';
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  // El clic de un marcador de Leaflet se registra fuera de React: siempre usa la versión vigente.
  const seleccionarLugarRef = useRef(seleccionarLugar);
  seleccionarLugarRef.current = seleccionarLugar;

  // Al cambiar de lugar, la lista vuelve arriba.
  useEffect(() => {
    listaRef.current?.scrollTo({ top: 0 });
  }, [lugarSeleccionado]);

  useEffect(() => {
    let active = true;

    async function loadMapData() {
      try {
        setLoadingData(true);
        setLoadError('');

        const [apiProjects, apiMarkers, apiGeneroMunicipio] = await Promise.all([
          getProjectsForMap(),   // trae hombres/mujeres reales desde enrollments
          getMapMarkers(),
          getGenderByMunicipio(),
        ]);
        if (!active) return;

        // Mapear proyectos incluyendo hombres/mujeres reales desde la BD
        const mappedProjects: ProyectoMapa[] = apiProjects.map((project) => ({
          id: String(project.id),
          institucion: project.institution ?? 'Institución',
          titulo: project.nombre,
          ubicacion: project.ubicacion,
          estado: normalizeVisibleStatus(project.status),
          carreras: [],
          descripcion: project.descripcion ?? '',
          resumen: project.descripcion ?? '',
          equipo: [],
          personas: Number((project.hombres ?? 0) + (project.mujeres ?? 0)),
          hombres: Number(project.hombres ?? 0),   // ← conteo real desde BD
          mujeres: Number(project.mujeres ?? 0),   // ← conteo real desde BD
          departamento: project.departamento,
          municipio: project.municipio,
          // Solo cuenta como "en el mapa" si el frontend tiene las coordenadas del departamento.
          enMapa: Boolean(project.enMapa && coordenadasDepartamentos[project.departamento]),
        }));

        // Marcadores ligados a proyectos específicos
        const projectMarkers: MapMarker[] = apiMarkers
          .filter((marker) => marker.projectId !== null)
          .map((marker) => ({
            id: String(marker.id),
            projectId: String(marker.projectId),
            lugar: null,
            label: marker.label,
            proyectos: 1,
            hombres: Number(marker.hombres ?? 0),
            mujeres: Number(marker.mujeres ?? 0),
            lat: Number(marker.lat),
            lng: Number(marker.lng),
          }));

        // Marcadores por departamento: todo departamento con proyectos o con participantes.
        const proyectosPorDepto = new Map<string, number>();
        for (const p of mappedProjects) {
          if (p.enMapa && p.departamento) proyectosPorDepto.set(p.departamento, (proyectosPorDepto.get(p.departamento) ?? 0) + 1);
        }
        const generoPorDepto = new Map(apiGeneroMunicipio.map((row) => [row.municipio, row]));
        const departmentMarkers: MapMarker[] = Object.entries(coordenadasDepartamentos)
          .filter(([depto]) => proyectosPorDepto.has(depto) || generoPorDepto.has(depto))
          .map(([depto, coords]) => ({
            id: `depto-${depto}`,
            projectId: null,
            lugar: depto,
            label: depto,
            proyectos: proyectosPorDepto.get(depto) ?? 0,
            hombres: generoPorDepto.get(depto)?.hombres ?? 0,
            mujeres: generoPorDepto.get(depto)?.mujeres ?? 0,
            lat: coords.lat,
            lng: coords.lng,
          }));

        const mappedMarkers = [...departmentMarkers, ...projectMarkers];

        setSinUbicacion(
          apiGeneroMunicipio
            .filter((row) => !coordenadasDepartamentos[row.municipio])
            .reduce((sum, row) => sum + row.hombres + row.mujeres + Number((row as { sinDato?: number }).sinDato ?? 0), 0)
        );
        setProjects(mappedProjects);
        setMarkers(mappedMarkers);
      } catch (err) {
        if (!active) return;
        // Sin datos de respaldo: el mapa queda vacío y se muestra el error real.
        setProjects([]);
        setMarkers([]);
        setSinUbicacion(0);
        setLoadError(describeApiError(err, 'No se pudieron cargar los datos del mapa.'));
      } finally {
        if (active) setLoadingData(false);
      }
    }

    loadMapData();
    return () => { active = false; };
  }, [reloadKey]);

  // Cargar detalle cuando se selecciona un proyecto
  useEffect(() => {
    if (!mostrarDetalle || !proyectoId) {
      setProjectDetail(null);
      return;
    }
    let active = true;
    import('../services/api').then(({ getProjectById }) => {
      getProjectById(proyectoId)
        .then((data) => { if (active) setProjectDetail(data); })
        .catch(() => { if (active) setProjectDetail(null); });
    });
    return () => { active = false; };
  }, [proyectoId, mostrarDetalle]);

  // Inicializar mapa Leaflet una sola vez
  useEffect(() => {
    if (!L?.map) return;

    const map = L.map('leaflet-map', {
      center: VISTA_INICIAL.center,
      zoom: VISTA_INICIAL.zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Los marcadores se ven a cualquier zoom; solo cambia su forma (ver efecto de marcadores).
    map.on('zoomend', () => setZoomDetallado(map.getZoom() >= ZOOM_DETALLE));

    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch { /* ignore */ }
    };
  }, []);

  // Actualizar marcadores del mapa cuando cambie la selección o el zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L?.layerGroup) return;

    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    } else {
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    // En el detalle: el marcador del proyecto (si existe) y el de su departamento.
    const markersToShow = mostrarDetalle && proyectoSeleccionado
      ? markers.filter((m) =>
          (m.projectId !== null && String(m.projectId) === String(proyectoSeleccionado.id)) ||
          (m.lugar !== null && proyectoSeleccionado.enMapa && m.lugar === proyectoSeleccionado.departamento))
      : markers;

    markersToShow.forEach((m) => {
      const seleccionado = m.lugar !== null && m.lugar === lugarSeleccionado;
      const nombre = escapeHtml(m.label);
      const icon = zoomDetallado
        ? L.divIcon({
            className: '',
            html: `
              <div class="gender-marker${seleccionado ? ' is-selected' : ''}">
                <div class="marker-box with-place">
                  <div class="marker-place">${nombre}</div>
                  <div class="marker-row">
                    <span class="marker-item"><span class="dot men"></span><span class="num">${m.hombres}</span></span>
                    <span class="marker-item"><span class="dot women"></span><span class="num">${m.mujeres}</span></span>
                  </div>
                </div>
              </div>`,
          })
        : L.divIcon({
            className: '',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            html: `<div class="place-pin${seleccionado ? ' is-selected' : ''}">${m.proyectos}</div>`,
          });

      const marker = L.marker([m.lat, m.lng], {
        icon,
        keyboard: true,
        title: m.label,
        zIndexOffset: seleccionado ? 1000 : 0,
      }).addTo(markersLayerRef.current);

      // Nombre del lugar: al pasar el cursor, y fijo en el lugar elegido con zoom bajo.
      marker.bindTooltip(`<strong>${nombre}</strong><br>${plural(m.proyectos, 'proyecto')}`, {
        direction: 'top',
        offset: zoomDetallado ? [70, -4] : [0, -16],
        permanent: seleccionado && !zoomDetallado,
        className: 'place-tooltip',
      });

      if (m.lugar !== null) {
        const lugar = m.lugar;
        marker.on('click', () => seleccionarLugarRef.current(lugar));
      } else if (m.projectId !== null) {
        const id = m.projectId;
        marker.on('click', () => setSearchParams({ proyecto: id }));
      }
    });
  }, [markers, mostrarDetalle, proyectoSeleccionado, lugarSeleccionado, zoomDetallado, setSearchParams]);

  // Encuadre al abrir el detalle de un proyecto (no en cada cambio de zoom).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mostrarDetalle || !proyectoSeleccionado) return;
    const pts = markers
      .filter((m) =>
        (m.projectId !== null && String(m.projectId) === String(proyectoSeleccionado.id)) ||
        (m.lugar !== null && proyectoSeleccionado.enMapa && m.lugar === proyectoSeleccionado.departamento))
      .map((m) => [m.lat, m.lng] as [number, number]);
    if (pts.length === 1) {
      map.setView(pts[0], ZOOM_DETALLE);
    } else if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts).pad(0.5));
    }
  }, [markers, mostrarDetalle, proyectoSeleccionado]);

  const restablecerMapa = () => {
    setSearchParams({});
    mapRef.current?.setView(VISTA_INICIAL.center, VISTA_INICIAL.zoom);
  };

  const nombreLugar = lugarSeleccionado === LUGAR_FUERA_DEL_MAPA ? 'Fuera del mapa' : lugarSeleccionado;

  return (
    <div className="dashboard-grid map-layout">
      <aside className="sidebar map-sidebar">
        {!mostrarDetalle ? (
          <div className="projects-list-container">
            <div className="section-header">
              {/* La lista incluye proyectos de todos los estados (cada tarjeta muestra el suyo). */}
              <h2 className="sidebar-title">Proyectos{!loadingData && !loadError ? ` (${projects.length})` : ''}</h2>
            </div>

            {lugarSeleccionado && !loadingData && !loadError ? (
              <div className="map-place-header" role="status">
                <div className="map-place-info">
                  <span className="map-place-kicker">
                    <MapPinned size={12} /> {lugarSeleccionado === LUGAR_FUERA_DEL_MAPA ? 'Sin marcador' : 'Lugar seleccionado'}
                  </span>
                  <h3 className="map-place-name">{nombreLugar}</h3>
                  <p className="map-place-meta">
                    {plural(proyectosVisibles.length, 'proyecto')}
                    {lugarSeleccionado === LUGAR_FUERA_DEL_MAPA
                      ? ' sin ubicación registrada o fuera de El Salvador'
                      : municipiosDelLugar.length > 0
                        ? ` · ${municipiosDelLugar.slice(0, 3).map(([m, n]) => `${m} (${n})`).join(', ')}${
                            municipiosDelLugar.length > 3 ? ` y ${plural(municipiosDelLugar.length - 3, 'municipio')} más` : ''}`
                        : ''}
                  </p>
                </div>
                <button className="map-place-clear" type="button" onClick={limpiarLugar} aria-label="Quitar filtro de lugar">
                  <X size={14} /> Ver todos
                </button>
              </div>
            ) : null}

            {loadingData ? <p className="muted" style={{ padding: '0 16px' }}>Cargando proyectos...</p> : null}
            {!loadingData && loadError ? (
              <div style={{ padding: '0 16px' }}>
                <Notice title="No se pudieron cargar los datos del mapa" onRetry={() => setReloadKey((k) => k + 1)}>
                  {loadError}
                </Notice>
              </div>
            ) : null}
            {/* Todo participante sin ubicación pertenece a un proyecto fuera del mapa: basta un aviso. */}
            {!loadingData && !loadError && !lugarSeleccionado && proyectosFueraDelMapa > 0 ? (
              <div style={{ padding: '0 16px' }}>
                <Notice variant="info" title="Hay proyectos sin ubicación en el mapa">
                  {plural(proyectosFueraDelMapa, 'proyecto')} no tiene{proyectosFueraDelMapa !== 1 ? 'n' : ''} un departamento de
                  El Salvador registrado{sinUbicacion > 0 ? ` (${plural(sinUbicacion, 'participante')})` : ''} y no
                  aparece{proyectosFueraDelMapa !== 1 ? 'n' : ''} en el mapa.{' '}
                  <button className="map-place-link" type="button" onClick={() => seleccionarLugar(LUGAR_FUERA_DEL_MAPA)}>
                    Ver proyectos
                  </button>
                </Notice>
              </div>
            ) : null}
            {!loadingData && !loadError && !lugarSeleccionado && projects.length > 0 ? (
              <p className="map-place-hint">Haga clic en un lugar del mapa para ver sus proyectos.</p>
            ) : null}

            <div className="sidebar-projects-list" ref={listaRef}>
              {!loadingData && !loadError && lugarSeleccionado && proyectosVisibles.length === 0 ? (
                <p className="muted" style={{ padding: '0 16px' }}>No hay proyectos registrados en este lugar.</p>
              ) : null}
              {proyectosVisibles.map((project) => {
                const generoData = getGeneroData(String(project.id));
                const estadoClass = clasificacionEstado[project.estado] ?? 'recruiting';
                const teamInitials = project.equipo.slice(0, 3).map((nombre) =>
                  nombre.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
                );
                const extraCount = project.personas > 3 ? project.personas - 3 : 0;

                return (
                  <article className="map-project-card" key={project.id}>
                    <div className="map-card-header">
                      <span className={`pill status ${estadoClass}`}>{project.estado}</span>
                      <span className="map-card-location">
                        <MapPinned size={11} />
                        {project.ubicacion || project.departamento || 'Sin ubicación'}
                      </span>
                    </div>

                    <p className="map-card-institution">{project.institucion.toUpperCase()}</p>
                    <h3 className="map-card-title">{project.titulo}</h3>
                    <p className="map-card-description">{project.descripcion || project.resumen}</p>

                    <div className="map-card-footer">
                      <div className="map-card-gender">
                        <span className="gender-item">
                          <span className="gender-dot men" />
                          Hombres: <strong>{generoData.hombres}</strong>
                        </span>
                        <span className="gender-item">
                          <span className="gender-dot women" />
                          Mujeres: <strong>{generoData.mujeres}</strong>
                        </span>
                      </div>
                      <div className="map-card-actions">
                        <div className="map-card-avatars">
                          {teamInitials.map((initials, i) => (
                            <span
                              key={initials + i}
                              className="map-avatar"
                              style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                              title={project.equipo[i]}
                            >
                              {initials}
                            </span>
                          ))}
                          {extraCount > 0 && (
                            <span className="map-avatar map-avatar-extra" style={{ marginLeft: '-8px' }}>
                              +{extraCount}
                            </span>
                          )}
                        </div>
                        <button
                          className="map-card-detail-link"
                          type="button"
                          onClick={() => abrirProyecto(String(project.id))}
                        >
                          Ver detalles
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <ProjectMapDetail
            project={proyectoSeleccionado}
            onReset={volverALista}
            projectDetail={projectDetail}
          />
        )}
      </aside>

      <section className="map-panel">
        <div className="map-toolbar">
          <div className="legend-pill">
            <span className="legend men" /> Hombres
            <span className="legend women" /> Mujeres
          </div>
        </div>
        <div className={`map-scene ${mostrarDetalle ? 'focused' : ''}`} style={{ transformOrigin: focoMapa, position: 'relative' }}>
          <div id="leaflet-map" className="map-iframe" style={{ position: 'absolute', inset: 0 }} />
          <div className="map-reset-floating">
            <button className="secondary-btn" type="button" onClick={restablecerMapa}>
              <ChevronLeft size={18} />
              Restablecer mapa
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


// ─── ProjectMapDetail ─────────────────────────────────────────────────────────
function ProjectMapDetail({
  project,
  onReset,
  projectDetail,
}: {
  project: ProyectoMapa;
  onReset: () => void;
  projectDetail: ProjectDetailResponse | null;
}) {
  const projectImage = project.imagen ?? (projectDetail?.imagen ?? null);

  const formatDate = (value: string | null | undefined) => {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  // ─── Contar géneros desde campo real de cada estudiante (no heurística de nombres)
  const { displayHombres, displayMujeres } = (() => {
    if (projectDetail?.estudiantes && projectDetail.estudiantes.length > 0) {
      let hombres = 0;
      let mujeres = 0;
      for (const s of projectDetail.estudiantes) {
        if (s.genero === 'Masculino') hombres++;
        else if (s.genero === 'Femenino') mujeres++;
      }
      return { displayHombres: hombres, displayMujeres: mujeres };
    }
    // Fallback: usar los conteos que vinieron del endpoint /projects/map
    return { displayHombres: project.hombres ?? 0, displayMujeres: project.mujeres ?? 0 };
  })();

  const estudiantesDetalle = projectDetail?.estudiantes ?? [];
  const equipoNombres = projectDetail?.equipo ?? project.equipo;

  return (
    <div className="projects-list-container animate-fade-in">
      <div className="section-header">
        <button onClick={onReset} className="back-link" type="button">
          <ChevronLeft size={16} />
          <span>Volver</span>
        </button>
      </div>

      <div className="stack-list cards-scroll sidebar-projects-list">
        <div className="project-detail-card-single">
          {projectImage ? (
            <div className="project-detail-hero">
              <img
                src={projectImage}
                alt={project.titulo}
                className="project-main-img"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          ) : null}

          <div className="detail-body">
            <span className="inst-name">
              {(projectDetail?.institution ?? project.institucion).toUpperCase()}
            </span>
            <h2 className="detail-title">{projectDetail?.titulo ?? project.titulo}</h2>

            <div className="detail-meta">
              <p><MapPinned size={14} /> {projectDetail?.ubicacion ?? project.ubicacion}</p>
              {projectDetail?.fechaInicio || projectDetail?.fechaCierre ? (
                <p>
                  <CalendarDays size={14} />
                  {' '}{formatDate(projectDetail.fechaInicio)} – {formatDate(projectDetail.fechaCierre)}
                </p>
              ) : null}
              <p>
                <Users size={14} />
                {' '}{projectDetail?.estudiantesAsignados ?? project.personas} estudiantes asignados
              </p>
            </div>

            {/* Bloque de género */}
            <div style={{ backgroundColor: '#f5f5f5', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>Estudiantes</p>
              <div style={{ display: 'flex', gap: '20px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#007bff' }} />
                  <strong>{displayHombres}</strong> Hombres
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#dc3545' }} />
                  <strong>{displayMujeres}</strong> Mujeres
                </span>
              </div>
            </div>

            <div className="detail-description">
              <h3>Acerca del proyecto</h3>
              <p>{projectDetail?.resumen ?? projectDetail?.descripcion ?? project.resumen}</p>
            </div>

            <div className="team-section">
              <div className="team-header">
                <h3>Equipo del proyecto</h3>
              </div>
              <div className="team-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {estudiantesDetalle.length > 0
                  ? estudiantesDetalle.map((student) => {
                    const initials = (student.nombre ?? '')
                      .split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
                    return (
                      <div
                        key={`${student.carnet}-${student.nombre}`}
                        style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 14px', borderRadius: 12, background: '#f8faff', border: '1px solid #e8edf8' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3972f0, #21c08a)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.78rem', fontWeight: 800, flexShrink: 0 }}>
                            {initials}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1c2433' }}>
                            {student.nombre}
                          </p>
                        </div>
                        <div style={{ height: 1, background: '#e8edf8', marginBottom: 8 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {student.carrera && <p style={{ margin: 0, fontSize: '0.76rem', color: '#687182', fontWeight: 600 }}>{student.carrera}</p>}
                          {student.carnet && <p style={{ margin: 0, fontSize: '0.73rem', color: '#9aa3b5' }}>Carnet: {student.carnet}</p>}
                          {student.email && <p style={{ margin: 0, fontSize: '0.70rem', color: '#9aa3b5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email}</p>}
                        </div>
                      </div>
                    );
                  })
                  : equipoNombres.map((member) => {
                    const initials = member.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div key={member} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#f8faff', border: '1px solid #e8edf8' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3972f0, #21c08a)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>{member}</p>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#687182' }}>Colaborador</p>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}