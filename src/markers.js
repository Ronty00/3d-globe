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

  const occupied = records.map((r) => ({ lat: r.lat, lng: r.lng }));
  for (const pack of Object.values(PLACES)) {
    for (const place of pack.items) {
      const territory =
        place.type === "state" || place.id === "chandigarh" || place.id === "puducherry";
      if (!territory) continue;
      const override = STATE_MARKER_AT[place.id];
      const lat = override ? override[0] : place.lat;
      const lng = override ? override[1] : place.lng;
      const duplicate = occupied.some((p) => Math.hypot(p.lat - lat, p.lng - lng) < 0.08);
      if (duplicate) continue;
      occupied.push({ lat, lng });
      const country = countries.find((c) => c.iso === place.iso);
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
  const coreGeo = new THREE.SphereGeometry(1, 20, 16);
  const coreMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const cores = new THREE.InstancedMesh(coreGeo, coreMat, count);
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const glowGeo = new THREE.SphereGeometry(1, 32, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glows = new THREE.InstancedMesh(glowGeo, glowMat, count);
  glows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  glows.raycast = () => {};

  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const picks = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), pickMat, count);
  picks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const offsets = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const rec = records[i];
    dummy.position.copy(rec.pos);
    const s = rec.kind === "featured" ? FEATURED_RADIUS : rec.kind === "state" ? STATE_RADIUS : CORE_RADIUS;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    cores.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(s * 3.4);
    dummy.updateMatrix();
    glows.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(0.055);
    dummy.updateMatrix();
    picks.setMatrixAt(i, dummy.matrix);
    color.setHex(rec.color);
    cores.setColorAt(i, color);
    glows.setColorAt(i, color);
    offsets[i] = Math.random() * Math.PI * 2;
    rec.instanceId = i;
  }

  cores.instanceColor.setUsage(THREE.DynamicDrawUsage);
  cores.instanceColor.needsUpdate = true;
  glows.instanceColor.needsUpdate = true;
  cores.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  picks.instanceMatrix.needsUpdate = true;
  group.add(glows, cores, picks);

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

  const pickables = picks;

  return {
    group,
    records,
    pickables,
    update(time, selectedId, camera) {
      const view = camera.position.clone().normalize();
      const world = new THREE.Vector3();
      const cssH = Math.max(1, camera.userData.cssHeight || 800);
      const dist = Math.max(0.5, camera.position.length());
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const coarse = Boolean(camera.userData.coarsePointer);
      const corePx = (CORE_RADIUS * 2 * cssH) / (2 * dist * tanHalf);
      const boost = coarse ? Math.min(2, Math.max(1, 6 / Math.max(corePx, 0.5))) : 1;
      // Dots are a fixed size on the sphere. Shrink them as the camera closes in
      // so a country marker stays a dot instead of covering the terrain.
      const gap = Math.max(0.2, dist - EARTH_RADIUS);
      const zoomFit = THREE.MathUtils.clamp(gap / 3.3, 0.14, 1);
      const pickR = THREE.MathUtils.clamp(
        ((coarse ? 22 : 16) * dist * tanHalf) / cssH,
        0.04,
        coarse ? 0.085 : 0.055
      );
      for (let i = 0; i < count; i++) {
        const rec = records[i];
        const pulse = 1 + Math.sin(time * 2.4 + offsets[i]) * 0.16;
        const selected = selectedId && (rec.id === selectedId || rec.featuredId === selectedId || rec.placeId === selectedId);
        const base = rec.kind === "featured" ? FEATURED_RADIUS : rec.kind === "state" ? STATE_RADIUS : CORE_RADIUS;
        const localOn = dist < LOCAL_SHOW_DISTANCE;
        world.copy(rec.pos).applyMatrix4(group.matrixWorld).normalize();
        const facing = world.dot(view);
        const hiddenDetail = !rec.countryDot && !localOn && !selected;
        const fade = hiddenDetail ? 0 : selected ? 1 : THREE.MathUtils.smoothstep(facing, 0.02, 0.22);
        const s = base * pulse * (selected ? 1.35 : 1) * Math.max(fade, 0.0001) * boost * zoomFit;
        dummy.position.copy(rec.pos);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        cores.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(s * (selected ? 2.05 : 2.0));
        dummy.updateMatrix();
        glows.setMatrixAt(i, dummy.matrix);
        const statePick = Math.min(pickR, 0.022);
        dummy.scale.setScalar(fade > 0.15 || selected ? (rec.kind === "state" ? statePick : pickR) : 0.0001);
        dummy.updateMatrix();
        picks.setMatrixAt(i, dummy.matrix);
      }
      cores.instanceMatrix.needsUpdate = true;
      glows.instanceMatrix.needsUpdate = true;
      picks.instanceMatrix.needsUpdate = true;

      if (ring.userData.rec) {
        ring.material.opacity = 0.4 + Math.sin(time * 3) * 0.2;
        ring.scale.setScalar(1 + (time % 1.8) * 0.18);
      }
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
