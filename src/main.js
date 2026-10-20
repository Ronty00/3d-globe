import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createWorld } from "./world.js";
import { createMarkers } from "./markers.js";
import { bindUI, setHoverStatus } from "./ui.js";
import { EARTH_RADIUS, easeInOutCubic, latLngToVector3, slerpCamera } from "./math.js";
import { earthAngleAt, fitVerticalFov, installViewport, measureOcclusion } from "./layout.js";
import { featured } from "./data/locations.js";
import { createGlobeExtras } from "./globeExtras.js";
import { createAmbience } from "./sound.js";
import { resolveStop } from "./data/explore.js";

const canvas = document.getElementById("globe");
const bootLayout = document.documentElement.dataset.layout || "desk";
const compactBoot = bootLayout === "handset" || bootLayout === "land";
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !compactBoot,
  alpha: false,
  stencil: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
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
controls.minDistance = 1.88;
controls.maxDistance = 7.4;
controls.zoomSpeed = 1.5;
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
let borders;
let extras;
let fly = null;
const ambience = createAmbience();
let tripToken = 0;
let resumeTimer = 0;
let hoverId = null;

const raycaster = new THREE.Raycaster();
let hoverFrame = 0;
let hoverX = 0;
let hoverY = 0;
let hotMarker = false;

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

  const samePoint = (r) => Math.abs(r.lat - loc.lat) < 0.12 && Math.abs(r.lng - loc.lng) < 0.12;
  const rec =
    markers.records.find((r) => loc.placeId && (r.placeId === loc.placeId || r.id === loc.placeId)) ||
    markers.records.find((r) => !loc.placeId && (r.id === loc.id || r.featuredId === loc.id)) ||
    markers.records.find(samePoint) ||
    loc;

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

function pickMarker(clientX, clientY) {
  if (!markers) return null;
  return markers.pick(clientX, clientY, camera, canvas);
}

function queueHover(clientX, clientY) {
  hoverX = clientX;
  hoverY = clientY;
  if (hoverFrame) return;
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0;
    if (!markers || down || !canvas.matches(":hover")) return;
    const rec = pickMarker(hoverX, hoverY);
    const id = rec?.id ?? null;
    const hot = Boolean(rec);
    if (hot !== hotMarker) {
      hotMarker = hot;
      canvas.classList.toggle("is-hot", hot);
    }
    if (id !== hoverId) {
      hoverId = id;
      if (rec) setHoverStatus(`${rec.displayName || rec.name} · ${rec.capital}`);
      else setHoverStatus(camera.userData.coarsePointer ? "Tap a country" : "Hover a country");
    }
    ui.showTooltip(rec, hoverX, hoverY);
  });
}

let down = null;
canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY };
  canvas.classList.add("is-dragging");
  hotMarker = false;
  canvas.classList.remove("is-hot");
  ui.showTooltip(null);
  pauseAuto();
});
canvas.addEventListener("pointerup", (e) => {
  canvas.classList.remove("is-dragging");
  if (!down) return;
  const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  scheduleResume();
  if (dist > 6) return;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || window.innerWidth;
  const h = rect.height || window.innerHeight;
  raycaster.setFromCamera(
    {
      x: ((e.clientX - rect.left) / w) * 2 - 1,
      y: -((e.clientY - rect.top) / h) * 2 + 1,
    },
    camera
  );
  const site = extras?.pickSite(raycaster);
  if (site) {
    flyToLatLng(site.lat, site.lng, 2.85);
    return;
  }
  const rec = pickMarker(e.clientX, e.clientY);
  if (rec) focusLocation(rec);
});
canvas.addEventListener("pointermove", (e) => {
  if (!markers || down) return;
  queueHover(e.clientX, e.clientY);
});
canvas.addEventListener("pointerleave", () => {
  if (hoverFrame) cancelAnimationFrame(hoverFrame);
  hoverFrame = 0;
  ui.showTooltip(null);
  hotMarker = false;
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
  const tag = e.target?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;
  if (typing) return;
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

const coarseQuery = window.matchMedia("(pointer: coarse)");
const syncCoarse = () => {
  camera.userData.coarsePointer = coarseQuery.matches;
};
syncCoarse();
coarseQuery.addEventListener?.("change", syncCoarse);

const homeDistance = HOME_POS.length();

function onViewport(box) {
  canvas.style.top = `${box.top}px`;
  canvas.style.left = `${box.left}px`;
  canvas.style.width = `${box.width}px`;
  canvas.style.height = `${box.height}px`;
  const hud = document.getElementById("hud");
  hud.style.top = "0px";
  hud.style.left = "0px";
  hud.style.width = `${box.width}px`;
  hud.style.height = `${box.height}px`;
  hud.style.transform = `translate(${box.left}px, ${box.top}px)`;

  if (box.width < 2 || box.height < 2) return;
  renderer.setPixelRatio(pixelRatioFor(box.width, box.height, box.layout));
  renderer.setSize(box.width, box.height, false);
  syncBorderResolution();

  const rect = canvas.getBoundingClientRect();
  const bar = document.querySelector(".topbar");
  if (bar) {
    const hudBox = hud.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    const barBottom = Math.max(36, Math.ceil(barBox.bottom - hudBox.top + 6));
    document.documentElement.style.setProperty("--bar-bottom", `${barBottom}px`);
  }
  const occlude = measureOcclusion(rect);
  camera.userData.cssHeight = box.height;
  camera.aspect = box.width / Math.max(1, box.height);

  if (!occlude.frame) {
    camera.fov = 42;
    if (camera.view?.enabled) camera.clearViewOffset();
    else camera.updateProjectionMatrix();
    return;
  }

  const fit = fitVerticalFov({
    width: box.width,
    height: box.height,
    occlude,
    earthAngle: earthAngleAt(homeDistance),
    margin: 0.9,
  });
  camera.fov = fit.fov;
  if (Math.hypot(fit.offsetX, fit.offsetY) < 2) {
    if (camera.view?.enabled) camera.clearViewOffset();
    else camera.updateProjectionMatrix();
  } else {
    camera.setViewOffset(box.width, box.height, fit.offsetX, fit.offsetY, box.width, box.height);
  }
}

const refreshViewport = installViewport(onViewport);

const clock = new THREE.Clock();

function syncCameraNear() {
  const gap = camera.position.length() - EARTH_RADIUS;
  const next = Math.min(0.12, Math.max(0.008, gap * 0.22));
  if (Math.abs(camera.near - next) <= 0.002) return;
  camera.near = next;
  camera.updateProjectionMatrix();
}

function pixelRatioFor(width, height, layout) {
  const dpr = window.devicePixelRatio || 1;
  const cap = layout === "handset" || layout === "land" ? 1.25 : layout === "slate" ? 1.5 : 1.75;
  const budget = 4_500_000;
  const capped = Math.min(dpr, cap);
  const pixels = width * height * capped * capped;
  if (pixels <= budget) return capped;
  return Math.max(1, Math.sqrt(budget / (width * height)));
}

function renderTier() {
  const layout = document.documentElement.dataset.layout || "desk";
  if (layout === "handset" || layout === "land") {
    return {
      earth: [256, 128],
      clouds: [48, 32],
      atmos: [40, 24],
      anisotropy: 4,
      stars: 2200,
      sun: [24, 16],
      moon: [28, 18],
    };
  }
  if (layout === "slate") {
    return {
      earth: [384, 192],
      clouds: [64, 40],
      atmos: [48, 32],
      anisotropy: 6,
      stars: 3200,
      sun: [32, 24],
      moon: [36, 24],
    };
  }
  return {
    earth: [512, 256],
    clouds: [80, 56],
    atmos: [64, 48],
    anisotropy: 8,
    stars: 4500,
    sun: [32, 24],
    moon: [48, 32],
  };
}

function syncBorderResolution() {
  if (!borders) return;
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  if (w < 2 || h < 2) return;
  borders.material.resolution.set(w, h);
}

let frameLive = true;

function tick() {
  if (!frameLive) return;
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

  const gap = Math.max(0, camera.position.length() - EARTH_RADIUS);
  const relief = 1 - THREE.MathUtils.smoothstep(gap, 1.15, 2.7);
  world?.update(dt, state, relief);
  syncCameraNear();
  markers?.update(t, state.selectedId, camera);
  ui.setHours(state.hours);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    frameLive = false;
    return;
  }
  if (frameLive) return;
  frameLive = true;
  clock.getDelta();
  requestAnimationFrame(tick);
});

async function boot() {
  const borderJob = import("./borders.js").then((mod) => mod.borderPositions());
  world = await createWorld(scene, (p, label) => ui.setLoadProgress(p, label), renderTier());
  const [borderMod, positions] = await Promise.all([import("./borders.js"), borderJob]);
  markers = createMarkers(world.earthGroup);
  borders = borderMod.createBorders(world.earthGroup, positions);
  extras = createGlobeExtras(world.earthGroup);
  ui.hideLoader();
  refreshViewport(true);
  tick();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById("loader-status").textContent =
    "Could not initialize WebGL. Check that hardware acceleration is on.";
});
