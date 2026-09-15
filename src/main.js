import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "./world.js";
import { createMarkers } from "./markers.js";
import { bindUI, setHoverStatus } from "./ui.js";
import { EARTH_RADIUS, easeInOutCubic, latLngToVector3, slerpCamera } from "./math.js";
import { featured } from "./data/locations.js";
import { createGlobeExtras } from "./globeExtras.js";
import { createAmbience } from "./sound.js";
import { resolveStop } from "./data/explore.js";

const canvas = document.getElementById("globe");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.setClearColor(0x04070f, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04070f, 0.0045);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
const HOME_POS = new THREE.Vector3(2.15, 0.72, 4.35);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 2.7;
controls.maxDistance = 7.4;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.target.set(0, 0, 0);
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = Math.PI - 0.18;

const state = {
  orbiting: true,
  sunVisible: true,
  moonVisible: true,
  realtime: false,
  sunAngle: -0.72,
  moonAngle: 3.55,
  sunSpeed: 0.08,
  moonSpeed: 0.22,
  hours: 9,
  autoRotate: true,
  interacting: false,
  selectedId: null,
};

let world;
let markers;
let extras;
let fly = null;
const ambience = createAmbience();
let tripToken = 0;
let resumeTimer = 0;
let hoverId = null;

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
raycaster.params.Points = { threshold: 0.08 };

const ui = bindUI({
  onSelect(loc) {
    focusLocation(loc);
  },
  onReset() {
    tripToken += 1;
    flyTo(HOME_POS.clone(), 0);
    markers.select(null);
    state.selectedId = null;
    extras?.clear();
    ui.hideLocation();
  },
  onToggleAuto() {
    state.autoRotate = !state.autoRotate;
    if (!state.interacting) controls.autoRotate = state.autoRotate;
    return state.autoRotate;
  },
  onCelestial(action, value) {
    if (action === "toggleOrbit") {
      state.orbiting = !state.orbiting;
      if (state.orbiting) state.realtime = false;
      document.getElementById("btn-realtime").classList.toggle("active", state.realtime);
      return state.orbiting;
    }
    if (action === "toggleSun") {
      state.sunVisible = !state.sunVisible;
      return state.sunVisible;
    }
    if (action === "toggleMoon") {
      state.moonVisible = !state.moonVisible;
      return state.moonVisible;
    }
    if (action === "toggleRealtime") {
      state.realtime = !state.realtime;
      if (state.realtime) state.orbiting = false;
      document.getElementById("btn-orbit").classList.toggle("active", state.orbiting);
      return state.realtime;
    }
    if (action === "setHours") {
      state.realtime = false;
      state.orbiting = false;
      document.getElementById("btn-orbit").classList.remove("active");
      document.getElementById("btn-realtime").classList.remove("active");
      state.hours = value;
      state.sunAngle = (value / 24) * Math.PI * 2 + Math.PI;
      return value;
    }
    return false;
  },
  async onExplore(action, payload) {
    if (action === "trip") {
      playTrip(payload);
      return;
    }
    if (action === "route") {
      extras?.setRoute(payload);
      return;
    }
    if (action === "sites") {
      extras?.setSites(payload);
      return;
    }
    if (action === "morning") {
      setSunOver(payload);
      return;
    }
    if (action === "focusSite") {
      flyToLatLng(payload.lat, payload.lng, 2.85);
      return;
    }
    if (action === "sound") {
      const next = !ambience.isEnabled();
      await ambience.setEnabled(next);
      if (next && payload?.placeId) ambience.playFor(payload.placeId);
      return next;
    }
    if (action === "soundPlace" && ambience.isEnabled()) {
      ambience.playFor(payload);
    }
  },
});

function pauseAuto() {
  state.interacting = true;
  controls.autoRotate = false;
  window.clearTimeout(resumeTimer);
  ui.setStatus("Exploring");
}

function scheduleResume() {
  state.interacting = false;
  window.clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(() => {
    if (state.autoRotate && !fly) {
      controls.autoRotate = true;
      ui.setStatus("Auto-rotate on");
    }
  }, 2400);
}

function flyTo(endCam, _unusedTargetY = 0) {
  return new Promise((resolve) => {
    const startCam = camera.position.clone();
    fly = {
      start: performance.now(),
      duration: 1400,
      startCam,
      endCam,
      onDone: resolve,
    };
    controls.autoRotate = false;
    controls.enabled = false;
  });
}

function flyToLatLng(lat, lng, dist = 3.35) {
  const local = latLngToVector3(lat, lng, EARTH_RADIUS);
  world.earthGroup.localToWorld(local);
  const endCam = local.normalize();
  endCam.y += 0.14;
  endCam.normalize().multiplyScalar(dist);
  return flyTo(endCam);
}

function setSunOver(loc) {
  const local = latLngToVector3(loc.lat, loc.lng, EARTH_RADIUS);
  world.earthGroup.localToWorld(local);
  state.orbiting = false;
  state.realtime = false;
  state.sunAngle = Math.atan2(local.z, local.x);
  document.getElementById("btn-orbit").classList.remove("active");
  document.getElementById("btn-realtime").classList.remove("active");
  ui.setStatus("Sun over " + (loc.displayName || loc.name));
}

async function playTrip(trip) {
  const token = ++tripToken;
  const stops = trip.stops.map(resolveStop).filter(Boolean);
  extras?.setRoute(stops);
  pauseAuto();
  for (const stop of stops) {
    if (token !== tripToken) return;
    await focusLocation(stop);
    await new Promise((r) => setTimeout(r, 2400));
  }
}

async function focusLocation(loc) {
  const local = latLngToVector3(loc.lat, loc.lng, EARTH_RADIUS);
  const worldPos = local.clone();
  world.earthGroup.localToWorld(worldPos);
  const endCam = worldPos.clone().normalize();
  endCam.y += 0.14;
  endCam.normalize().multiplyScalar(3.35);
  const moving = flyTo(endCam);

  const rec =
    markers.records.find(
      (r) =>
        r.id === loc.id ||
        r.featuredId === loc.id ||
        (Math.abs(r.lat - loc.lat) < 0.4 && Math.abs(r.lng - loc.lng) < 0.4)
    ) || loc;

  const featuredMatch = featured.find(
    (f) => f.id === loc.id || (Math.abs(f.lat - loc.lat) < 0.4 && Math.abs(f.lng - loc.lng) < 0.4)
  );
  const view = {
    ...rec,
    ...loc,
    displayName: loc.displayName || featuredMatch?.name || loc.name,
    blurb: loc.blurb || featuredMatch?.blurb || rec.blurb,
    country: loc.country || featuredMatch?.country,
    featuredId: featuredMatch?.id,
  };

  state.selectedId = rec.id;
  markers.select(rec);
  ui.showLocation(view);
  await moving;
}

function pick(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(markers.pickables, false);
  if (!hits.length) return null;
  return markers.recordAt(hits[0].instanceId);
}

let down = null;
canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY };
  canvas.classList.add("is-dragging");
  pauseAuto();
});
canvas.addEventListener("pointerup", (e) => {
  canvas.classList.remove("is-dragging");
  if (!down) return;
  const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  scheduleResume();
  if (dist > 6) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const site = extras?.pickSite(raycaster);
  if (site) {
    flyToLatLng(site.lat, site.lng, 2.85);
    return;
  }
  const rec = pick(e.clientX, e.clientY);
  if (rec) focusLocation(rec);
});
canvas.addEventListener("pointermove", (e) => {
  if (!markers) return;
  const rec = pick(e.clientX, e.clientY);
  const id = rec?.id ?? null;
  canvas.classList.toggle("is-hot", Boolean(rec) && !down);
  if (id !== hoverId) {
    hoverId = id;
    if (rec) setHoverStatus(`${rec.displayName || rec.name} · ${rec.capital}`);
    else setHoverStatus("Hover a country");
  }
  ui.showTooltip(rec, e.clientX, e.clientY);
});
canvas.addEventListener("pointerleave", () => {
  ui.showTooltip(null);
  canvas.classList.remove("is-hot");
});
canvas.addEventListener(
  "wheel",
  () => {
    pauseAuto();
    scheduleResume();
  },
  { passive: true }
);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    flyTo(HOME_POS.clone());
    markers.select(null);
    state.selectedId = null;
  }
  if (e.code === "Space") {
    e.preventDefault();
    document.getElementById("btn-autorotate").click();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (fly) {
    const u = Math.min(1, (performance.now() - fly.start) / fly.duration);
    const k = easeInOutCubic(u);
    slerpCamera(fly.startCam, fly.endCam, k, camera.position);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    if (u >= 1) {
      const done = fly.onDone;
      fly = null;
      controls.enabled = true;
      scheduleResume();
      done?.();
    }
  } else {
    controls.update();
  }

  world?.update(dt, state);
  world?.earthGroup.updateMatrixWorld();
  markers?.update(t, state.selectedId, camera);
  ui.setHours(state.hours);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

async function boot() {
  world = await createWorld(scene, (p, label) => ui.setLoadProgress(p, label));
  markers = createMarkers(world.earthGroup);
  extras = createGlobeExtras(world.earthGroup);
  ui.hideLoader();
  tick();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById("loader-status").textContent =
    "Could not initialize WebGL. Check that hardware acceleration is on.";
});
