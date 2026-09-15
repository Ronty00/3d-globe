import * as THREE from "three";
import { countries, featured, REGION_COLORS } from "./data/locations.js";
import { EARTH_RADIUS, latLngToVector3 } from "./math.js";

const CORE_RADIUS = 0.013;
const FEATURED_RADIUS = 0.019;

export function createMarkers(earthGroup) {
  const group = new THREE.Group();
  earthGroup.add(group);

  const records = countries.map((c) => ({
    ...c,
    kind: "country",
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
    const s = rec.kind === "featured" ? FEATURED_RADIUS : CORE_RADIUS;
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
      for (let i = 0; i < count; i++) {
        const rec = records[i];
        const pulse = 1 + Math.sin(time * 2.4 + offsets[i]) * 0.16;
        const selected = selectedId && (rec.id === selectedId || rec.featuredId === selectedId);
        const base = rec.kind === "featured" ? FEATURED_RADIUS : CORE_RADIUS;
        world.copy(rec.pos).applyMatrix4(group.matrixWorld).normalize();
        const facing = world.dot(view);
        const fade = selected ? 1 : THREE.MathUtils.smoothstep(facing, 0.02, 0.22);
        const s = base * pulse * (selected ? 1.35 : 1) * Math.max(fade, 0.0001);
        dummy.position.copy(rec.pos);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        cores.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(s * (selected ? 2.05 : 2.0));
        dummy.updateMatrix();
        glows.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(fade > 0.15 || selected ? 0.05 : 0.0001);
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
