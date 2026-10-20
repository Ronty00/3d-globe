import * as THREE from "three";
import { EARTH_RADIUS, latLngToVector3 } from "./math.js";

const _unitA = new THREE.Vector3();
const _unitB = new THREE.Vector3();
const _arcQ = new THREE.Quaternion();
const _arcPartial = new THREE.Quaternion();

function slerpVec(a, b, t, target) {
  _unitA.copy(a).normalize();
  _unitB.copy(b).normalize();
  _arcQ.setFromUnitVectors(_unitA, _unitB);
  _arcPartial.identity().slerp(_arcQ, t);
  return target.copy(_unitA).applyQuaternion(_arcPartial);
}

export function createGlobeExtras(earthGroup) {
  const group = new THREE.Group();
  earthGroup.add(group);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.85,
  });

  const siteGeo = new THREE.SphereGeometry(0.016, 12, 10);
  const siteMat = new THREE.MeshBasicMaterial({ color: 0xf5c16c, toneMapped: false });
  let sitesMesh = null;
  let siteRecords = [];

  function clear() {
    while (group.children.length) {
      const ch = group.children[0];
      group.remove(ch);
      if (ch.geometry && ch.geometry !== siteGeo) ch.geometry.dispose();
    }
    sitesMesh = null;
    siteRecords = [];
  }

  function setRoute(stops) {
    clear();
    if (!stops || stops.length < 2) return;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = latLngToVector3(stops[i].lat, stops[i].lng, 1);
      const b = latLngToVector3(stops[i + 1].lat, stops[i + 1].lng, 1);
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const t = k / 48;
        const lift = Math.sin(t * Math.PI) * 0.06;
        pts.push(slerpVec(a, b, t, new THREE.Vector3()).multiplyScalar(EARTH_RADIUS + 0.03 + lift));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    const cores = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.02, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x5eead4, toneMapped: false }),
      stops.length
    );
    const dummy = new THREE.Object3D();
    stops.forEach((s, i) => {
      dummy.position.copy(latLngToVector3(s.lat, s.lng, EARTH_RADIUS + 0.04));
      dummy.updateMatrix();
      cores.setMatrixAt(i, dummy.matrix);
    });
    group.add(cores);
  }

  function setSites(visits) {
    if (sitesMesh) {
      group.remove(sitesMesh);
      sitesMesh = null;
    }
    siteRecords = (visits || []).filter((v) => v.lat != null);
    if (!siteRecords.length) return;
    sitesMesh = new THREE.InstancedMesh(siteGeo, siteMat, siteRecords.length);
    const dummy = new THREE.Object3D();
    siteRecords.forEach((s, i) => {
      dummy.position.copy(latLngToVector3(s.lat, s.lng, EARTH_RADIUS + 0.028));
      dummy.updateMatrix();
      sitesMesh.setMatrixAt(i, dummy.matrix);
    });
    group.add(sitesMesh);
  }

  function pickSite(raycaster) {
    if (!sitesMesh) return null;
    const hits = raycaster.intersectObject(sitesMesh, false);
    if (!hits.length) return null;
    return siteRecords[hits[0].instanceId] || null;
  }

  return { setRoute, setSites, pickSite, clear, group };
}
