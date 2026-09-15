import * as THREE from "three";

const EARTH_RADIUS = 1.6;

export { EARTH_RADIUS };

/** Map lat/lng to a point on a sphere (three-globe / equirectangular convention). */
export function latLngToVector3(lat, lng, radius = EARTH_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function formatCoords(lat, lng) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}  ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

export function formatUTC(hours) {
  const wrapped = ((hours % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UTC`;
}

export function slerpCamera(start, end, t, out) {
  const startN = start.clone().normalize();
  const endN = end.clone().normalize();
  const rot = new THREE.Quaternion().setFromUnitVectors(startN, endN);
  const q = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), rot, t);
  return out
    .copy(startN)
    .applyQuaternion(q)
    .multiplyScalar(THREE.MathUtils.lerp(start.length(), end.length(), t));
}
