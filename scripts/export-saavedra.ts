/**
 * Export Saavedra barrio map from OpenStreetMap.
 * Run: npm run map:export
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../src/map/data/saavedra.json');

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const CENTER_LAT = -34.55;
const CENTER_LON = -58.483;
const SCALE = 8500; // meters-ish to game units

interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

interface OsmRelation {
  type: 'relation';
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay | OsmRelation;

interface DistrictNodeOut {
  id: string;
  labelKey: string;
  label: { en: string; es: string };
  x: number;
  z: number;
  poi: 'mall' | 'hospital' | 'police' | null;
  neighbors: string[];
}

interface LandmarkOut {
  id: string;
  name: string;
  category: string;
  x: number;
  z: number;
}

interface SaavedraMapData {
  meta: {
    name: string;
    center: [number, number];
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  };
  boundary: [number, number][];
  streetLines: [number, number][][];
  nodes: DistrictNodeOut[];
  landmarks: LandmarkOut[];
}

function project(lat: number, lon: number): [number, number] {
  const x = (lon - CENTER_LON) * SCALE * Math.cos((CENTER_LAT * Math.PI) / 180);
  const z = -(lat - CENTER_LAT) * SCALE;
  return [x, z];
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'poi';
}

async function overpass(query: string): Promise<OsmElement[]> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastErr: Error | null = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass error ${res.status} from ${url}`);
        continue;
      }
      const data = (await res.json()) as { elements: OsmElement[] };
      return data.elements;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('Overpass failed');
}

const STRATEGIC: { id: string; name: string; poi: 'mall' | 'hospital' | 'police'; lat: number; lon: number }[] = [
  { id: 'dot_baires', name: 'DOT Baires Shopping', poi: 'mall', lat: -34.5468, lon: -58.4895 },
  { id: 'hospital_saavedra', name: 'Hospital Tierra del Fuego', poi: 'hospital', lat: -34.5542, lon: -58.4788 },
  { id: 'comisaria_12', name: 'Comisaría Comunal 12', poi: 'police', lat: -34.5485, lon: -58.4812 },
];

const KEY_NODES: { id: string; name: string; lat: number; lon: number }[] = [
  { id: 'plaza_saavedra', name: 'Plaza Saavedra', lat: -34.5495, lon: -58.4845 },
  { id: 'parque_saavedra', name: 'Parque Saavedra', lat: -34.5528, lon: -58.4875 },
  { id: 'estacion_belgrano_r', name: 'Estación Belgrano R', lat: -34.5625, lon: -58.4780 },
  { id: 'cabildo_arias', name: 'Cabildo y Arias', lat: -34.5470, lon: -58.4860 },
  { id: 'cabildo_roosevelt', name: 'Cabildo y Roosevelt', lat: -34.5510, lon: -58.4865 },
  { id: 'cabildo_vedia', name: 'Cabildo y Vedia', lat: -34.5555, lon: -58.4870 },
  { id: 'cabildo_monroe', name: 'Cabildo y Monroe', lat: -34.5595, lon: -58.4875 },
  { id: 'arias_garcia_del_rio', name: 'Arias y García del Río', lat: -34.5475, lon: -58.4820 },
  { id: 'roosevelt_garcia_del_rio', name: 'Roosevelt y García del Río', lat: -34.5515, lon: -58.4825 },
  { id: 'vedia_garcia_del_rio', name: 'Vedia y García del Río', lat: -34.5560, lon: -58.4830 },
  { id: 'monroe_garcia_del_rio', name: 'Monroe y García del Río', lat: -34.5600, lon: -58.4835 },
  { id: 'arias_paz', name: 'Arias y Av. del Libertador', lat: -34.5478, lon: -58.4765 },
  { id: 'roosevelt_paz', name: 'Roosevelt y Av. del Libertador', lat: -34.5518, lon: -58.4770 },
  { id: 'vedia_paz', name: 'Vedia y Av. del Libertador', lat: -34.5563, lon: -58.4775 },
  { id: 'monroe_paz', name: 'Monroe y Av. del Libertador', lat: -34.5603, lon: -58.4780 },
  { id: 'paz_general_paz', name: 'Av. del Libertador y Gral. Paz', lat: -34.5540, lon: -58.4720 },
  { id: 'nunez_border', name: 'Límite Núñez', lat: -34.5445, lon: -58.4905 },
  { id: 'coghlan_border', name: 'Límite Coghlan', lat: -34.5635, lon: -58.4920 },
];

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function buildGraph(
  nodes: { id: string; name: string; x: number; z: number; poi: 'mall' | 'hospital' | 'police' | null }[],
): DistrictNodeOut[] {
  const maxEdge = 12;
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = dist([nodes[i].x, nodes[i].z], [nodes[j].x, nodes[j].z]);
      if (d <= maxEdge) {
        adj.get(nodes[i].id)!.add(nodes[j].id);
        adj.get(nodes[j].id)!.add(nodes[i].id);
      }
    }
  }

  const corridors: string[][] = [
    ['nunez_border', 'cabildo_arias', 'cabildo_roosevelt', 'cabildo_vedia', 'cabildo_monroe', 'coghlan_border'],
    ['arias_paz', 'arias_garcia_del_rio', 'cabildo_arias', 'plaza_saavedra'],
    ['roosevelt_paz', 'roosevelt_garcia_del_rio', 'cabildo_roosevelt', 'parque_saavedra'],
    ['vedia_paz', 'vedia_garcia_del_rio', 'cabildo_vedia'],
    ['monroe_paz', 'monroe_garcia_del_rio', 'cabildo_monroe', 'estacion_belgrano_r'],
    ['dot_baires', 'cabildo_arias', 'nunez_border'],
    ['hospital_saavedra', 'roosevelt_garcia_del_rio', 'roosevelt_paz'],
    ['comisaria_12', 'plaza_saavedra', 'cabildo_roosevelt'],
  ];

  for (const chain of corridors) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i];
      const b = chain[i + 1];
      if (adj.has(a) && adj.has(b)) {
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
    }
  }

  return nodes.map((n) => ({
    id: n.id,
    labelKey: `node.${n.id}`,
    label: { en: n.name, es: n.name },
    x: n.x,
    z: n.z,
    poi: n.poi,
    neighbors: [...adj.get(n.id)!],
  }));
}

function poiCategory(tags: Record<string, string>): string {
  if (tags.amenity) return tags.amenity;
  if (tags.shop) return `shop:${tags.shop}`;
  if (tags.leisure) return tags.leisure;
  if (tags.tourism) return tags.tourism;
  if (tags.historic) return tags.historic;
  if (tags.public_transport) return tags.public_transport;
  return 'other';
}

const FALLBACK_BOUNDARY_LATLON: [number, number][] = [
  [-34.5425, -58.4950],
  [-34.5420, -58.4720],
  [-34.5650, -58.4710],
  [-34.5660, -58.4780],
  [-34.5640, -58.4920],
  [-34.5550, -58.4960],
  [-34.5430, -58.4965],
];

const FALLBACK_LANDMARKS: { name: string; category: string; lat: number; lon: number }[] = [
  { name: 'DOT Baires Shopping', category: 'mall', lat: -34.5468, lon: -58.4895 },
  { name: 'Hospital Tierra del Fuego', category: 'hospital', lat: -34.5542, lon: -58.4788 },
  { name: 'Comisaría Comunal 12', category: 'police', lat: -34.5485, lon: -58.4812 },
  { name: 'Parque Saavedra', category: 'park', lat: -34.5528, lon: -58.4875 },
  { name: 'Plaza Saavedra', category: 'place', lat: -34.5495, lon: -58.4845 },
  { name: 'Estación Belgrano R', category: 'station', lat: -34.5625, lon: -58.4780 },
  { name: 'Biblioteca Saavedra', category: 'library', lat: -34.5505, lon: -58.4855 },
  { name: 'Centro Municipal Comuna 12', category: 'townhall', lat: -34.5490, lon: -58.4838 },
  { name: 'Parroquia Candelaria', category: 'place_of_worship', lat: -34.5512, lon: -58.4848 },
  { name: 'Plaza Vicente López', category: 'place', lat: -34.5455, lon: -58.4885 },
  { name: 'Supermercado Disco', category: 'supermarket', lat: -34.5488, lon: -58.4872 },
  { name: 'Farmacity Cabildo', category: 'pharmacy', lat: -34.5502, lon: -58.4868 },
  { name: 'Banco Galicia', category: 'bank', lat: -34.5498, lon: -58.4862 },
  { name: 'McDonald\'s Cabildo', category: 'restaurant', lat: -34.5482, lon: -58.4865 },
  { name: 'Starbucks Cabildo', category: 'cafe', lat: -34.5475, lon: -58.4863 },
  { name: 'Escuela Primaria', category: 'school', lat: -34.5535, lon: -58.4850 },
  { name: 'Colegio Nacional', category: 'school', lat: -34.5568, lon: -58.4840 },
  { name: 'Club Comunicaciones', category: 'sports_centre', lat: -34.5575, lon: -58.4890 },
  { name: 'Plaza Núñez', category: 'place', lat: -34.5440, lon: -58.4910 },
  { name: 'Plaza Roosevelt', category: 'place', lat: -34.5510, lon: -58.4880 },
  { name: 'Subte - futuro', category: 'station', lat: -34.5520, lon: -58.4878 },
  { name: 'Feria de Mataderos', category: 'marketplace', lat: -34.5555, lon: -58.4860 },
  { name: 'Cine DOT', category: 'cinema', lat: -34.5470, lon: -58.4900 },
  { name: 'Gimnasio Megatlon', category: 'fitness_centre', lat: -34.5460, lon: -58.4855 },
  { name: 'Veterinaria', category: 'veterinary', lat: -34.5545, lon: -58.4865 },
  { name: 'Panadería', category: 'bakery', lat: -34.5508, lon: -58.4858 },
  { name: 'Kiosco', category: 'convenience', lat: -34.5492, lon: -58.4840 },
  { name: 'Plaza Vedia', category: 'place', lat: -34.5555, lon: -58.4885 },
  { name: 'Plaza Monroe', category: 'place', lat: -34.5595, lon: -58.4890 },
  { name: 'Plaza García del Río', category: 'place', lat: -34.5540, lon: -58.4825 },
  { name: 'Plaza Arias', category: 'place', lat: -34.5475, lon: -58.4835 },
  { name: 'Obra social', category: 'clinic', lat: -34.5530, lon: -58.4810 },
  { name: 'Jardín Botánico', category: 'park', lat: -34.5610, lon: -58.4855 },
  { name: 'Museo Histórico', category: 'museum', lat: -34.5515, lon: -58.4830 },
  { name: 'Bar Notable', category: 'bar', lat: -34.5485, lon: -58.4850 },
  { name: 'Parrilla', category: 'restaurant', lat: -34.5472, lon: -58.4848 },
  { name: 'Heladería', category: 'cafe', lat: -34.5500, lon: -58.4875 },
  { name: 'Librería', category: 'books', lat: -34.5495, lon: -58.4860 },
  { name: 'Ferretería', category: 'hardware', lat: -34.5560, lon: -58.4880 },
  { name: 'Lavadero', category: 'car_wash', lat: -34.5458, lon: -58.4830 },
];

function fallbackBoundary(): [number, number][] {
  return FALLBACK_BOUNDARY_LATLON.map(([lat, lon]) => project(lat, lon));
}

function fallbackStreets(nodes: { x: number; z: number }[]): [number, number][][] {
  const lines: [number, number][][] = [];
  const byId = (id: string) => {
    const n = KEY_NODES.find((k) => k.id === id);
    if (!n) return null;
    return project(n.lat, n.lon);
  };
  const chains = [
    ['nunez_border', 'cabildo_arias', 'cabildo_roosevelt', 'cabildo_vedia', 'cabildo_monroe', 'coghlan_border'],
    ['arias_paz', 'arias_garcia_del_rio', 'roosevelt_garcia_del_rio', 'vedia_garcia_del_rio', 'monroe_garcia_del_rio'],
    ['arias_paz', 'roosevelt_paz', 'vedia_paz', 'monroe_paz', 'paz_general_paz'],
  ];
  for (const chain of chains) {
    const pts: [number, number][] = [];
    for (const id of chain) {
      const p = byId(id);
      if (p) pts.push(p);
    }
    if (pts.length >= 2) lines.push(pts);
  }
  return lines;
}

function fallbackLandmarks(): LandmarkOut[] {
  return FALLBACK_LANDMARKS.map((lm, i) => {
    const [x, z] = project(lm.lat, lm.lon);
    return { id: `lm_fb_${i}`, name: lm.name, category: lm.category, x, z };
  });
}

async function fetchBoundaryGeoJson(): Promise<[number, number][] | null> {
  try {
    const res = await fetch('https://polygons.openstreetmap.fr/get_geojson.py?id=2222167&params=0');
    if (!res.ok) return null;
    const geo = (await res.json()) as { geometries?: { type: string; coordinates: number[][][] }[] };
    const geom = geo.geometries?.[0];
    if (!geom || geom.type !== 'MultiPolygon') return null;
    const ring = geom.coordinates[0]?.[0];
    if (!ring) return null;
    return ring.map(([lon, lat]) => project(lat, lon));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log('Fetching Saavedra boundary...');
  let boundaryEls: OsmElement[] = [];
  try {
    boundaryEls = await overpass(`
      [out:json][timeout:60];
      relation(2222167);
      (._;>;);
      out geom;
    `);
  } catch (e) {
    console.warn('Boundary fetch failed, using fallback polygon:', e);
  }

  let boundary: [number, number][] = [];
  for (const el of boundaryEls) {
    if (el.type !== 'relation') continue;
    const rel = el as OsmRelation;
    for (const member of rel.members ?? []) {
      // outer ways handled via geometry on relation output
    }
  }

  // Extract boundary from ways with geometry
  const outerWays = boundaryEls.filter((e): e is OsmWay => e.type === 'way' && !!(e as OsmWay).geometry);
  if (outerWays.length) {
    const pts: [number, number][] = [];
    for (const way of outerWays) {
      for (const g of way.geometry ?? []) {
        pts.push(project(g.lat, g.lon));
      }
    }
    // simplify: take unique-ish points
    boundary = pts.filter((_, i) => i % 3 === 0);
  }

  if (!boundary.length) {
    const geoBoundary = await fetchBoundaryGeoJson();
    boundary = geoBoundary ?? fallbackBoundary();
  }

  console.log('Fetching streets...');
  let streetEls: OsmElement[] = [];
  try {
    streetEls = await overpass(`
      [out:json][timeout:90];
      area["name"="Saavedra"]["admin_level"="9"]->.a;
      (
        way["highway"~"^(primary|secondary|tertiary|trunk|residential|unclassified)$"](area.a);
      );
      out geom;
    `);
  } catch (e) {
    console.warn('Streets fetch failed:', e);
  }

  const streetLines: [number, number][][] = [];
  for (const el of streetEls) {
    if (el.type !== 'way' || !(el as OsmWay).geometry) continue;
    const way = el as OsmWay;
    const line: [number, number][] = (way.geometry ?? []).map((g) => project(g.lat, g.lon));
    if (line.length >= 2) streetLines.push(line);
  }

  console.log('Fetching POIs...');
  let poiEls: OsmElement[] = [];
  try {
    poiEls = await overpass(`
      [out:json][timeout:90];
      area["name"="Saavedra"]["admin_level"="9"]->.a;
      (
        node["amenity"](area.a);
        node["shop"](area.a);
        node["tourism"](area.a);
        node["leisure"](area.a);
        node["historic"](area.a);
        node["public_transport"](area.a);
        way["amenity"](area.a);
        way["shop"](area.a);
        way["tourism"](area.a);
        way["leisure"](area.a);
      );
      out center;
    `);
  } catch (e) {
    console.warn('POI fetch failed:', e);
  }

  const landmarks: LandmarkOut[] = [];
  const seen = new Set<string>();

  for (const el of poiEls) {
    let lat: number | undefined;
    let lon: number | undefined;
    let tags: Record<string, string> | undefined;
    let osmId: number | undefined;

    if (el.type === 'node') {
      const n = el as OsmNode;
      lat = n.lat;
      lon = n.lon;
      tags = n.tags;
      osmId = n.id;
    } else if (el.type === 'way') {
      const w = el as OsmWay & { center?: { lat: number; lon: number } };
      if (w.center) {
        lat = w.center.lat;
        lon = w.center.lon;
      } else if (w.geometry?.length) {
        const mid = w.geometry[Math.floor(w.geometry.length / 2)];
        lat = mid.lat;
        lon = mid.lon;
      }
      tags = w.tags;
      osmId = w.id;
    }
    if (lat === undefined || lon === undefined || !tags) continue;

    const name = tags.name || tags['name:es'] || tags['name:en'] || poiCategory(tags);
    const key = `${name}_${lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const [x, z] = project(lat, lon);
    landmarks.push({
      id: `lm_${osmId ?? slug(name)}`,
      name,
      category: poiCategory(tags),
      x,
      z,
    });
  }

  const playableNodes: { id: string; name: string; x: number; z: number; poi: 'mall' | 'hospital' | 'police' | null }[] = [];

  for (const kn of KEY_NODES) {
    const [x, z] = project(kn.lat, kn.lon);
    playableNodes.push({ id: kn.id, name: kn.name, x, z, poi: null });
  }

  for (const st of STRATEGIC) {
    const [x, z] = project(st.lat, st.lon);
    const existing = playableNodes.find((n) => n.id === st.id);
    if (existing) {
      existing.poi = st.poi;
    } else {
      playableNodes.push({ id: st.id, name: st.name, x, z, poi: st.poi });
    }
  }

  if (!streetLines.length) streetLines.push(...fallbackStreets(playableNodes));
  if (!landmarks.length) landmarks.push(...fallbackLandmarks());

  console.log(`Found ${landmarks.length} landmarks, ${streetLines.length} street segments`);

  const nodes = buildGraph(playableNodes);

  const allX = [...boundary.map((p) => p[0]), ...nodes.map((n) => n.x)];
  const allZ = [...boundary.map((p) => p[1]), ...nodes.map((n) => n.z)];

  const data: SaavedraMapData = {
    meta: {
      name: 'Saavedra',
      center: [CENTER_LAT, CENTER_LON],
      bounds: {
        minX: Math.min(...allX) - 3,
        maxX: Math.max(...allX) + 3,
        minZ: Math.min(...allZ) - 3,
        maxZ: Math.max(...allZ) + 3,
      },
    },
    boundary,
    streetLines,
    nodes,
    landmarks,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`Wrote ${OUT} (${nodes.length} nodes, ${landmarks.length} landmarks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
