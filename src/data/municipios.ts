/**
 * Geografía municipal de El Salvador para el mapa: los 44 municipios oficiales de la
 * reestructuración de 2024 (Ley Especial para la Reestructuración Municipal), cada uno con
 * su departamento, sus distritos (los 262 municipios tradicionales) y un centro urbano de
 * referencia para pintar su pin.
 *
 * La API devuelve `municipio` con el nombre TRADICIONAL (hoy distrito: "Santa Tecla",
 * "Comasagua"…), porque así se escriben las ubicaciones y así las resuelve el backend
 * (src/modules/shared/geo-el-salvador.ts). Por eso la búsqueda acepta ambos niveles:
 *   1. distrito con coordenadas propias (COORDENADAS_DISTRITO): la posición más precisa;
 *   2. cualquier otro distrito: el centro de referencia de su municipio oficial;
 *   3. el nombre de un municipio oficial ("La Libertad Sur"): su centro de referencia.
 *
 * Todas las coordenadas son aproximadas (centro urbano). `referencia` es el distrito cuyo
 * centro se usa para el municipio (normalmente su cabecera); revísalo si se necesita
 * precisión cartográfica.
 */

export type MunicipioOficial = {
  nombre: string;
  departamento: string;
  /** Distrito cuyo centro urbano se usa como posición del municipio. */
  referencia: string;
  lat: number;
  lng: number;
  /** Distritos que lo forman (municipios tradicionales, previos a 2024). */
  distritos: readonly string[];
};

export const MUNICIPIOS_EL_SALVADOR: readonly MunicipioOficial[] = [
  // ─── Ahuachapán (3)
  { nombre: 'Ahuachapán Norte', departamento: 'Ahuachapán', referencia: 'Atiquizaya', lat: 13.9772, lng: -89.7522,
    distritos: ['Atiquizaya', 'El Refugio', 'San Lorenzo', 'Turín'] },
  { nombre: 'Ahuachapán Centro', departamento: 'Ahuachapán', referencia: 'Ahuachapán', lat: 13.9214, lng: -89.8450,
    distritos: ['Ahuachapán', 'Apaneca', 'Concepción de Ataco', 'Tacuba'] },
  { nombre: 'Ahuachapán Sur', departamento: 'Ahuachapán', referencia: 'Jujutla', lat: 13.7867, lng: -89.8564,
    distritos: ['Guaymango', 'Jujutla', 'San Francisco Menéndez', 'San Pedro Puxtla'] },

  // ─── Santa Ana (4)
  { nombre: 'Santa Ana Norte', departamento: 'Santa Ana', referencia: 'Metapán', lat: 14.3333, lng: -89.4500,
    distritos: ['Masahuat', 'Metapán', 'Santa Rosa Guachipilín', 'Texistepeque'] },
  { nombre: 'Santa Ana Centro', departamento: 'Santa Ana', referencia: 'Santa Ana', lat: 13.9942, lng: -89.5597,
    distritos: ['Santa Ana'] },
  { nombre: 'Santa Ana Este', departamento: 'Santa Ana', referencia: 'Coatepeque', lat: 13.9264, lng: -89.5036,
    distritos: ['Coatepeque', 'El Congo'] },
  { nombre: 'Santa Ana Oeste', departamento: 'Santa Ana', referencia: 'Chalchuapa', lat: 13.9867, lng: -89.6811,
    distritos: ['Candelaria de la Frontera', 'Chalchuapa', 'El Porvenir', 'San Antonio Pajonal', 'San Sebastián Salitrillo',
      'Santiago de la Frontera'] },

  // ─── Sonsonate (4)
  { nombre: 'Sonsonate Norte', departamento: 'Sonsonate', referencia: 'Juayúa', lat: 13.8411, lng: -89.7456,
    distritos: ['Juayúa', 'Nahuizalco', 'Salcoatitán', 'Santa Catarina Masahuat'] },
  { nombre: 'Sonsonate Centro', departamento: 'Sonsonate', referencia: 'Sonsonate', lat: 13.7186, lng: -89.7244,
    distritos: ['Nahulingo', 'San Antonio del Monte', 'Santo Domingo de Guzmán', 'Sonsonate', 'Sonzacate'] },
  { nombre: 'Sonsonate Este', departamento: 'Sonsonate', referencia: 'Izalco', lat: 13.7447, lng: -89.6731,
    distritos: ['Armenia', 'Caluco', 'Cuisnahuat', 'Izalco', 'San Julián', 'Santa Isabel Ishuatán'] },
  { nombre: 'Sonsonate Oeste', departamento: 'Sonsonate', referencia: 'Acajutla', lat: 13.5928, lng: -89.8275,
    distritos: ['Acajutla'] },

  // ─── Chalatenango (3)
  { nombre: 'Chalatenango Norte', departamento: 'Chalatenango', referencia: 'La Palma', lat: 14.3167, lng: -89.1667,
    distritos: ['Citalá', 'La Palma', 'San Ignacio'] },
  { nombre: 'Chalatenango Centro', departamento: 'Chalatenango', referencia: 'Nueva Concepción', lat: 14.1311, lng: -89.2936,
    distritos: ['Agua Caliente', 'Dulce Nombre de María', 'El Paraíso', 'La Reina', 'Nueva Concepción', 'San Fernando',
      'San Francisco Morazán', 'San Rafael', 'Santa Rita', 'Tejutla'] },
  { nombre: 'Chalatenango Sur', departamento: 'Chalatenango', referencia: 'Chalatenango', lat: 14.0333, lng: -88.9333,
    distritos: ['Arcatao', 'Azacualpa', 'Chalatenango', 'Comalapa', 'Concepción Quezaltepeque', 'El Carrizal', 'La Laguna',
      'Las Vueltas', 'Nombre de Jesús', 'Nueva Trinidad', 'Ojos de Agua', 'Potonico', 'San Antonio de la Cruz',
      'San Antonio Los Ranchos', 'San Francisco Lempa', 'San Isidro Labrador', 'San José Cancasque', 'San José Las Flores',
      'San Luis del Carmen', 'San Miguel de Mercedes'] },

  // ─── La Libertad (6)
  { nombre: 'La Libertad Norte', departamento: 'La Libertad', referencia: 'Quezaltepeque', lat: 13.8350, lng: -89.2744,
    distritos: ['Quezaltepeque', 'San Matías', 'San Pablo Tacachico'] },
  { nombre: 'La Libertad Centro', departamento: 'La Libertad', referencia: 'San Juan Opico', lat: 13.8761, lng: -89.3597,
    distritos: ['Ciudad Arce', 'San Juan Opico'] },
  { nombre: 'La Libertad Oeste', departamento: 'La Libertad', referencia: 'Colón', lat: 13.7150, lng: -89.3700,
    distritos: ['Colón', 'Jayaque', 'Sacacoyo', 'Talnique', 'Tepecoyo'] },
  { nombre: 'La Libertad Este', departamento: 'La Libertad', referencia: 'Antiguo Cuscatlán', lat: 13.6728, lng: -89.2408,
    distritos: ['Antiguo Cuscatlán', 'Huizúcar', 'Nuevo Cuscatlán', 'San José Villanueva', 'Zaragoza'] },
  { nombre: 'La Libertad Costa', departamento: 'La Libertad', referencia: 'La Libertad', lat: 13.4883, lng: -89.3222,
    distritos: ['Chiltiupán', 'Jicalapa', 'La Libertad', 'Tamanique', 'Teotepeque'] },
  { nombre: 'La Libertad Sur', departamento: 'La Libertad', referencia: 'Santa Tecla', lat: 13.6769, lng: -89.2797,
    distritos: ['Comasagua', 'Santa Tecla'] },

  // ─── San Salvador (5)
  { nombre: 'San Salvador Norte', departamento: 'San Salvador', referencia: 'Aguilares', lat: 13.9572, lng: -89.1897,
    distritos: ['Aguilares', 'El Paisnal', 'Guazapa'] },
  { nombre: 'San Salvador Oeste', departamento: 'San Salvador', referencia: 'Apopa', lat: 13.8072, lng: -89.1792,
    distritos: ['Apopa', 'Nejapa'] },
  { nombre: 'San Salvador Este', departamento: 'San Salvador', referencia: 'Soyapango', lat: 13.7100, lng: -89.1400,
    distritos: ['Ilopango', 'San Martín', 'Soyapango', 'Tonacatepeque'] },
  { nombre: 'San Salvador Centro', departamento: 'San Salvador', referencia: 'San Salvador', lat: 13.6989, lng: -89.1914,
    distritos: ['Ayutuxtepeque', 'Ciudad Delgado', 'Cuscatancingo', 'Mejicanos', 'San Salvador'] },
  { nombre: 'San Salvador Sur', departamento: 'San Salvador', referencia: 'San Marcos', lat: 13.6589, lng: -89.1828,
    distritos: ['Panchimalco', 'Rosario de Mora', 'San Marcos', 'Santiago Texacuangos', 'Santo Tomás'] },

  // ─── Cuscatlán (2)
  { nombre: 'Cuscatlán Norte', departamento: 'Cuscatlán', referencia: 'Suchitoto', lat: 13.9381, lng: -89.0278,
    distritos: ['Oratorio de Concepción', 'San Bartolomé Perulapía', 'San José Guayabal', 'San Pedro Perulapán', 'Suchitoto'] },
  { nombre: 'Cuscatlán Sur', departamento: 'Cuscatlán', referencia: 'Cojutepeque', lat: 13.7167, lng: -88.9333,
    distritos: ['Candelaria', 'Cojutepeque', 'El Carmen', 'El Rosario', 'Monte San Juan', 'San Cristóbal', 'San Rafael Cedros',
      'San Ramón', 'Santa Cruz Analquito', 'Santa Cruz Michapa', 'Tenancingo'] },

  // ─── La Paz (3)
  { nombre: 'La Paz Oeste', departamento: 'La Paz', referencia: 'Olocuilta', lat: 13.5697, lng: -89.1172,
    distritos: ['Cuyultitán', 'Olocuilta', 'San Francisco Chinameca', 'San Juan Talpa', 'San Luis Talpa', 'San Pedro Masahuat',
      'Tapalhuaca'] },
  { nombre: 'La Paz Centro', departamento: 'La Paz', referencia: 'Santiago Nonualco', lat: 13.5167, lng: -88.9500,
    distritos: ['El Rosario', 'Jerusalén', 'Mercedes La Ceiba', 'Paraíso de Osorio', 'San Antonio Masahuat', 'San Emigdio',
      'San Juan Tepezontes', 'San Luis La Herradura', 'San Miguel Tepezontes', 'San Pedro Nonualco', 'Santa María Ostuma',
      'Santiago Nonualco'] },
  { nombre: 'La Paz Este', departamento: 'La Paz', referencia: 'Zacatecoluca', lat: 13.5000, lng: -88.8667,
    distritos: ['San Juan Nonualco', 'San Rafael Obrajuelo', 'Zacatecoluca'] },

  // ─── Cabañas (2)
  { nombre: 'Cabañas Oeste', departamento: 'Cabañas', referencia: 'Ilobasco', lat: 13.8417, lng: -88.8500,
    distritos: ['Cinquera', 'Ilobasco', 'Jutiapa', 'Tejutepeque'] },
  { nombre: 'Cabañas Este', departamento: 'Cabañas', referencia: 'Sensuntepeque', lat: 13.8667, lng: -88.6333,
    distritos: ['Dolores', 'Guacotecti', 'San Isidro', 'Sensuntepeque', 'Victoria'] },

  // ─── San Vicente (2)
  { nombre: 'San Vicente Norte', departamento: 'San Vicente', referencia: 'Apastepeque', lat: 13.6667, lng: -88.7500,
    distritos: ['Apastepeque', 'San Esteban Catarina', 'San Ildefonso', 'San Lorenzo', 'San Sebastián', 'Santa Clara',
      'Santo Domingo'] },
  { nombre: 'San Vicente Sur', departamento: 'San Vicente', referencia: 'San Vicente', lat: 13.6333, lng: -88.8000,
    distritos: ['Guadalupe', 'San Cayetano Istepeque', 'San Vicente', 'Tecoluca', 'Tepetitán', 'Verapaz'] },

  // ─── Usulután (3)
  { nombre: 'Usulután Norte', departamento: 'Usulután', referencia: 'Santiago de María', lat: 13.4867, lng: -88.4708,
    distritos: ['Alegría', 'Berlín', 'El Triunfo', 'Estanzuelas', 'Jucuapa', 'Mercedes Umaña', 'Nueva Granada',
      'San Buenaventura', 'Santiago de María'] },
  { nombre: 'Usulután Este', departamento: 'Usulután', referencia: 'Usulután', lat: 13.3500, lng: -88.4500,
    distritos: ['California', 'Concepción Batres', 'Ereguayquín', 'Jucuarán', 'Ozatlán', 'San Dionisio', 'Santa Elena',
      'Santa María', 'Tecapán', 'Usulután'] },
  { nombre: 'Usulután Oeste', departamento: 'Usulután', referencia: 'Jiquilisco', lat: 13.3197, lng: -88.5728,
    distritos: ['Jiquilisco', 'Puerto El Triunfo', 'San Agustín', 'San Francisco Javier'] },

  // ─── San Miguel (3)
  { nombre: 'San Miguel Norte', departamento: 'San Miguel', referencia: 'Ciudad Barrios', lat: 13.7667, lng: -88.2667,
    distritos: ['Carolina', 'Chapeltique', 'Ciudad Barrios', 'Nuevo Edén de San Juan', 'San Antonio del Mosco', 'San Gerardo',
      'San Luis de la Reina', 'Sesori'] },
  { nombre: 'San Miguel Centro', departamento: 'San Miguel', referencia: 'San Miguel', lat: 13.4833, lng: -88.1833,
    distritos: ['Chirilagua', 'Comacarán', 'Moncagua', 'Quelepa', 'San Miguel', 'Uluazapa'] },
  { nombre: 'San Miguel Oeste', departamento: 'San Miguel', referencia: 'Chinameca', lat: 13.5000, lng: -88.3500,
    distritos: ['Chinameca', 'El Tránsito', 'Lolotique', 'Nueva Guadalupe', 'San Jorge', 'San Rafael Oriente'] },

  // ─── Morazán (2)
  { nombre: 'Morazán Norte', departamento: 'Morazán', referencia: 'Perquín', lat: 13.9578, lng: -88.1617,
    distritos: ['Arambala', 'Cacaopera', 'Corinto', 'El Rosario', 'Joateca', 'Jocoaitique', 'Meanguera', 'Perquín',
      'San Fernando', 'San Isidro', 'Torola'] },
  { nombre: 'Morazán Sur', departamento: 'Morazán', referencia: 'San Francisco Gotera', lat: 13.7000, lng: -88.1000,
    distritos: ['Chilanga', 'Delicias de Concepción', 'El Divisadero', 'Gualococti', 'Guatajiagua', 'Jocoro', 'Lolotiquillo',
      'Osicala', 'San Carlos', 'San Francisco Gotera', 'San Simón', 'Sensembra', 'Sociedad', 'Yamabal', 'Yoloaiquín'] },

  // ─── La Unión (2)
  { nombre: 'La Unión Norte', departamento: 'La Unión', referencia: 'Santa Rosa de Lima', lat: 13.6247, lng: -87.8936,
    distritos: ['Anamorós', 'Bolívar', 'Concepción de Oriente', 'El Sauce', 'Lislique', 'Nueva Esparta', 'Pasaquina',
      'Polorós', 'San José', 'Santa Rosa de Lima'] },
  { nombre: 'La Unión Sur', departamento: 'La Unión', referencia: 'La Unión', lat: 13.3367, lng: -87.8439,
    distritos: ['Conchagua', 'El Carmen', 'Intipucá', 'La Unión', 'Meanguera del Golfo', 'San Alejo', 'Yayantique',
      'Yucuaiquín'] },
];

/**
 * Distritos con coordenadas propias (centro urbano aproximado): más precisos que el centro
 * de su municipio, así los pines de un mismo municipio no se apilan en un solo punto.
 * Formato: [distrito, departamento, lat, lng].
 */
const COORDENADAS_DISTRITO: Array<[string, string, number, number]> = [
  // La Libertad
  ['Antiguo Cuscatlán', 'La Libertad', 13.6728, -89.2408],
  ['Santa Tecla', 'La Libertad', 13.6769, -89.2797],
  ['Chiltiupán', 'La Libertad', 13.5878, -89.4719],
  ['Colón', 'La Libertad', 13.7150, -89.3700],
  ['Comasagua', 'La Libertad', 13.6372, -89.3794],
  ['Huizúcar', 'La Libertad', 13.5900, -89.2364],
  ['La Libertad', 'La Libertad', 13.4883, -89.3222],
  ['San José Villanueva', 'La Libertad', 13.5822, -89.2689],
  ['San Juan Opico', 'La Libertad', 13.8761, -89.3597],
  ['Zaragoza', 'La Libertad', 13.5900, -89.2889],
  // San Salvador
  ['San Salvador', 'San Salvador', 13.6989, -89.1914],
  ['Aguilares', 'San Salvador', 13.9572, -89.1897],
  ['San Martín', 'San Salvador', 13.7375, -89.0556],
  ['Soyapango', 'San Salvador', 13.7100, -89.1400],
  // Chalatenango
  ['Chalatenango', 'Chalatenango', 14.0333, -88.9333],
  ['San Luis del Carmen', 'Chalatenango', 14.0864, -89.0164],
  // Otros departamentos
  ['Cojutepeque', 'Cuscatlán', 13.7167, -88.9333],
  ['San Luis Talpa', 'La Paz', 13.4700, -89.0864],
  ['Santa Ana', 'Santa Ana', 13.9942, -89.5597],
  ['Sensuntepeque', 'Cabañas', 13.8667, -88.6333],
  ['Usulután', 'Usulután', 13.3500, -88.4500],
];

// ─── Índices (clave sin tildes ni mayúsculas, por departamento: hay nombres repetidos
// entre departamentos, p. ej. "El Rosario", "San Isidro", "El Carmen").
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const clave = (departamento: string, nombre: string) => `${normalizar(departamento)}|${normalizar(nombre)}`;

type Coordenadas = { lat: number; lng: number };

const POR_DISTRITO = new Map<string, Coordenadas>(
  COORDENADAS_DISTRITO.map(([distrito, departamento, lat, lng]) => [clave(departamento, distrito), { lat, lng }]),
);
const MUNICIPIO_DE_DISTRITO = new Map<string, MunicipioOficial>();
const POR_MUNICIPIO = new Map<string, MunicipioOficial>();
for (const municipio of MUNICIPIOS_EL_SALVADOR) {
  POR_MUNICIPIO.set(clave(municipio.departamento, municipio.nombre), municipio);
  for (const distrito of municipio.distritos) MUNICIPIO_DE_DISTRITO.set(clave(municipio.departamento, distrito), municipio);
}

/** Municipio oficial (2024) al que pertenece un distrito / municipio tradicional, o el propio si ya es oficial. */
export function municipioOficialDe(nombre: string, departamento: string): MunicipioOficial | undefined {
  const k = clave(departamento, nombre);
  return MUNICIPIO_DE_DISTRITO.get(k) ?? POR_MUNICIPIO.get(k);
}

/**
 * Coordenadas para un municipio tal como lo devuelve la API: nombre tradicional (distrito)
 * u oficial de 2024, sin distinguir tildes ni mayúsculas. `undefined` si el nombre no
 * pertenece a ese departamento (el mapa lo reporta con `console.warn`, no lo inventa).
 */
export function coordenadasMunicipio(nombre: string, departamento: string): Coordenadas | undefined {
  const propias = POR_DISTRITO.get(clave(departamento, nombre));
  if (propias) return propias;
  const municipio = municipioOficialDe(nombre, departamento);
  return municipio ? { lat: municipio.lat, lng: municipio.lng } : undefined;
}
