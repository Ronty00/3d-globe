import { EARTH_RADIUS } from "./math.js";

/** Keep this in sync with the inline classifier in index.html. */
export function classifyViewport(width, height) {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  if (h <= 520 && w > h) return "land";
  if (w >= 1100 && h >= 680 && w / h >= 1.15) return "desk";
  if (w >= 600 && h >= 560) return "slate";
  return "handset";
}

export function earthAngleAt(distance, radius = EARTH_RADIUS) {
  const ratio = Math.min(0.999, radius / Math.max(distance, radius + 1e-3));
  return 2 * Math.asin(ratio);
}

/**
 * Vertical FOV (degrees) and a view-offset (pixels) so the earth disk at
 * `earthAngle` radians fits inside the free rectangle.
 * Positive offsetY moves the subject up; negative offsetX moves it right.
 */
export function fitVerticalFov({ width, height, occlude, earthAngle, margin = 0.9 }) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const top = Math.max(0, occlude?.top || 0);
  const bottom = Math.max(0, occlude?.bottom || 0);
  const left = Math.max(0, occlude?.left || 0);
  const right = Math.max(0, occlude?.right || 0);
  const freeW = Math.max(48, w - left - right);
  const freeH = Math.max(48, h - top - bottom);
  const need = earthAngle / margin;
  const vFromH = Math.min(Math.PI * 1.2, need / (freeH / h));
  const hNeed = Math.min(Math.PI * 0.98, need / (freeW / w));
  const aspect = w / h;
  const vFromW = 2 * Math.atan(Math.tan(hNeed / 2) / Math.max(0.05, aspect));
  const fov = Math.min(96, Math.max(34, (Math.max(vFromH, vFromW) * 180) / Math.PI));
  const freeCx = left + freeW / 2;
  const freeCy = top + freeH / 2;
  return {
    fov,
    offsetX: -(freeCx - w / 2),
    offsetY: -(freeCy - h / 2),
  };
}

function estimateOcclusion(layout) {
  if (layout === "handset") return { frame: true, top: 76, bottom: 240, left: 0, right: 0 };
  if (layout === "land") return { frame: true, top: 56, bottom: 14, left: 0, right: 0 };
  if (layout === "slate") return { frame: true, top: 88, bottom: 24, left: 300, right: 0 };
  return { frame: false, top: 0, bottom: 0, left: 0, right: 0 };
}

function shown(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden";
}

/** Pixel insets of chrome that should not cover the earth. `canvasRect` is the globe box. */
export function measureOcclusion(canvasRect) {
  const layout = document.documentElement.dataset.layout || "desk";
  const hud = document.getElementById("hud");
  if (layout === "desk") return { frame: false, top: 0, bottom: 0, left: 0, right: 0 };
  if (!hud || hud.hidden || !canvasRect || canvasRect.width < 2) return estimateOcclusion(layout);

  const bar = document.querySelector(".topbar");
  const sheet = document.querySelector(".featured-panel");
  const sky = document.querySelector(".celestial-panel");
  const top = bar && shown(bar) ? Math.max(0, bar.getBoundingClientRect().bottom - canvasRect.top + 8) : 56;
  const sheetOn = shown(sheet);
  const skyOn = shown(sky);

  if (layout === "handset") {
    let edge = canvasRect.bottom;
    if (sheetOn) edge = Math.min(edge, sheet.getBoundingClientRect().top);
    if (skyOn) edge = Math.min(edge, sky.getBoundingClientRect().top);
    return { frame: true, top, bottom: Math.max(0, canvasRect.bottom - edge + 10), left: 0, right: 0 };
  }

  if (layout === "land") {
    let left = 0;
    let right = 0;
    if (sheetOn) left = Math.max(0, sheet.getBoundingClientRect().right - canvasRect.left + 10);
    if (skyOn) right = Math.max(0, canvasRect.right - sky.getBoundingClientRect().left + 10);
    return { frame: true, top, bottom: 12, left, right };
  }

  let left = 0;
  let bottom = 16;
  if (sheetOn) left = Math.max(0, sheet.getBoundingClientRect().right - canvasRect.left + 12);
  if (skyOn) {
    const celH = Math.max(0, canvasRect.bottom - sky.getBoundingClientRect().top);
    bottom = Math.max(bottom, Math.min(celH * 0.45, 120));
  }
  return { frame: true, top, bottom, left, right: 0 };
}

export function notifyStage() {
  document.documentElement.dispatchEvent(new CustomEvent("stagechange"));
}

export function installViewport(onChange) {
  const root = document.documentElement;
  let lastKey = "";
  let raf = 0;

  const apply = (force = false) => {
    const vv = window.visualViewport;
    const layoutW = Math.round(window.innerWidth);
    const layoutH = Math.round(window.innerHeight);
    let width = layoutW;
    let height = layoutH;
    let top = 0;
    let left = 0;
    if (vv) {
      const vw = Math.round(vv.width);
      const vh = Math.round(vv.height);
      const offsetTop = Math.round(vv.offsetTop || 0);
      const offsetLeft = Math.round(vv.offsetLeft || 0);
      // Use the visual viewport when the keyboard or browser chrome shrinks it.
      // Ignore a stale visual viewport that is still larger than the layout viewport.
      if (vh < layoutH - 1 || vw < layoutW - 1 || offsetTop > 1 || offsetLeft > 1) {
        width = Math.min(vw, layoutW);
        height = Math.min(vh, layoutH);
        top = offsetTop;
        left = offsetLeft;
      }
    }
    const layout = classifyViewport(width, height);
    const changed = root.dataset.layout !== layout;
    root.dataset.layout = layout;
    root.style.setProperty("--vv-top", `${top}px`);
    root.style.setProperty("--vv-left", `${left}px`);
    root.style.setProperty("--vv-width", `${width}px`);
    root.style.setProperty("--vv-height", `${height}px`);
    if (changed) {
      root.dispatchEvent(new CustomEvent("layoutchange", { detail: { layout, width, height } }));
    }
    const key = `${width}x${height}@${top},${left}:${layout}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    onChange?.({ width, height, top, left, layout });
  };

  apply(true);
  window.addEventListener("resize", () => apply(false));
  window.addEventListener("orientationchange", () => apply(true));
  window.visualViewport?.addEventListener("resize", () => apply(false));
  window.visualViewport?.addEventListener("scroll", () => apply(false));
  root.addEventListener("stagechange", () => apply(true));

  const watch = new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      apply(true);
    });
  });
  for (const sel of [".topbar", ".featured-panel", ".celestial-panel"]) {
    const el = document.querySelector(sel);
    if (el) watch.observe(el);
  }

  return apply;
}
