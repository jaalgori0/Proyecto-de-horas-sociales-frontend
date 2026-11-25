import { CalendarDays, ChevronLeft, MapPinned, Users, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clasificacionEstado } from '../data/proyectos';
import { origenProyecto, type ProyectoMapa } from '../types';
import { Notice } from '../components/ui';
import {
  describeApiError,
  getMapMarkers,
  getProjectsForMap,
  getGenderByMunicipio,
  type ProjectDetailResponse,
} from '../services/api';
import { coordenadasDepartamentos } from '../data/departamentos';
import { coordenadasMunicipio } from '../data/municipios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';


function normalizeVisibleStatus(status?: string | null): ProyectoMapa['estado'] {
  if (status === 'Cerrado') return 'Cerrado';
  if (status === 'Activo') return 'Activo';
  return 'En progreso';
}

/** Valor de `?lugar=` para los proyectos sin marcador (sin ubicación, extranjeros o no reconocidos). */
const LUGAR_FUERA_DEL_MAPA = 'fuera-del-mapa';
/** Valor de `?municipio=` (y etiqueta) para los proyectos sin municipio registrado. */
const SIN_MUNICIPIO = 'Sin municipio';
const VISTA_INICIAL = { center: [13.7, -88.9] as [number, number], zoom: 8 };
/** Desde este zoom los marcadores muestran el desglose por género; antes, un pin compacto (no se solapan). */
const ZOOM_DETALLE = 10;

/**
 * Marcador pintado en el mapa. Los departamentos son los grupos "padre"; municipios y
 * proyectos (con coordenadas propias en `map_markers`) son sus hijos: aparecen al cruzar
 * ZOOM_DETALLE desplegándose desde el centroide del departamento.
 */
type MapMarker = {
  id: string;
  tipo: 'departamento' | 'municipio' | 'proyecto';
  /** Proyecto que abre el clic (pin de proyecto, o municipio con un solo proyecto). */
  projectId: string | null;
  /** Proyectos que representa el pin (para mostrarlo en el detalle de un proyecto). */
  proyectoIds: string[];
  /** Departamento: en el padre es la clave del filtro `?lugar=`; en los hijos, el padre del que se despliegan. */
  departamento: string;
  label: string;
  proyectos: number;
  hombres: number;
  mujeres: number;
  lat: number;
  lng: number;
  /** Solo padres: con zoom de detalle cede su lugar a sus hijos (todos sus proyectos tienen coordenadas). */
  reemplazable: boolean;
};

/** Ubicación sin coordenadas registradas: sus proyectos no se despliegan como pin propio. */
type CoordenadaFaltante = {
  nivel: 'departamento' | 'municipio' | 'marcador';
  lugar: string;
  departamento: string;
  proyectos: string[];
};

/** Duración del vuelo centroide ↔ posición real (coincide con `.cluster-anim-*` en styles.css). */
const DURACION_DESPLIEGUE_MS = 450;

/** Marcador de Leaflet reutilizable entre renders, con lo necesario para saber qué cambió. */
type RegistroMarcador = {
  marker: L.Marker;
  /** Pin que representa ahora (el clic lo lee aquí, así nunca usa datos viejos). */
  pin: PinVisible;
  iconSig: string;
  tooltipSig: string;
  visible: boolean;
  /** Termina de inmediato la animación en curso (deja el marcador en su estado final). */
  terminarAnimacion: (() => void) | null;
};

/**
 * Pin que se pinta realmente a un zoom dado: un marcador, o un grupo de hijos cuyas cajas
 * chocarían en pantalla (se separan al acercar, como un clúster).
 */
type PinVisible = {
  id: string;
  tipo: MapMarker['tipo'] | 'grupo';
  /** Marcador ancla: el propio, o en un grupo el hijo con más proyectos (da nombre y posición). */
  base: MapMarker;
  miembros: MapMarker[];
  label: string;
  proyectos: number;
  hombres: number;
  mujeres: number;
  /** Posición en el mapa; en los departamentos puede ir desplazada para no encimarse. */
  pos: L.LatLng;
};

// ─── Reglas de colisión (en píxeles de pantalla, recalculadas en cada zoom) ─────────────
/** Pin compacto de zoom bajo: círculo de 34px centrado en su coordenada (+ aire entre pines). */
const DISTANCIA_MIN_PINES = 34 + 8;
/** Caja de género (zoom de detalle): sin iconSize, Leaflet la ancla 6px arriba-izquierda. */
const ALTO_CAJA = 54;
const MARGEN_CAJAS = 6;
const anchoCaja = (label: string) => Math.min(260, Math.max(150, label.length * 8.4 + 22));
type Rect = { x1: number; y1: number; x2: number; y2: number };
const rectCaja = (p: L.Point, label: string): Rect =>
  ({ x1: p.x - 6, y1: p.y - 6, x2: p.x - 6 + anchoCaja(label), y2: p.y - 6 + ALTO_CAJA });
const chocan = (a: Rect, b: Rect) =>
  a.x1 < b.x2 + MARGEN_CAJAS && b.x1 < a.x2 + MARGEN_CAJAS && a.y1 < b.y2 + MARGEN_CAJAS && b.y1 < a.y2 + MARGEN_CAJAS;

const pinDe = (m: MapMarker, pos = L.latLng(m.lat, m.lng)): PinVisible => ({
  id: m.id, tipo: m.tipo, base: m, miembros: [m], label: m.label,
  proyectos: m.proyectos, hombres: m.hombres, mujeres: m.mujeres, pos,
});

/**
 * Agrupa los hijos cuyas cajas chocarían al zoom dado. Greedy por prioridad (más proyectos
 * primero): cada hijo se une al primer grupo con el que choca; luego se fusionan los grupos
 * que, ya con su etiqueta "+N", choquen entre sí.
 */
function agruparPorColision(map: L.Map, hijos: MapMarker[], zoom: number): PinVisible[] {
  type Grupo = { ancla: MapMarker; miembros: MapMarker[]; p: L.Point };
  const etiqueta = (g: Grupo) => (g.miembros.length > 1 ? `${g.ancla.label} +${g.miembros.length - 1}` : g.ancla.label);
  const orden = [...hijos].sort((a, b) => b.proyectos - a.proyectos || a.label.localeCompare(b.label, 'es'));
  const grupos: Grupo[] = [];
  for (const h of orden) {
    const p = map.project([h.lat, h.lng], zoom);
    const g = grupos.find((x) => chocan(rectCaja(x.p, etiqueta(x)), rectCaja(p, h.label)));
    if (g) g.miembros.push(h);
    else grupos.push({ ancla: h, miembros: [h], p });
  }
  for (let fusiono = true; fusiono;) {
    fusiono = false;
    buscar: for (let i = 0; i < grupos.length; i++) {
      for (let j = i + 1; j < grupos.length; j++) {
        if (chocan(rectCaja(grupos[i]!.p, etiqueta(grupos[i]!)), rectCaja(grupos[j]!.p, etiqueta(grupos[j]!)))) {
          grupos[i]!.miembros.push(...grupos[j]!.miembros);
          grupos.splice(j, 1);
          fusiono = true;
          break buscar;
        }
      }
    }
  }
  return grupos.map((g) => {
    if (g.miembros.length === 1) return pinDe(g.ancla);
    const suma = (k: 'proyectos' | 'hombres' | 'mujeres') => g.miembros.reduce((n, m) => n + m[k], 0);
    return {
      id: `grupo-${g.ancla.id}`, tipo: 'grupo', base: g.ancla, miembros: g.miembros, label: etiqueta(g),
      proyectos: suma('proyectos'), hombres: suma('hombres'), mujeres: suma('mujeres'),
      pos: L.latLng(g.ancla.lat, g.ancla.lng),
    };
  });
}

/**
 * Separa los pines compactos que se encimarían al zoom dado (p. ej. San Salvador y La
 * Libertad con zoom bajo): repulsión mínima en píxeles, sin agrupar (cada departamento
 * sigue siendo su propio pin y su propio filtro).
 */
function separarPines(map: L.Map, pines: PinVisible[], zoom: number): PinVisible[] {
  const pts = pines.map((p) => map.project(p.pos, zoom));
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    let movio = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j]!.x - pts[i]!.x;
        let dy = pts[j]!.y - pts[i]!.y;
        let d = Math.hypot(dx, dy);
        if (d >= DISTANCIA_MIN_PINES) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const empuje = (DISTANCIA_MIN_PINES - d) / 2 + 0.5;
        pts[i] = L.point(pts[i]!.x - (dx / d) * empuje, pts[i]!.y - (dy / d) * empuje);
        pts[j] = L.point(pts[j]!.x + (dx / d) * empuje, pts[j]!.y + (dy / d) * empuje);
        movio = true;
      }
    }
    if (!movio) break;
  }
  return pines.map((p, i) => ({ ...p, pos: map.unproject(pts[i]!, zoom) }));
}

const prefiereMenosMovimiento = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Coordenada utilizable: números finitos y no el (0,0) que dejan los datos vacíos. */
const coordenadaValida = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

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
  const [zoom, setZoom] = useState(VISTA_INICIAL.zoom);
  const zoomDetallado = zoom >= ZOOM_DETALLE;

  const proyectoId = searchParams.get('proyecto') ?? String(projects[0]?.id ?? '');
  const proyectoSeleccionado = projects.find((p) => String(p.id) === proyectoId) ?? projects[0];
  const mostrarDetalle = searchParams.has('proyecto');
  const lugarSeleccionado = searchParams.get('lugar');
  /** Municipio dentro del departamento elegido (`?municipio=`); solo tiene sentido con `?lugar=`. */
  const municipioSeleccionado = lugarSeleccionado && lugarSeleccionado !== LUGAR_FUERA_DEL_MAPA
    ? searchParams.get('municipio')
    : null;

  // ─── Navegación: el lugar elegido se conserva al abrir y cerrar el detalle de un proyecto.
  const filtroLugar = (): Record<string, string> =>
    lugarSeleccionado
      ? { lugar: lugarSeleccionado, ...(municipioSeleccionado ? { municipio: municipioSeleccionado } : {}) }
      : {};
  const seleccionarLugar = (lugar: string) => setSearchParams({ lugar });
  const seleccionarMunicipio = (lugar: string, municipio: string) => setSearchParams({ lugar, municipio });
  const limpiarLugar = () => setSearchParams({});
  const abrirProyecto = (id: string) => setSearchParams({ ...filtroLugar(), proyecto: id });
  const volverALista = () => setSearchParams(filtroLugar());

  /** Proyectos del departamento elegido (sin aplicar el municipio: de aquí salen los chips). */
  const proyectosDelLugar = useMemo(() => {
    if (!lugarSeleccionado) return projects;
    if (lugarSeleccionado === LUGAR_FUERA_DEL_MAPA) return projects.filter((p) => !p.enMapa);
    return projects.filter((p) => p.departamento === lugarSeleccionado);
  }, [projects, lugarSeleccionado]);

  const proyectosVisibles = useMemo(() => {
    if (!municipioSeleccionado) return proyectosDelLugar;
    return proyectosDelLugar.filter((p) => (p.municipio ?? SIN_MUNICIPIO) === municipioSeleccionado);
  }, [proyectosDelLugar, municipioSeleccionado]);

  const proyectosFueraDelMapa = useMemo(() => projects.filter((p) => !p.enMapa).length, [projects]);

  /** Municipios del lugar elegido, de más a menos proyectos (chips de filtro del encabezado). */
  const municipiosDelLugar = useMemo(() => {
    if (!lugarSeleccionado || lugarSeleccionado === LUGAR_FUERA_DEL_MAPA) return [];
    const conteo = new Map<string, number>();
    for (const p of proyectosDelLugar) {
      const nombre = p.municipio ?? SIN_MUNICIPIO;
      conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    }
    return [...conteo].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  }, [proyectosDelLugar, lugarSeleccionado]);

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
  const clicPinRef = useRef<(pin: PinVisible) => void>(() => {});
  clicPinRef.current = (pin: PinVisible) => {
    const map = mapRef.current as L.Map | null;
    switch (pin.tipo) {
      case 'departamento':
        return seleccionarLugar(pin.base.departamento);
      case 'municipio':
        // Igual que el chip del panel: filtra la lista a los proyectos de ese municipio.
        return seleccionarMunicipio(pin.base.departamento, pin.base.label);
      case 'proyecto':
        return pin.base.projectId ? abrirProyecto(pin.base.projectId) : undefined;
      case 'grupo': {
        // Como un clúster: acercar hasta que el grupo se separe. Si ya no se puede acercar
        // más (mismas coordenadas), se filtra por el departamento del ancla.
        if (!map) return;
        const limites = L.latLngBounds(pin.miembros.map((m) => L.latLng(m.lat, m.lng)));
        const actual = map.getZoom();
        const destino = Math.min(map.getMaxZoom(), Math.max(map.getBoundsZoom(limites.pad(0.6)), actual + 1));
        if (destino > actual) map.setView(limites.getCenter(), destino);
        else seleccionarLugar(pin.base.departamento);
        return;
      }
    }
  };
  // Marcadores vivos por id de pin: se reutilizan entre zooms (conservan tooltip, clic y posición).
  const registroRef = useRef(new Map<string, RegistroMarcador>());
  // Zoom aplicado en la última sincronización: para detectar cambios y el cruce del umbral.
  const zoomPrevioRef = useRef(zoom);
  // Dónde se veía cada marcador (su pin, su grupo o su departamento): origen/destino del vuelo.
  const contenedorRef = useRef(new Map<string, L.LatLng>());
  // Ubicaciones sin coordenadas de la última carga; se avisan una vez, al primer despliegue.
  const faltantesRef = useRef<CoordenadaFaltante[]>([]);
  const advertidoRef = useRef(false);

  // Al cambiar de lugar, la lista vuelve arriba.
  useEffect(() => {
    listaRef.current?.scrollTo({ top: 0 });
  }, [lugarSeleccionado, municipioSeleccionado]);

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
          origen: origenProyecto(project),
        }));

        // ─── Validación de coordenadas: lo que no tenga ubicación se reporta (no se inventa).
        const faltantes = new Map<string, CoordenadaFaltante>();
        const anotarFaltante = (nivel: CoordenadaFaltante['nivel'], lugar: string, departamento: string, proyecto: string) => {
          const clave = `${nivel}|${departamento}|${lugar}`;
          const f = faltantes.get(clave) ?? { nivel, lugar, departamento, proyectos: [] };
          f.proyectos.push(proyecto);
          faltantes.set(clave, f);
        };
        /** Departamentos con algún proyecto que no puede desplegarse: su pin padre no se retira. */
        const deptosIncompletos = new Set<string>();

        apiProjects.forEach((project, i) => {
          if (project.enMapa && !coordenadasDepartamentos[project.departamento]) {
            anotarFaltante('departamento', project.departamento, project.departamento, mappedProjects[i]!.titulo);
          }
        });

        // Hijos 1: proyectos con coordenadas propias (tabla map_markers).
        const proyectoPorId = new Map(mappedProjects.map((p) => [String(p.id), p]));
        const projectMarkers: MapMarker[] = [];
        for (const marker of apiMarkers) {
          if (marker.projectId === null) continue;
          const proyecto = proyectoPorId.get(String(marker.projectId));
          const lat = Number(marker.lat);
          const lng = Number(marker.lng);
          const depto = proyecto?.enMapa ? proyecto.departamento : undefined;
          if (!proyecto || !depto) continue; // fuera del mapa: se lista en "Fuera del mapa"
          if (!coordenadaValida(lat, lng)) {
            anotarFaltante('marcador', marker.label, depto, proyecto.titulo);
            continue;
          }
          projectMarkers.push({
            id: String(marker.id),
            tipo: 'proyecto',
            projectId: String(marker.projectId),
            proyectoIds: [String(marker.projectId)],
            departamento: depto,
            label: marker.label,
            proyectos: 1,
            hombres: Number(marker.hombres ?? 0),
            mujeres: Number(marker.mujeres ?? 0),
            lat,
            lng,
            reemplazable: false,
          });
        }
        const conPinPropio = new Set(projectMarkers.flatMap((m) => m.proyectoIds));

        // Hijos 2: el resto de proyectos, agrupados por municipio.
        const porMunicipio = new Map<string, MapMarker>();
        for (const p of mappedProjects) {
          const depto = p.enMapa ? p.departamento : undefined;
          if (!depto || conPinPropio.has(String(p.id))) continue;
          const coords = p.municipio ? coordenadasMunicipio(p.municipio, depto) : undefined;
          if (!p.municipio || !coords) {
            anotarFaltante('municipio', p.municipio ?? '(sin municipio registrado)', depto, p.titulo);
            deptosIncompletos.add(depto);
            continue;
          }
          const clave = `${depto}|${p.municipio}`;
          const grupo: MapMarker = porMunicipio.get(clave) ?? {
            id: `muni-${clave}`,
            tipo: 'municipio',
            projectId: null,
            proyectoIds: [],
            departamento: depto,
            label: p.municipio,
            proyectos: 0,
            hombres: 0,
            mujeres: 0,
            lat: coords.lat,
            lng: coords.lng,
            reemplazable: false,
          };
          grupo.proyectoIds.push(String(p.id));
          grupo.proyectos += 1;
          grupo.hombres += p.hombres ?? 0;
          grupo.mujeres += p.mujeres ?? 0;
          porMunicipio.set(clave, grupo);
        }
        const municipioMarkers = [...porMunicipio.values()].map((m) => ({
          ...m,
          projectId: m.proyectoIds.length === 1 ? m.proyectoIds[0]! : null,
        }));
        const hijos = [...projectMarkers, ...municipioMarkers];
        const deptosConHijos = new Set(hijos.map((m) => m.departamento));

        // Padres: todo departamento con proyectos o con participantes.
        const proyectosPorDepto = new Map<string, number>();
        for (const p of mappedProjects) {
          if (p.enMapa && p.departamento) proyectosPorDepto.set(p.departamento, (proyectosPorDepto.get(p.departamento) ?? 0) + 1);
        }
        const generoPorDepto = new Map(apiGeneroMunicipio.map((row) => [row.municipio, row]));
        const departmentMarkers: MapMarker[] = Object.entries(coordenadasDepartamentos)
          .filter(([depto]) => proyectosPorDepto.has(depto) || generoPorDepto.has(depto))
          .map(([depto, coords]) => ({
            id: `depto-${depto}`,
            tipo: 'departamento',
            projectId: null,
            proyectoIds: [],
            departamento: depto,
            label: depto,
            proyectos: proyectosPorDepto.get(depto) ?? 0,
            hombres: generoPorDepto.get(depto)?.hombres ?? 0,
            mujeres: generoPorDepto.get(depto)?.mujeres ?? 0,
            lat: coords.lat,
            lng: coords.lng,
            reemplazable: deptosConHijos.has(depto) && !deptosIncompletos.has(depto),
          }));

        faltantesRef.current = [...faltantes.values()];
        advertidoRef.current = false;
        const mappedMarkers = [...departmentMarkers, ...hijos];

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

    // Con zoom bajo solo se ven departamentos; desde ZOOM_DETALLE aparecen los proyectos.
    // En cada zoom se recalcula la densidad (separación y agrupación de pines).
    map.on('zoomend', () => setZoom(map.getZoom()));
    // Si empieza otro zoom a mitad del despliegue, la transición CSS desfasaría los pines
    // respecto al zoom animado de Leaflet: se terminan en seco antes de que arranque.
    const terminarAnimaciones = () => registroRef.current.forEach((r) => r.terminarAnimacion?.());
    map.on('zoomstart', terminarAnimaciones);

    return () => {
      try {
        terminarAnimaciones();
        registroRef.current.clear();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch { /* ignore */ }
    };
  }, []);

  // Sincronizar marcadores con la selección y el zoom. En cada zoom se calcula qué pines se
  // ven (padres, hijos o grupos de hijos que chocarían) y dónde; los marcadores de Leaflet
  // se reutilizan por id de pin. Cada pin que aparece vuela desde donde se veía su marcador
  // ancla (centroide del departamento o grupo que se separa) y cada pin que se va vuela
  // hacia su nuevo contenedor (el grupo que lo absorbe o su departamento).
  useEffect(() => {
    const map = mapRef.current as L.Map | null;
    if (!map || !L?.layerGroup) return;
    if (!markersLayerRef.current) markersLayerRef.current = L.layerGroup().addTo(map);
    const capa = markersLayerRef.current as L.LayerGroup;
    const registro = registroRef.current;
    const contenedor = map.getContainer();

    const zoomPrevio = zoomPrevioRef.current;
    zoomPrevioRef.current = zoom;
    const animar = zoomPrevio !== zoom && !prefiereMenosMovimiento();

    // Aviso de coordenadas faltantes: una vez por carga, en el primer despliegue.
    if (zoomPrevio < ZOOM_DETALLE && zoomDetallado && !advertidoRef.current && faltantesRef.current.length > 0) {
      advertidoRef.current = true;
      const faltantes = faltantesRef.current;
      const totalProyectos = faltantes.reduce((n, f) => n + f.proyectos.length, 0);
      console.warn(
        `[Mapa] ${faltantes.length} ubicación(es) sin coordenadas registradas (${plural(totalProyectos, 'proyecto')}). ` +
        'No se despliegan como pin propio (siguen contados en su departamento). ' +
        'Agrega los municipios en src/data/municipios.ts y los departamentos en src/data/departamentos.ts.',
      );
      console.table(faltantes.map((f) => ({
        nivel: f.nivel,
        lugar: f.lugar,
        departamento: f.departamento,
        proyectos: f.proyectos.length,
        ejemplos: f.proyectos.slice(0, 3).join(' · '),
      })));
    }

    // ─── 1. Qué marcadores corresponden a esta vista.
    const enDetalle = mostrarDetalle && proyectoSeleccionado;
    const corresponde = (m: MapMarker): boolean => {
      if (enDetalle) {
        // En el detalle: el pin del proyecto (a cualquier zoom) y el de su departamento.
        if (m.tipo !== 'departamento') return m.proyectoIds.includes(String(proyectoSeleccionado.id));
        return Boolean(proyectoSeleccionado.enMapa) && m.departamento === proyectoSeleccionado.departamento;
      }
      // Fuera del detalle: con zoom bajo solo padres; con zoom de detalle, los hijos
      // (y los padres que no pueden ceder su lugar porque les faltan coordenadas).
      if (m.tipo === 'departamento') return !(zoomDetallado && m.reemplazable);
      return zoomDetallado;
    };
    const padres = markers.filter((m) => m.tipo === 'departamento' && corresponde(m));
    const hijos = markers.filter((m) => m.tipo !== 'departamento' && corresponde(m));

    // ─── 2. Densidad: separar pines compactos y agrupar cajas que chocarían.
    const pinesPadres = zoomDetallado ? padres.map((m) => pinDe(m)) : separarPines(map, padres.map((m) => pinDe(m)), zoom);
    const pinesHijos = zoomDetallado ? agruparPorColision(map, hijos, zoom) : hijos.map((m) => pinDe(m));
    const pines = [...pinesPadres, ...pinesHijos];

    // Dónde queda representado cada marcador en esta vista (para animar la próxima).
    const contenedorPrevio = contenedorRef.current;
    const contenedorNuevo = new Map<string, L.LatLng>();
    for (const pin of pines) for (const m of pin.miembros) contenedorNuevo.set(m.id, pin.pos);
    const posDepto = new Map(pinesPadres.map((p) => [p.base.departamento, p.pos]));
    for (const m of markers) {
      const pos = m.tipo !== 'departamento' && !contenedorNuevo.has(m.id) ? posDepto.get(m.departamento) : undefined;
      if (pos) contenedorNuevo.set(m.id, pos);
    }
    contenedorRef.current = contenedorNuevo;

    // ─── 3. Animaciones.
    const iniciarAnimacion = (r: RegistroMarcador, el: HTMLElement, clase: string, alTerminar: () => void) => {
      // Mientras dure, los tooltips se ocultan (ver `.clusters-animando` en styles.css).
      contenedor.classList.add('clusters-animando');
      let hecho = false;
      const timer = window.setTimeout(() => terminar(), DURACION_DESPLIEGUE_MS + 80);
      const terminar = () => {
        if (hecho) return;
        hecho = true;
        window.clearTimeout(timer);
        el.classList.remove(clase);
        r.terminarAnimacion = null;
        alTerminar();
        if (![...registro.values()].some((x) => x.terminarAnimacion)) contenedor.classList.remove('clusters-animando');
      };
      r.terminarAnimacion = terminar;
    };

    /** Lleva el marcador de (`desde`, opacidad inicial) a (`hasta`, opacidad final) con la clase `clase`. */
    const transicionar = (
      r: RegistroMarcador,
      paso: { desde: L.LatLng; hasta: L.LatLng; opacidad: [number, number]; clase: string; alTerminar?: () => void },
    ) => {
      r.marker.setLatLng(paso.desde).setOpacity(paso.opacidad[0]);
      if (!capa.hasLayer(r.marker)) capa.addLayer(r.marker);
      const el = r.marker.getElement();
      if (!el) {
        r.marker.setLatLng(paso.hasta).setOpacity(paso.opacidad[1]);
        paso.alTerminar?.();
        return;
      }
      r.marker.closeTooltip();
      void el.offsetWidth; // fija el punto de partida antes de activar la transición
      el.classList.add(paso.clase);
      r.marker.setLatLng(paso.hasta).setOpacity(paso.opacidad[1]);
      iniciarAnimacion(r, el, paso.clase, paso.alTerminar ?? (() => {}));
    };

    const quitar = (r: RegistroMarcador) => {
      capa.removeLayer(r.marker);
      r.marker.setOpacity(1);
    };

    const entrar = (r: RegistroMarcador) => {
      const destino = r.pin.pos;
      const origen = contenedorPrevio.get(r.pin.base.id);
      if (!animar) {
        r.marker.setLatLng(destino).setOpacity(1);
        capa.addLayer(r.marker);
      } else if (origen && !origen.equals(destino)) {
        transicionar(r, { desde: origen, hasta: destino, opacidad: [0, 1], clase: 'cluster-anim-entrada' });
      } else {
        // Sin recorrido (ya estaba ahí, p. ej. un grupo que se forma): aparece cuando llegan los demás.
        transicionar(r, { desde: destino, hasta: destino, opacidad: [0, 1], clase: 'cluster-anim-aparecer' });
      }
    };

    const salir = (r: RegistroMarcador) => {
      const actual = r.marker.getLatLng();
      const destino = contenedorNuevo.get(r.pin.base.id);
      if (!animar) return quitar(r);
      if (destino && !destino.equals(actual)) {
        transicionar(r, {
          desde: actual, hasta: destino, opacidad: [1, 0], clase: 'cluster-anim-salida', alTerminar: () => quitar(r),
        });
      } else {
        transicionar(r, {
          desde: actual, hasta: actual, opacidad: [1, 0], clase: 'cluster-anim-desvanecer', alTerminar: () => quitar(r),
        });
      }
    };

    // ─── 4. Reconciliar con los marcadores vivos.
    const deseados = new Set(pines.map((p) => p.id));
    for (const [id, r] of registro) {
      if (deseados.has(id)) continue;
      if (r.visible) {
        r.terminarAnimacion?.();
        salir(r);
        r.visible = false;
      } else if (!r.terminarAnimacion) {
        capa.removeLayer(r.marker);
        registro.delete(id);
      }
    }

    const estaSeleccionado = (m: MapMarker) =>
      m.departamento === lugarSeleccionado &&
      (m.tipo === 'departamento' || !municipioSeleccionado || m.label === municipioSeleccionado);

    for (const pin of pines) {
      const seleccionado = pin.miembros.some(estaSeleccionado);
      const nombre = escapeHtml(pin.label);
      const iconHtml = zoomDetallado
        ? `
              <div class="gender-marker${seleccionado ? ' is-selected' : ''}${pin.tipo === 'grupo' ? ' is-group' : ''}">
                <div class="marker-box with-place">
                  <div class="marker-place">${nombre}</div>
                  <div class="marker-row">
                    <span class="marker-item"><span class="dot men"></span><span class="num">${pin.hombres}</span></span>
                    <span class="marker-item"><span class="dot women"></span><span class="num">${pin.mujeres}</span></span>
                  </div>
                </div>
              </div>`
        : `<div class="place-pin${seleccionado ? ' is-selected' : ''}">${pin.proyectos}</div>`;
      const icon = zoomDetallado
        ? L.divIcon({ className: '', html: iconHtml })
        : L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: iconHtml });

      let r = registro.get(pin.id);
      if (!r) {
        const marker = L.marker(pin.pos, { icon, keyboard: true, title: pin.label });
        const nuevo: RegistroMarcador = { marker, pin, iconSig: iconHtml, tooltipSig: '', visible: false, terminarAnimacion: null };
        marker.on('click', () => clicPinRef.current(nuevo.pin));
        registro.set(pin.id, nuevo);
        r = nuevo;
      } else if (r.iconSig !== iconHtml) {
        // Cambiar el ícono reemplaza el elemento: una animación en curso quedaría a medias.
        r.terminarAnimacion?.();
        r.marker.setIcon(icon);
        r.iconSig = iconHtml;
      }
      r.pin = pin;
      r.marker.setZIndexOffset(seleccionado ? 1000 : pin.tipo === 'grupo' ? 500 : 0);

      // Nombre del lugar: al pasar el cursor, y fijo en el departamento elegido con zoom bajo.
      const permanente = pin.tipo === 'departamento' && seleccionado && !zoomDetallado;
      const departamentos = [...new Set(pin.miembros.map((m) => m.departamento))].join(', ');
      const tooltipHtml = pin.tipo === 'departamento'
        ? `<strong>${nombre}</strong><br>${plural(pin.proyectos, 'proyecto')}`
        : pin.tipo === 'grupo'
          ? `<strong>${escapeHtml(pin.miembros.slice(0, 4).map((m) => m.label).join(', '))}${
              pin.miembros.length > 4 ? ` y ${pin.miembros.length - 4} más` : ''}</strong><br>${
              escapeHtml(departamentos)} · ${plural(pin.proyectos, 'proyecto')} · clic para acercar`
          : `<strong>${nombre}</strong><br>${escapeHtml(departamentos)} · ${plural(pin.proyectos, 'proyecto')}`;
      const tooltipSig = `${zoomDetallado}|${permanente}|${tooltipHtml}`;
      if (r.tooltipSig !== tooltipSig) {
        r.marker.unbindTooltip().bindTooltip(tooltipHtml, {
          direction: 'top',
          offset: zoomDetallado ? [70, -4] : [0, -16],
          permanent: permanente,
          className: 'place-tooltip',
        });
        r.tooltipSig = tooltipSig;
      }

      if (!r.visible) {
        r.terminarAnimacion?.();
        entrar(r);
        r.visible = true;
      } else if (!r.marker.getLatLng().equals(pin.pos)) {
        // Sigue visible pero cambió de sitio (separación de pines a otro zoom): se desliza.
        r.terminarAnimacion?.();
        if (animar) transicionar(r, { desde: r.marker.getLatLng(), hasta: pin.pos, opacidad: [1, 1], clase: 'cluster-anim-entrada' });
        else r.marker.setLatLng(pin.pos);
      }
    }
  }, [markers, mostrarDetalle, proyectoSeleccionado, lugarSeleccionado, municipioSeleccionado, zoom, zoomDetallado]);

  // Encuadre al abrir el detalle de un proyecto (no en cada cambio de zoom).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mostrarDetalle || !proyectoSeleccionado) return;
    const pts = markers
      .filter((m) => m.tipo === 'departamento'
        ? Boolean(proyectoSeleccionado.enMapa) && m.departamento === proyectoSeleccionado.departamento
        : m.proyectoIds.includes(String(proyectoSeleccionado.id)))
      .map((m) => [m.lat, m.lng] as [number, number]);
    if (pts.length === 1) {
      map.setView(pts[0], ZOOM_DETALLE);
    } else if (pts.length > 1) {
      // maxZoom: si el municipio coincide con el centroide, los límites serían un punto.
      map.fitBounds(L.latLngBounds(pts).pad(0.5), { maxZoom: ZOOM_DETALLE + 2 });
    }
  }, [markers, mostrarDetalle, proyectoSeleccionado]);

  const restablecerMapa = () => {
    setSearchParams({});
    mapRef.current?.setView(VISTA_INICIAL.center, VISTA_INICIAL.zoom);
  };

  const nombreLugar = lugarSeleccionado === LUGAR_FUERA_DEL_MAPA ? 'Fuera del mapa' : municipioSeleccionado ?? lugarSeleccionado;

  return (
    <div className="dashboard-grid map-layout">
      <aside className="sidebar map-sidebar">
        {!mostrarDetalle ? (
          <div className="projects-list-container">
            <div className="section-header">
              {/* La lista incluye proyectos de todos los estados (cada tarjeta muestra el suyo). */}
              <h2 className="sidebar-title">
                Proyectos{!loadingData && !loadError ? ` (${projects.length})` : ''}
              </h2>
              {!loadingData && !loadError && projects.some((p) => p.origen !== undefined) ? (
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}
                  title="Se muestran todos los proyectos (también los que solo aparecen en los reportes de horas y el interno)">
                  {projects.filter((p) => p.origen === 'REPORTE_CSS').length} del reporte CSS
                </p>
              ) : null}
            </div>

            {lugarSeleccionado && !loadingData && !loadError ? (
              <div className="map-place-header" role="status">
                <div className="map-place-info">
                  <span className="map-place-kicker">
                    <MapPinned size={12} />{' '}
                    {lugarSeleccionado === LUGAR_FUERA_DEL_MAPA
                      ? 'Sin marcador'
                      : municipioSeleccionado ? `Municipio · ${lugarSeleccionado}` : 'Lugar seleccionado'}
                  </span>
                  <h3 className="map-place-name">{nombreLugar}</h3>
                  <p className="map-place-meta">
                    {plural(proyectosVisibles.length, 'proyecto')}
                    {lugarSeleccionado === LUGAR_FUERA_DEL_MAPA ? ' sin ubicación registrada o fuera de El Salvador' : ''}
                  </p>
                  {/* Mismo filtro que el clic en un pin de municipio del mapa. */}
                  {lugarSeleccionado !== LUGAR_FUERA_DEL_MAPA && municipiosDelLugar.length > 1 ? (
                    <div className="map-place-chips" role="group" aria-label="Filtrar por municipio">
                      <button
                        type="button"
                        className={`map-place-chip${municipioSeleccionado ? '' : ' is-active'}`}
                        aria-pressed={!municipioSeleccionado}
                        onClick={() => seleccionarLugar(lugarSeleccionado)}
                      >
                        Todos ({proyectosDelLugar.length})
                      </button>
                      {municipiosDelLugar.map(([municipio, n]) => (
                        <button
                          key={municipio}
                          type="button"
                          className={`map-place-chip${municipio === municipioSeleccionado ? ' is-active' : ''}`}
                          aria-pressed={municipio === municipioSeleccionado}
                          onClick={() => seleccionarMunicipio(lugarSeleccionado, municipio)}
                        >
                          {municipio} ({n})
                        </button>
                      ))}
                    </div>
                  ) : null}
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
            <div className="project-detail-media">
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
                {' '}{projectDetail?.estudiantesAsignados ?? project.personas} participaciones (incluye abandonos)
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
