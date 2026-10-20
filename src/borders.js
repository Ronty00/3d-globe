import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { EARTH_RADIUS, latLngToVector3 } from "./math.js";
import topology from "./data/countries-50m.json";
import indiaClaim from "./data/india-claim.json";

// Just above the terrain, under the capital dots and the cloud shell.
const BORDER_RADIUS = EARTH_RADIUS + 0.007;
const MAX_STEP = THREE.MathUtils.degToRad(2);
const MAX_JOIN = THREE.MathUtils.degToRad(20);

const decodedArcs = decodeArcs(topology);

function decodeArcs(topo) {
  const { scale, translate } = topo.transform;
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

function featureGroup(geom) {
  const name = geom.properties?.name;
  if (name === "Somaliland") return "706";
  if (name === "N. Cyprus") return "196";
  if (name === "W. Sahara") return "504";
  if (name === "Hong Kong" || name === "Macao") return "156";
  if (geom.id == null) return `name:${name}`;
  return String(geom.id);
}

function ringCoords(indexes) {
  const coords = [];
  for (const idx of indexes) {
    const arc = idx < 0 ? decodedArcs[~idx].slice().reverse() : decodedArcs[idx];
    const start = coords.length ? 1 : 0;
    for (let i = start; i < arc.length; i++) coords.push(arc[i]);
  }
  return coords;
}

function ringContains(coords, lon, lat) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0];
    const yi = coords[i][1];
    const xj = coords[j][0];
    const yj = coords[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonsOf(geom) {
  if (geom.type === "Polygon") return [geom.arcs];
  if (geom.type === "MultiPolygon") return geom.arcs;
  return [];
}

// Crimea is its own polygon, tagged as Russia in this file. The atlas lists
// the peninsula with Ukraine, so that polygon joins Ukraine and the neck
// between them is not drawn as an international border.
function polygonGroup(geom, poly) {
  const group = featureGroup(geom);
  if (geom.properties?.name !== "Russia") return group;
  const outer = ringCoords(poly[0]);
  if (ringContains(outer, 34.1, 45.3)) return "804";
  return group;
}

function slerpOnSphere(a, b, t) {
  const ang = a.angleTo(b);
  const out = new THREE.Vector3();
  if (ang < 1e-5) return out.copy(a);
  const s = Math.sin(ang);
  out.copy(a).multiplyScalar(Math.sin((1 - t) * ang) / s).addScaledVector(b, Math.sin(t * ang) / s);
  return out.setLength(BORDER_RADIUS);
}

// The countries file draws the de facto line, which leaves Pakistan-administered
// Kashmir and Aksai Chin outside India. These public-domain Natural Earth rings
// are the official claim. Gilgit-Baltistan here also covers Azad Kashmir. Siachen,
// the Shaksgam Valley, and Demchok keep that claim one outline. A de facto segment
// is omitted when both sides lie inside the claim. A claim edge is drawn only
// where the countries file has no line.
const CLAIM_RINGS = indiaClaim.rings.map((ring) => ring.coordinates);
const CLAIM_BOXES = CLAIM_RINGS.map((ring) => {
  let minLon = 180;
  let maxLon = -180;
  let minLat = 90;
  let maxLat = -90;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
});
const INDIA_MAINLAND = ringCoords(
  polygonsOf(topology.objects.countries.geometries.find((geom) => String(geom.id) === "356"))[0][0],
);
const CLAIM_WEST = 72.2;
const CLAIM_EAST = 80.7;
const CLAIM_SOUTH = 32.35;
const CLAIM_NORTH = 37.25;
const CLAIM_OFFSET = 0.06;
const CLAIM_DEDUPE = 0.08;

function inClaim(lon, lat) {
  for (let i = 0; i < CLAIM_RINGS.length; i++) {
    const box = CLAIM_BOXES[i];
    if (lon < box.minLon || lon > box.maxLon || lat < box.minLat || lat > box.maxLat) continue;
    if (ringContains(CLAIM_RINGS[i], lon, lat)) return true;
  }
  return false;
}

function officialIndia(lon, lat) {
  return inClaim(lon, lat) || ringContains(INDIA_MAINLAND, lon, lat);
}

function ringDistance(lon, lat, ring) {
  let best = 1e9;
  for (let i = 1; i < ring.length; i++) {
    const d = pointSegDegrees(lon, lat, [ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]]);
    if (d < best) best = d;
  }
  return best;
}

function officialNeighbors(lon, lat) {
  let count = ringDistance(lon, lat, INDIA_MAINLAND) <= 0.08 ? 1 : 0;
  for (const ring of CLAIM_RINGS) {
    if (ringDistance(lon, lat, ring) <= 0.08) count++;
  }
  return count;
}

function internalToClaim(a, b) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  if (mx < CLAIM_WEST || mx > CLAIM_EAST || my < CLAIM_SOUTH || my > CLAIM_NORTH) return false;
  const cos = Math.cos(THREE.MathUtils.degToRad((a[1] + b[1]) / 2)) || 1e-6;
  const dx = (b[0] - a[0]) * cos;
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  const dLon = ((-dy / len) * CLAIM_OFFSET) / cos;
  const dLat = (dx / len) * CLAIM_OFFSET;
  if (officialIndia(mx + dLon, my + dLat) && officialIndia(mx - dLon, my - dLat)) return true;
  // Natural Earth leaves a hairline gap between India, Siachen, and Aksai Chin.
  // A segment tucked between two parts of the claim is not an outer border.
  return officialNeighbors(mx, my) >= 2;
}

function pointSegDegrees(px, py, seg) {
  const ax = seg[0];
  const ay = seg[1];
  const bx = seg[2];
  const by = seg[3];
  const cos = Math.cos(THREE.MathUtils.degToRad((ay + by) / 2)) || 1e-6;
  const dx = (bx - ax) * cos;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, (((px - ax) * cos) * dx + (py - ay) * dy) / len2));
  return Math.hypot((px - ax) * cos - t * dx, py - ay - t * dy);
}

export function borderPositions() {
  const arcInfo = decodedArcs.map(() => ({ groups: new Set(), count: 0 }));
  for (const geom of topology.objects.countries.geometries) {
    for (const poly of polygonsOf(geom)) {
      const group = polygonGroup(geom, poly);
      for (const ring of poly) {
        for (const idx of ring) {
          const n = idx < 0 ? ~idx : idx;
          const info = arcInfo[n];
          info.groups.add(group);
          info.count += 1;
        }
      }
    }
  }

  const positions = [];
  let dropped = 0;
  const grid = new Map();
  const cell = 0.5;

  function remember(a, b) {
    const minLon = Math.min(a[0], b[0]);
    const maxLon = Math.max(a[0], b[0]);
    const minLat = Math.min(a[1], b[1]);
    const maxLat = Math.max(a[1], b[1]);
    if (maxLon < CLAIM_WEST - 0.5 || minLon > CLAIM_EAST + 0.5 || maxLat < CLAIM_SOUTH - 0.5 || minLat > CLAIM_NORTH + 0.5) {
      return;
    }
    const seg = [a[0], a[1], b[0], b[1]];
    const x0 = Math.floor(minLon / cell);
    const x1 = Math.floor(maxLon / cell);
    const y0 = Math.floor(minLat / cell);
    const y1 = Math.floor(maxLat / cell);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`;
        let bucket = grid.get(key);
        if (!bucket) grid.set(key, (bucket = []));
        bucket.push(seg);
      }
    }
  }

  function alreadyDrawn(a, b) {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const x = Math.floor(mx / cell);
    const y = Math.floor(my / cell);
    let best = 1e9;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${x + dx},${y + dy}`);
        if (!bucket) continue;
        for (const seg of bucket) best = Math.min(best, pointSegDegrees(mx, my, seg));
      }
    }
    return best < CLAIM_DEDUPE;
  }

  function append(lon1, lat1, lon2, lat2) {
    const prev = latLngToVector3(lat1, lon1, BORDER_RADIUS);
    const next = latLngToVector3(lat2, lon2, BORDER_RADIUS);
    const ang = prev.angleTo(next);
    if (ang > MAX_JOIN) {
      dropped += 1;
      return false;
    }
    if (ang < 1e-5) return false;
    const steps = Math.max(1, Math.ceil(ang / MAX_STEP));
    let from = prev;
    for (let s = 1; s <= steps; s++) {
      const to = s === steps ? next : slerpOnSphere(prev, next, s / steps);
      positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
      from = to;
    }
    return true;
  }

  for (let i = 0; i < decodedArcs.length; i++) {
    const info = arcInfo[i];
    const shared = info.count >= 2 && info.groups.size === 1;
    if (info.count === 0 || shared) continue;
    const coords = decodedArcs[i];
    for (let p = 1; p < coords.length; p++) {
      const a = coords[p - 1];
      const b = coords[p];
      if (internalToClaim(a, b)) continue;
      if (append(a[0], a[1], b[0], b[1])) remember(a, b);
    }
  }

  for (const ring of CLAIM_RINGS) {
    for (let p = 1; p < ring.length; p++) {
      const a = ring[p - 1];
      const b = ring[p];
      if (internalToClaim(a, b)) continue;
      if (alreadyDrawn(a, b)) continue;
      if (append(a[0], a[1], b[0], b[1])) remember(a, b);
    }
  }

  const array = new Float32Array(positions);
  array.dropped = dropped;
  return array;
}

export function createBorders(earthGroup, positions = borderPositions()) {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color: 0xe7eef6,
    linewidth: 1.35,
    transparent: true,
    opacity: 0.88,
    depthTest: true,
    depthWrite: false,
  });
  const lines = new LineSegments2(geometry, material);
  lines.name = "country-borders";
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  lines.raycast = () => {};
  earthGroup.add(lines);
  return lines;
}
