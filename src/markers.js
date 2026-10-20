import * as THREE from "three";
import { countries, featured, REGION_COLORS } from "./data/locations.js";
import { PLACES } from "./data/places.js";
import { EARTH_RADIUS, latLngToVector3 } from "./math.js";

const CORE_RADIUS = 0.013;
const FEATURED_RADIUS = 0.019;
const STATE_RADIUS = 0.009;
const STATE_COLOR = 0xf5c16c;
// Home view sits near distance 4.9. State and union-territory dots appear
// only once the camera is close enough to tell them apart.
const LOCAL_SHOW_DISTANCE = 3.75;
// Punjab's catalog point is Chandigarh, which is its own territory.
const STATE_MARKER_AT = {
  punjab: [31.0, 75.45],
};

function writeScale(array, index, x, y, z, s) {
  const o = index * 16;
  array[o] = s;
  array[o + 1] = 0;
  array[o + 2] = 0;
  array[o + 3] = 0;
  array[o + 4] = 0;
  array[o + 5] = s;
  array[o + 6] = 0;
  array[o + 7] = 0;
  array[o + 8] = 0;
  array[o + 9] = 0;
  array[o + 10] = s;
  array[o + 11] = 0;
  array[o + 12] = x;
  array[o + 13] = y;
  array[o + 14] = z;
  array[o + 15] = 1;
}

function markRange(attribute, instances) {
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, Math.max(1, instances) * 16);
  attribute.needsUpdate = true;
}

function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

export function createMarkers(earthGroup) {
  const group = new THREE.Group();
  earthGroup.add(group);

  const records = countries.map((c) => ({
    ...c,
    kind: "country",
    countryDot: true,
    color: REGION_COLORS[c.region] ?? 0x88c0ff,
    pos: latLngToVector3(c.lat, c.lng, EARTH_RADIUS + 0.012),
  }));

  const extraFeatured = featured.filter(
    (f) =>
      !countries.some(
        (c) => Math.abs(c.lat - f.lat) < 0.35 && Math.abs(c.lng - f.lng) < 0.35
      )
  );

  extraFeatured.forEach((f, i) => {
    records.push({
      id: f.id,
      name: f.name,
      capital: f.country,
      lat: f.lat,
      lng: f.lng,
      region: f.region,
      iso: f.iso,
      kind: "featured",
      blurb: f.blurb,
      color: REGION_COLORS[f.region] ?? 0xf5c16c,
      pos: latLngToVector3(f.lat, f.lng, EARTH_RADIUS + 0.012),
      index: countries.length + i,
    });
  });

  featured.forEach((f) => {
    const match = records.find(
      (r) => Math.abs(r.lat - f.lat) < 0.35 && Math.abs(r.lng - f.lng) < 0.35
    );
    if (match) {
      match.kind = "featured";
      match.featuredId = f.id;
      match.blurb = f.blurb;
      match.displayName = f.name;
    }
  });

  const countryByIso = new Map(countries.map((c) => [c.iso, c]));
  // 0.08° cells. A hit is at most one cell away, so the 3×3 neighborhood
  // matches the old linear scan without comparing every dot to every dot.
  const cell = 0.08;
  const occupied = new Map();
  const occupy = (lat, lng) => {
    const key = `${Math.floor(lng / cell)},${Math.floor(lat / cell)}`;
    let bucket = occupied.get(key);
    if (!bucket) occupied.set(key, (bucket = []));
    bucket.push(lat, lng);
  };
  const occupiedNear = (lat, lng) => {
    const gx = Math.floor(lng / cell);
    const gy = Math.floor(lat / cell);
    for (let x = gx - 1; x <= gx + 1; x++) {
      for (let y = gy - 1; y <= gy + 1; y++) {
        const bucket = occupied.get(`${x},${y}`);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k += 2) {
          if (Math.hypot(bucket[k] - lat, bucket[k + 1] - lng) < 0.08) return true;
        }
      }
    }
    return false;
  };
  for (const rec of records) occupy(rec.lat, rec.lng);

  for (const pack of Object.values(PLACES)) {
    for (const place of pack.items) {
      const territory =
        place.type === "state" || place.id === "chandigarh" || place.id === "puducherry";
      if (!territory) continue;
      const override = STATE_MARKER_AT[place.id];
      const lat = override ? override[0] : place.lat;
      const lng = override ? override[1] : place.lng;
      if (occupiedNear(lat, lng)) continue;
      occupy(lat, lng);
      const country = countryByIso.get(place.iso);
      records.push({
        id: place.id,
        placeId: place.id,
        name: place.name,
        displayName: place.name,
        capital: place.region,
        lat,
        lng,
        region: country?.region || "Asia",
        iso: place.iso,
        kind: "state",
        country: country?.name || place.region,
        blurb: place.people,
        color: STATE_COLOR,
        pos: latLngToVector3(lat, lng, EARTH_RADIUS + 0.014),
      });
    }
  }

  const count = records.length;
  // Country dots are packed first. Zoomed out, the GPU draws only that prefix.
  let overviewCount = 0;
  while (overviewCount < count && records[overviewCount].countryDot) overviewCount++;
  for (let i = overviewCount; i < count; i++) {
    if (records[i].countryDot) {
      overviewCount = count;
      break;
    }
  }

  // A capital dot is a few pixels wide. 12×8 and 10×8 read as round;
  // the old 20×16 cores and 32×24 glows were hundreds of triangles each.
  const coreGeo = new THREE.SphereGeometry(1, 12, 8);
  const coreMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, count);
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cores.frustumCulled = false;
  cores.raycast = () => {};

  const glowGeo = new THREE.SphereGeometry(1, 10, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glows = new THREE.InstancedMesh(glowGeo, glowMat, count);
  glows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  glows.frustumCulled = false;
  glows.raycast = () => {};

  const color = new THREE.Color();
  const offsets = new Float32Array(count);
  const lx = new Float32Array(count);
  const ly = new Float32Array(count);
  const lz = new Float32Array(count);
  const ux = new Float32Array(count);
  const uy = new Float32Array(count);
  const uz = new Float32Array(count);
  const wr = new Float32Array(count);
  const baseR = new Float32Array(count);
  const detail = new Uint8Array(count);
  const isState = new Uint8Array(count);
  const selectedFlag = new Uint8Array(count);
  const lastScale = new Float32Array(count);
  lastScale.fill(-1);

  earthGroup.updateMatrixWorld(true);
  const worldPos = new THREE.Vector3();
  const coreArray = cores.instanceMatrix.array;
  const glowArray = glows.instanceMatrix.array;

  for (let i = 0; i < count; i++) {
    const rec = records[i];
    const base = rec.kind === "featured" ? FEATURED_RADIUS : rec.kind === "state" ? STATE_RADIUS : CORE_RADIUS;
    lx[i] = rec.pos.x;
    ly[i] = rec.pos.y;
    lz[i] = rec.pos.z;
    baseR[i] = base;
    detail[i] = rec.countryDot ? 0 : 1;
    isState[i] = rec.kind === "state" ? 1 : 0;
    worldPos.copy(rec.pos).applyMatrix4(group.matrixWorld);
    wr[i] = worldPos.length() || 1;
    ux[i] = worldPos.x / wr[i];
    uy[i] = worldPos.y / wr[i];
    uz[i] = worldPos.z / wr[i];
    writeScale(coreArray, i, rec.pos.x, rec.pos.y, rec.pos.z, base);
    writeScale(glowArray, i, rec.pos.x, rec.pos.y, rec.pos.z, base * 2);
    color.setHex(rec.color);
    cores.setColorAt(i, color);
    glows.setColorAt(i, color);
    offsets[i] = Math.random() * Math.PI * 2;
    rec.instanceId = i;
  }

  cores.instanceColor.needsUpdate = true;
  glows.instanceColor.needsUpdate = true;
  cores.count = overviewCount;
  glows.count = overviewCount;
  markRange(cores.instanceMatrix, overviewCount);
  markRange(glows.instanceMatrix, overviewCount);
  group.add(glows, cores);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.03, 0.038, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  ring.visible = false;
  group.add(ring);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let flagId;
  let selectedNeedsDetail = false;

  function syncSelection(selectedId) {
    if (selectedId === flagId) return;
    flagId = selectedId;
    selectedFlag.fill(0);
    selectedNeedsDetail = false;
    if (!selectedId) return;
    for (let i = 0; i < count; i++) {
      const rec = records[i];
      if (rec.id === selectedId || rec.featuredId === selectedId || rec.placeId === selectedId) {
        selectedFlag[i] = 1;
        if (i >= overviewCount) selectedNeedsDetail = true;
      }
    }
  }

  function viewScale(camera) {
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const dist = Math.max(0.5, Math.hypot(cx, cy, cz));
    const cssH = Math.max(1, camera.userData.cssHeight || 800);
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const coarse = Boolean(camera.userData.coarsePointer);
    const corePx = (CORE_RADIUS * 2 * cssH) / (2 * dist * tanHalf);
    const boost = coarse ? Math.min(2, Math.max(1, 6 / Math.max(corePx, 0.5))) : 1;
    const gap = Math.max(0.2, dist - EARTH_RADIUS);
    const zoomFit = Math.min(1, Math.max(0.14, gap / 3.3));
    const pickR = Math.min(coarse ? 0.085 : 0.055, Math.max(0.04, ((coarse ? 22 : 16) * dist * tanHalf) / cssH));
    return {
      cx,
      cy,
      cz,
      dist,
      inv: 1 / dist,
      boost,
      zoomFit,
      pickR,
      localOn: dist < LOCAL_SHOW_DISTANCE,
    };
  }

  function fadeAt(i, facing, localOn) {
    if (selectedFlag[i]) return 1;
    if (detail[i] && !localOn) return 0;
    return smoothstep(facing, 0.02, 0.22);
  }

  return {
    group,
    records,
    update(time, selectedId, camera) {
      syncSelection(selectedId);
      const view = viewScale(camera);
      const drawCount = view.localOn || selectedNeedsDetail ? count : overviewCount;
      const vx = view.cx * view.inv;
      const vy = view.cy * view.inv;
      const vz = view.cz * view.inv;
      let wrote = false;
      for (let i = 0; i < drawCount; i++) {
        const facing = ux[i] * vx + uy[i] * vy + uz[i] * vz;
        const fade = fadeAt(i, facing, view.localOn);
        if (fade === 0) {
          if (lastScale[i] !== 0) {
            writeScale(coreArray, i, lx[i], ly[i], lz[i], 0);
            writeScale(glowArray, i, lx[i], ly[i], lz[i], 0);
            lastScale[i] = 0;
            wrote = true;
          }
          continue;
        }
        const selected = selectedFlag[i];
        const pulse = 1 + Math.sin(time * 2.4 + offsets[i]) * 0.16;
        const s = baseR[i] * pulse * (selected ? 1.35 : 1) * fade * view.boost * view.zoomFit;
        if (Math.abs(s - lastScale[i]) < 1e-5) continue;
        lastScale[i] = s;
        writeScale(coreArray, i, lx[i], ly[i], lz[i], s);
        writeScale(glowArray, i, lx[i], ly[i], lz[i], s * (selected ? 2.05 : 2));
        wrote = true;
      }
      if (cores.count !== drawCount) {
        cores.count = drawCount;
        glows.count = drawCount;
        wrote = true;
      }
      if (wrote) {
        markRange(cores.instanceMatrix, drawCount);
        markRange(glows.instanceMatrix, drawCount);
      }

      if (ring.userData.rec) {
        ring.material.opacity = 0.4 + Math.sin(time * 3) * 0.2;
        ring.scale.setScalar(1 + (time % 1.8) * 0.18);
      }
    },
    pick(clientX, clientY, camera, canvas) {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      pointer.x = ((clientX - rect.left) / w) * 2 - 1;
      pointer.y = -((clientY - rect.top) / h) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const origin = raycaster.ray.origin;
      const dir = raycaster.ray.direction;
      const ox = origin.x;
      const oy = origin.y;
      const oz = origin.z;
      const dx = dir.x;
      const dy = dir.y;
      const dz = dir.z;
      const view = viewScale(camera);
      const drawCount = view.localOn || selectedNeedsDetail ? count : overviewCount;
      const vx = view.cx * view.inv;
      const vy = view.cy * view.inv;
      const vz = view.cz * view.inv;
      const statePick = Math.min(view.pickR, 0.022);
      let best = Infinity;
      let hit = -1;
      for (let i = 0; i < drawCount; i++) {
        const facing = ux[i] * vx + uy[i] * vy + uz[i] * vz;
        const fade = fadeAt(i, facing, view.localOn);
        if (fade <= 0.15 && !selectedFlag[i]) continue;
        const radius = isState[i] ? statePick : view.pickR;
        const wx = ux[i] * wr[i];
        const wy = uy[i] * wr[i];
        const wz = uz[i] * wr[i];
        const vx0 = wx - ox;
        const vy0 = wy - oy;
        const vz0 = wz - oz;
        const tca = vx0 * dx + vy0 * dy + vz0 * dz;
        if (tca < 0) continue;
        const d2 = vx0 * vx0 + vy0 * vy0 + vz0 * vz0 - tca * tca;
        const r2 = radius * radius;
        if (d2 > r2) continue;
        const t = tca - Math.sqrt(r2 - d2);
        const distHit = t > 0 ? t : tca + Math.sqrt(r2 - d2);
        if (distHit < best) {
          best = distHit;
          hit = i;
        }
      }
      return hit < 0 ? null : records[hit];
    },
    select(rec) {
      if (!rec) {
        ring.visible = false;
        ring.userData.rec = null;
        return;
      }
      ring.visible = true;
      ring.userData.rec = rec;
      ring.position.copy(rec.pos);
      ring.lookAt(rec.pos.clone().multiplyScalar(2));
      ring.scale.setScalar(1);
    },
    recordAt(instanceId) {
      return records[instanceId] ?? null;
    },
  };
}
