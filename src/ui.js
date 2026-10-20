import { countries, featured, searchCountries, REGION_COLORS } from "./data/locations.js";
import { formatCoords, formatUTC } from "./math.js";
import { loadDossier, formatPopulation, formatArea } from "./dossier.js";
import { rankTone } from "./data/rankings.js";
import { placesFor, findPlaces, getPlace } from "./data/places.js";
import { commonsPhoto, wikiSummary, creditLine } from "./media/wikimedia.js";
import { CULTURE_LABELS } from "./data/culture.js";
import { itemsFromText } from "./data/catalogs.js";
import {
  TRIPS,
  VISITS,
  searchExplore,
  resolveStop,
  seasonNow,
  localClock,
  haversineKm,
  flightHours,
  savePins,
  pinsFromURL,
  pinKey,
  locToPin,
} from "./data/explore.js";
import { notifyStage } from "./layout.js";

export function bindUI({ onSelect, onReset, onToggleAuto, onCelestial, onExplore }) {
  const featuredList = document.getElementById("featured-list");
  const search = document.getElementById("search");
  const results = document.getElementById("search-results");
  const info = document.getElementById("info-panel");
  const backdrop = document.getElementById("dossier-backdrop");
  const tooltip = document.getElementById("tooltip");
  let currentLoc = null;
  let compareA = null;
  let compareArmed = false;
  let pins = pinsFromURL();
  let userCollapsed = false;
  const sheet = document.querySelector(".featured-panel");
  const sky = document.querySelector(".celestial-panel");

  document.addEventListener("selectstart", (e) => {
    const el = e.target instanceof Element ? e.target : e.target?.parentElement;
    if (el?.closest("input, textarea, [contenteditable='true']")) return;
    e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (el?.closest("input, textarea")) return;
    e.preventDefault();
  });

  if (window.matchMedia("(pointer: coarse)").matches) {
    document.getElementById("status-hover").textContent = "Tap a country";
    const hint = document.querySelector(".polaroid-hint");
    if (hint) hint.textContent = "Drag to rotate · pinch to zoom · tap outside to close";
  }

  document.getElementById("country-count").textContent = `${countries.length} countries`;

  featuredList.innerHTML = featured
    .map((f) => {
      const hex = "#" + (REGION_COLORS[f.region] ?? 0x88c0ff).toString(16).padStart(6, "0");
      return `<li data-id="${f.id}" data-kind="featured">
        <span class="dot" style="color:${hex};background:${hex}"></span>
        <span class="place-name">${f.name}</span>
        <span class="place-meta">${f.country}</span>
      </li>`;
    })
    .join("");

  featuredList.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const item = featured.find((f) => f.id === li.dataset.id);
    if (item) onSelect(toLocation(item));
  });

  let searchFrame = 0;
  search.addEventListener("input", () => {
    const q = search.value;
    if (searchFrame) cancelAnimationFrame(searchFrame);
    searchFrame = requestAnimationFrame(() => {
      searchFrame = 0;
      runSearch(q);
    });
  });

  function runSearch(q) {
    if (q.trim()) revealSheetForSearch();
    if (!q.trim()) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }
    const found = searchExplore(q);
    results.hidden = false;
    const countryHtml = found.countries
      .map((c) => {
        const hex = "#" + (REGION_COLORS[c.region] ?? 0x88c0ff).toString(16).padStart(6, "0");
        return `<li data-kind="country" data-id="${c.id}">
          <span class="dot" style="color:${hex};background:${hex}"></span>
          <span class="place-name">${c.name}</span>
          <span class="place-meta">${c.capital}</span>
        </li>`;
      })
      .join("");
    const placeHtml = found.places
      .map((p) => {
        const country = countries.find((c) => c.id === p.iso);
        return `<li data-kind="place" data-iso="${p.iso}" data-place="${p.id}">
          <span class="dot" style="color:#f5c16c;background:#f5c16c"></span>
          <span class="place-name">${p.name}</span>
          <span class="place-meta">${country?.name || p.iso} · ${p.type}</span>
        </li>`;
      })
      .join("");
    const topicHtml = found.topics
      .map(
        (t) => `<li data-kind="place" data-iso="${t.iso}" data-place="${t.place.id}">
          <span class="dot" style="color:#fb7185;background:#fb7185"></span>
          <span class="place-name">${t.label}</span>
          <span class="place-meta">${t.place.name} · ${t.topic}</span>
        </li>`
      )
      .join("");
    const html = countryHtml + placeHtml + topicHtml;
    results.innerHTML = html || `<li><span></span><span class="place-name">No matches</span></li>`;
  }

  results.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id], li[data-place]");
    if (!li) return;
    search.value = "";
    results.hidden = true;
    if (li.dataset.kind === "place") {
      const place = getPlace(li.dataset.iso, li.dataset.place);
      if (place) onSelect(placeToLoc(place));
      return;
    }
    const item = countries.find((c) => c.id === li.dataset.id);
    if (item) onSelect(item);
  });

  document.getElementById("btn-reset").addEventListener("click", onReset);
  document.getElementById("btn-autorotate").addEventListener("click", (e) => {
    const next = onToggleAuto();
    e.currentTarget.classList.toggle("active", next);
    e.currentTarget.setAttribute("aria-pressed", String(next));
    setStatus(next ? "Auto-rotate on" : "Auto-rotate paused");
  });

  document.getElementById("btn-orbit").addEventListener("click", (e) => {
    const on = onCelestial("toggleOrbit");
    e.currentTarget.classList.toggle("active", on);
    e.currentTarget.setAttribute("aria-pressed", String(on));
  });
  document.getElementById("btn-sun").addEventListener("click", (e) => {
    const on = onCelestial("toggleSun");
    e.currentTarget.classList.toggle("active", on);
    e.currentTarget.setAttribute("aria-pressed", String(on));
  });
  document.getElementById("btn-moon").addEventListener("click", (e) => {
    const on = onCelestial("toggleMoon");
    e.currentTarget.classList.toggle("active", on);
    e.currentTarget.setAttribute("aria-pressed", String(on));
  });
  document.getElementById("btn-realtime").addEventListener("click", (e) => {
    const on = onCelestial("toggleRealtime");
    e.currentTarget.classList.toggle("active", on);
  });

  const slider = document.getElementById("time-slider");
  const timeLabel = document.getElementById("time-label");
  let shownHours = "";
  let shownSlider = "";
  slider.addEventListener("input", () => {
    onCelestial("setHours", Number(slider.value));
  });

  function layoutName() {
    return document.documentElement.dataset.layout || "desk";
  }

  function syncDrawers() {
    const skyBtn = document.getElementById("btn-celestial-panel");
    const placesBtn = document.getElementById("btn-places-panel");
    const sheetBtn = document.getElementById("btn-sheet");
    const skyOpen = sky.classList.contains("is-open");
    const placesOpen = sheet.classList.contains("is-open");
    const collapsed = sheet.classList.contains("is-collapsed");
    skyBtn.setAttribute("aria-expanded", String(skyOpen));
    skyBtn.classList.toggle("active", skyOpen);
    placesBtn.setAttribute("aria-expanded", String(placesOpen));
    placesBtn.classList.toggle("active", placesOpen);
    sheetBtn.setAttribute("aria-expanded", String(!collapsed));
    sheetBtn.textContent = collapsed ? "Show" : "Hide";
    notifyStage();
  }

  function revealSheetForSearch() {
    const layout = layoutName();
    if (layout === "handset") {
      userCollapsed = false;
      sheet.classList.remove("is-collapsed", "is-covered");
      sky.classList.remove("is-open");
      syncDrawers();
    } else if (layout === "land" && !sheet.classList.contains("is-open")) {
      sheet.classList.add("is-open");
      sky.classList.remove("is-open");
      syncDrawers();
    }
  }

  document.getElementById("btn-celestial-panel").addEventListener("click", () => {
    const layout = layoutName();
    const open = !sky.classList.contains("is-open");
    sky.classList.toggle("is-open", open);
    if (layout === "handset") {
      sheet.classList.toggle("is-covered", open);
      if (open) sheet.classList.add("is-collapsed");
      else sheet.classList.toggle("is-collapsed", userCollapsed);
    }
    if ((layout === "land" || layout === "slate") && open) sheet.classList.remove("is-open");
    syncDrawers();
  });

  document.getElementById("btn-places-panel").addEventListener("click", () => {
    const open = !sheet.classList.contains("is-open");
    sheet.classList.toggle("is-open", open);
    if (open) sky.classList.remove("is-open");
    syncDrawers();
  });

  document.getElementById("btn-sheet").addEventListener("click", () => {
    userCollapsed = !sheet.classList.contains("is-collapsed");
    sheet.classList.toggle("is-collapsed", userCollapsed);
    if (!userCollapsed) {
      sky.classList.remove("is-open");
      sheet.classList.remove("is-covered");
    }
    syncDrawers();
  });

  document.documentElement.addEventListener("layoutchange", () => {
    const layout = layoutName();
    sky.classList.remove("is-open");
    sheet.classList.remove("is-open", "is-covered");
    if (layout === "handset") sheet.classList.toggle("is-collapsed", userCollapsed);
    else sheet.classList.remove("is-collapsed");
    syncDrawers();
  });

  function closeDossier() {
    info.hidden = true;
    info.classList.remove("is-open");
    backdrop.hidden = true;
    backdrop.classList.remove("is-open");
  }

  document.getElementById("btn-close-dossier").addEventListener("click", closeDossier);
  backdrop.addEventListener("click", closeDossier);
  bindPolaroidLightbox();

  document.getElementById("trips-list").innerHTML = TRIPS.map(
    (t) => `<li data-trip="${t.id}">
      <span class="dot" style="color:#5eead4;background:#5eead4"></span>
      <span class="place-name">${t.name}</span>
      <span class="place-meta">${t.stops.length} stops</span>
      <span class="trip-blurb">${t.blurb}</span>
    </li>`
  ).join("");

  function renderAtlas() {
    const list = document.getElementById("atlas-list");
    list.innerHTML = pins.length
      ? pins
          .map(
            (p) => `<li data-kind="pin" data-iso="${p.iso}" data-place="${p.placeId}">
              <span class="dot" style="color:#f5c16c;background:#f5c16c"></span>
              <span class="place-name">${p.name}</span>
              <span class="place-meta">pinned</span>
            </li>`
          )
          .join("")
      : `<li><span></span><span class="place-name">Pin places from a dossier. Share the URL to keep them.</span></li>`;
  }
  renderAtlas();

  document.getElementById("side-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-side]");
    if (!btn) return;
    document.querySelectorAll("#side-tabs button").forEach((b) => b.classList.toggle("active", b === btn));
    document.getElementById("featured-list").hidden = btn.dataset.side !== "featured";
    document.getElementById("trips-list").hidden = btn.dataset.side !== "trips";
    document.getElementById("atlas-list").hidden = btn.dataset.side !== "atlas";
  });

  document.getElementById("trips-list").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-trip]");
    if (!li) return;
    const trip = TRIPS.find((t) => t.id === li.dataset.trip);
    if (trip) onExplore?.("trip", trip);
  });

  document.getElementById("atlas-list").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-iso]");
    if (!li) return;
    if (li.dataset.place) {
      const place = getPlace(li.dataset.iso, li.dataset.place);
      if (place) onSelect(placeToLoc(place));
    } else {
      const c = countries.find((x) => x.id === li.dataset.iso);
      if (c) onSelect(c);
    }
  });

  document.getElementById("btn-pin").addEventListener("click", () => {
    if (!currentLoc) return;
    const key = pinKey(currentLoc);
    const exists = pins.some((p) => pinKey(p) === key);
    pins = exists ? pins.filter((p) => pinKey(p) !== key) : [...pins, locToPin(currentLoc)];
    savePins(pins);
    renderAtlas();
    document.getElementById("btn-pin").textContent = exists ? "Pin" : "Pinned";
    document.getElementById("btn-pin").classList.toggle("active", !exists);
  });

  document.getElementById("btn-compare").addEventListener("click", () => {
    if (!currentLoc) return;
    compareA = currentLoc;
    compareArmed = true;
    document.getElementById("btn-compare").textContent = "Pick another place";
    document.getElementById("btn-compare").classList.add("active");
    setStatus("Compare: choose a second city");
  });

  document.getElementById("btn-morning").addEventListener("click", () => {
    if (currentLoc) onExplore?.("morning", currentLoc);
  });

  document.getElementById("btn-sound").addEventListener("click", async () => {
    const on = await onExplore?.("sound", currentLoc);
    document.getElementById("btn-sound").classList.toggle("active", Boolean(on));
    document.getElementById("btn-sound").textContent = on ? "Sound on" : "Sound";
  });

  document.getElementById("visit-strip").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-visit]");
    if (!li || !currentLoc) return;
    const visit = VISITS[currentLoc.placeId]?.[Number(li.dataset.visit)];
    if (!visit) return;
    onExplore?.("focusSite", visit);
  });

  document.getElementById("dossier-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    setTab(btn.dataset.tab);
  });

  document.getElementById("btn-focus").addEventListener("click", () => {
    const id = info.dataset.id;
    if (!id) return;
    const loc = featured.find((f) => f.id === id) || countries.find((c) => c.id === id);
    if (loc) onSelect(toLocation(loc));
  });

  document.getElementById("tab-places").addEventListener("click", (e) => {
    const li = e.target.closest("li[data-place]");
    if (!li) return;
    const place = getPlace(li.dataset.iso, li.dataset.place);
    if (place) onSelect(placeToLoc(place));
  });

  info.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-back-iso]");
    if (!btn) return;
    const country = countries.find((c) => c.id === btn.dataset.backIso);
    if (country) onSelect(country);
  });

  function fillCompare(a, b) {
    const km = haversineKm(a, b);
    const aName = a.displayName || a.name;
    const bName = b.displayName || b.name;
    const aPlace = a.placeId ? getPlace(a.iso || a.id, a.placeId) : null;
    const bPlace = b.placeId ? getPlace(b.iso || b.id, b.placeId) : null;
    const foods = (p, loc) =>
      (p?.items?.food || itemsFromText(p?.food || "", loc.displayName || loc.name))
        .slice(0, 8)
        .map((f) => `<li>${escapeHtml(f.name)}</li>`)
        .join("") || "<li>—</li>";
    document.getElementById("tab-compare").innerHTML = `
      <p>${escapeHtml(aName)} ↔ ${escapeHtml(bName)} · ${Math.round(km)} km · ~${flightHours(km)} h flight</p>
      <div class="compare-grid">
        <div>
          <h3>${escapeHtml(aName)}</h3>
          <p>${escapeHtml((aPlace || a).food || a.blurb || "")}</p>
          <ul class="catalog-list">${foods(aPlace, a)}</ul>
        </div>
        <div>
          <h3>${escapeHtml(bName)}</h3>
          <p>${escapeHtml((bPlace || b).food || b.blurb || "")}</p>
          <ul class="catalog-list">${foods(bPlace, b)}</ul>
        </div>
      </div>`;
    onExplore?.("route", [a, b]);
  }

  return {
    showLocation(loc) {
      if (!loc.placeId) {
        const iso = (loc.iso || loc.id || "").toLowerCase().slice(0, 2);
        const label = (loc.displayName || loc.name || "").toLowerCase();
        const match = placesFor(iso).items.find((p) => p.name.toLowerCase() === label);
        if (match) loc = { ...placeToLoc(match), featuredId: loc.featuredId || loc.id };
      }
      if (compareArmed && compareA && pinKey(loc) !== pinKey(compareA)) {
        compareArmed = false;
        document.getElementById("btn-compare").textContent = "Compare";
        document.getElementById("btn-compare").classList.remove("active");
        fillCompare(compareA, loc);
        setTab("compare");
      }
      currentLoc = loc;
      info.hidden = false;
      info.classList.add("is-open");
      backdrop.hidden = false;
      backdrop.classList.add("is-open");
      info.dataset.id = loc.featuredId || loc.placeId || loc.id;
      renderDossierShell(loc);
      featuredList.querySelectorAll("li").forEach((li) => {
        li.classList.toggle("is-active", li.dataset.id === loc.featuredId || li.dataset.id === loc.id);
      });
      const key = pinKey(loc);
      const pinned = pins.some((p) => pinKey(p) === key);
      document.getElementById("btn-pin").textContent = pinned ? "Pinned" : "Pin";
      document.getElementById("btn-pin").classList.toggle("active", pinned);
      fillDossier(loc);
      renderNowAndVisit(loc);
      onExplore?.("sites", loc.placeId ? VISITS[loc.placeId] || [] : []);
      onExplore?.("soundPlace", loc.placeId || loc.iso);
    },
    hideLocation() {
      closeDossier();
    },
    showTooltip(loc, x, y) {
      if (!loc || coarsePointer) {
        tooltip.hidden = true;
        return;
      }
      const text = loc.displayName
        ? `${loc.displayName} · ${loc.country || loc.name}`
        : `${loc.name} · ${loc.capital}`;
      tooltip.hidden = false;
      if (tooltip.textContent !== text) {
        tooltip.textContent = text;
        tipSize.w = 0;
      }
      const pad = 8;
      if (!tipSize.w) {
        tipSize.w = tooltip.offsetWidth;
        tipSize.h = tooltip.offsetHeight;
      }
      const tw = tipSize.w;
      const th = tipSize.h;
      const bounds = canvasBounds();
      let left = x + 14;
      let top = y - th - 12;
      if (left + tw > bounds.right - pad) left = Math.max(bounds.left + pad, x - tw - 14);
      if (top < bounds.top + pad) top = y + 18;
      if (top + th > bounds.bottom - pad) top = Math.max(bounds.top + pad, bounds.bottom - th - pad);
      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `${Math.round(top)}px`;
    },
    setHours(hours) {
      const label = formatUTC(hours);
      if (label !== shownHours) {
        shownHours = label;
        timeLabel.textContent = label;
      }
      if (document.activeElement === slider) return;
      const next = String(Math.round(hours * 50) / 50);
      if (next === shownSlider) return;
      shownSlider = next;
      slider.value = next;
    },
    setStatus,
    hideLoader() {
      document.getElementById("loader").classList.add("is-done");
      document.getElementById("hud").hidden = false;
    },
    setLoadProgress(t, label) {
      document.getElementById("loader-fill").style.width = `${Math.round(t * 100)}%`;
      if (label) document.getElementById("loader-status").textContent = label;
    },
  };
}

const coarseMedia = window.matchMedia("(pointer: coarse)");
let coarsePointer = coarseMedia.matches;
coarseMedia.addEventListener?.("change", () => {
  coarsePointer = coarseMedia.matches;
});

const tipSize = { w: 0, h: 0 };
let canvasBox = null;
window.addEventListener("resize", () => {
  canvasBox = null;
});
window.visualViewport?.addEventListener("resize", () => {
  canvasBox = null;
});
window.visualViewport?.addEventListener("scroll", () => {
  canvasBox = null;
});

function canvasBounds() {
  if (canvasBox) return canvasBox;
  const canvas = document.getElementById("globe");
  const rect = canvas?.getBoundingClientRect();
  canvasBox = rect
    ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  return canvasBox;
}

function toLocation(item) {
  return {
    ...item,
    kind: item.country && item.name !== item.country ? "featured" : item.kind || "country",
    displayName: item.name,
  };
}

function placeToLoc(place) {
  const country = countries.find((c) => c.id === place.iso);
  return {
    ...country,
    iso: place.iso,
    id: place.iso,
    placeId: place.id,
    displayName: place.name,
    lat: place.lat,
    lng: place.lng,
    kind: "place",
    capital: place.region,
  };
}

function renderNowAndVisit(loc) {
  const chip = document.getElementById("now-chip");
  const strip = document.getElementById("visit-strip");
  const season = loc.placeId ? seasonNow(loc.placeId) : null;
  const clock = localClock(loc.lng);
  if (season) {
    chip.hidden = false;
    chip.textContent = `Now · ${clock} · ${season.title} — ${season.note}`;
  } else {
    chip.hidden = false;
    chip.textContent = `Now · ${clock}`;
  }
  const visits = loc.placeId ? VISITS[loc.placeId] : null;
  if (!visits) {
    strip.hidden = true;
    strip.innerHTML = "";
    return;
  }
  strip.hidden = false;
  strip.innerHTML = visits
    .map(
      (v, i) => `<li data-visit="${i}">
        <em class="when">${v.when}</em>
        <strong>${v.title}</strong>
        <span>${v.note}</span>
      </li>`
    )
    .join("");
}

function countryNameOf(loc) {
  if (loc.kind === "place") {
    const c = countries.find((x) => x.id === loc.iso);
    return c?.name || loc.name;
  }
  if (loc.country && loc.name !== loc.country) return loc.country;
  return loc.name;
}

function renderDossierShell(loc) {
  const iso = (loc.iso || loc.id || "").toLowerCase().slice(0, 2);
  const country = countryNameOf(loc);
  const place = loc.placeId ? getPlace(iso, loc.placeId) : null;
  document.getElementById("info-region").textContent = place
    ? `${country} · ${place.type}`
    : loc.region || "Location";
  document.getElementById("info-title").textContent = place ? place.name : country;
  document.getElementById("info-official").textContent = "Loading dossier…";
  document.getElementById("info-capital").textContent = place
    ? place.region
    : loc.capital
      ? `Capital · ${loc.capital}`
      : "";
  document.getElementById("info-coords").textContent = formatCoords(loc.lat, loc.lng);
  const focus = document.getElementById("info-focus");
  if (place) {
    focus.hidden = false;
    focus.innerHTML = `<button type="button" class="dossier-back" data-back-iso="${iso}">← ${escapeHtml(country)}</button>`;
  } else if (loc.displayName && loc.displayName !== country) {
    focus.hidden = false;
    focus.textContent = `Exploring from ${loc.displayName}`;
  } else {
    focus.hidden = true;
    focus.textContent = "";
  }
  const flag = document.getElementById("info-flag");
  flag.src = `https://flagcdn.com/w80/${iso}.png`;
  flag.alt = `Flag of ${country}`;
  document.getElementById("info-facts").innerHTML = "";
  document.getElementById("tab-about").innerHTML = "<p>Gathering notes…</p>";
  document.getElementById("tab-culture").innerHTML = "";
  document.getElementById("tab-places").innerHTML = "";
  document.getElementById("tab-ranks").innerHTML = "";
  setTab(place ? "culture" : "about");
}

async function fillDossier(loc) {
  const dossier = await loadDossier(loc);
  const iso = dossier.iso;
  const place = loc.placeId ? getPlace(iso, loc.placeId) : null;
  const rest = dossier.rest;

  document.getElementById("info-official").textContent = place
    ? `${place.type} in ${countryNameOf(loc)}`
    : rest?.official || "";
  if (rest?.flag && !place) document.getElementById("info-flag").src = rest.flag;
  if (rest?.capital && !place) {
    document.getElementById("info-capital").textContent = `Capital · ${rest.capital}`;
  }

  const chips = [];
  if (place) {
    chips.push(place.type);
    chips.push(place.region);
  } else {
    if (rest?.demonym) chips.push(rest.demonym);
    if (rest?.population) chips.push(formatPopulation(rest.population));
    if (rest?.area) chips.push(formatArea(rest.area));
    if (rest?.subregion) chips.push(rest.subregion);
    if (rest?.languages?.length) chips.push(rest.languages.slice(0, 3).join(", "));
    if (rest?.currencies?.length) chips.push(rest.currencies[0]);
    dossier.ranks
      .filter((r) => r.rank && r.rank <= 10 && r.key !== "area")
      .slice(0, 3)
      .forEach((r) => chips.push(`${r.label} #${r.rank}`));
  }
  document.getElementById("info-facts").innerHTML = chips
    .map((c) => `<span class="fact-chip">${escapeHtml(c)}</span>`)
    .join("");

  const wikiTitle = place ? place.name : dossier.countryName;
  let placeWiki = null;
  try {
    placeWiki = await wikiSummary(wikiTitle);
  } catch {
    placeWiki = null;
  }

  const about = [];
  if (placeWiki?.hero) about.push(photoFigure(placeWiki.hero));
  const extract = placeWiki?.extract || dossier.wiki?.extract;
  if (extract) about.push(`<p>${escapeHtml(extract)}</p>`);
  else {
    about.push(
      `<p>${escapeHtml(place ? place.culture : loc.blurb || `${dossier.countryName} is a country in ${loc.region || "the world"}.`)}</p>`
    );
  }
  if (!place && rest?.timezones?.[0]) about.push(`<p>Timezone · ${escapeHtml(rest.timezones[0])}</p>`);
  const moreUrl = placeWiki?.url || dossier.wiki?.url;
  if (moreUrl) {
    about.push(`<p><a href="${moreUrl}" target="_blank" rel="noreferrer">Read more on Wikipedia</a></p>`);
  }
  about.push(
    `<p class="rank-source">Photos are copied into local bytecode (data URLs) and shown with author + license credit from Wikimedia Commons / Wikipedia. Copyright stays with the original authors.</p>`
  );
  document.getElementById("tab-about").innerHTML = about.join("");

  const culture = place
    ? {
        people: place.people,
        culture: place.culture,
        food: place.food,
        heritage: place.heritage,
        historic: place.historic,
        wildlife: place.wildlife,
      }
    : dossier.culture;

  if (culture) {
    document.getElementById("tab-culture").innerHTML = Object.entries(CULTURE_LABELS)
      .map(([key, label]) => {
        if (!culture[key]) return "";
        const list = place?.items?.[key] || itemsFromText(culture[key], wikiTitle);
        const photos = list.slice(0, 8);
        const polaroids = photos
          .map(
            (it, i) =>
              `<figure class="polaroid is-loading" style="--tilt:${(i % 2 ? 2 : -2) + (i % 3) - 1}deg" data-photo-query="${escapeHtml(it.query)}" data-caption="${escapeHtml(it.name)}"></figure>`
          )
          .join("");
        const notes = list
          .map(
            (it) =>
              `<li><strong>${escapeHtml(it.name)}</strong>${it.note ? ` — ${escapeHtml(it.note)}` : ""}</li>`
          )
          .join("");
        return `<section class="catalog-block">
          <h3>${label}</h3>
          <p>${escapeHtml(culture[key])}</p>
          <div class="polaroid-row">${polaroids}</div>
          <ul class="catalog-list">${notes}</ul>
        </section>`;
      })
      .join("");
    loadCulturePhotos();
  } else {
    document.getElementById("tab-culture").innerHTML = "<p>Culture notes are not available for this place yet.</p>";
  }

  renderPlacesTab(iso, loc, place);

  if (place) {
    document.getElementById("tab-ranks").innerHTML =
      `<p>Rankings are shown at country level. Open <button type="button" class="tiny" data-back-iso="${iso}">${escapeHtml(countryNameOf(loc))}</button> for happiness, passport, military and economy ranks.</p>`;
  } else {
    const ranks = dossier.ranks;
    document.getElementById("tab-ranks").innerHTML =
      ranks
        .map((r) => {
          const tone = rankTone(r.rank, r.outOf);
          const label = r.rank ? `#${r.rank} <span>/ ${r.outOf}</span>` : "Unranked";
          const pct = r.rank ? Math.max(6, Math.round((1 - (r.rank - 1) / r.outOf) * 100)) : 0;
          return `<div class="rank-row ${tone}">
            <span>${escapeHtml(r.label)}</span>
            <strong>${label}</strong>
            <div class="rank-bar"><span style="width:${pct}%"></span></div>
          </div>`;
        })
        .join("") +
      `<p class="rank-source">Ranks compiled from public 2024–2026 indices. Lower number is better, except population and area.</p>`;
  }
}

function renderPlacesTab(iso, loc, active) {
  const pack = placesFor(iso);
  let items = pack.items.slice();
  if (!items.length && loc.capital) {
    items = [
      {
        id: `${iso}-capital`,
        iso,
        name: loc.capital,
        type: "capital",
        region: loc.name || countryNameOf(loc),
        lat: loc.lat,
        lng: loc.lng,
      },
    ];
  }
  if (!items.length) {
    document.getElementById("tab-places").innerHTML = "<p>Open the capital marker, or search a city name.</p>";
    return;
  }
  const groups = { state: "Administrative divisions", capital: "Capitals", city: "Cities" };
  const html = Object.entries(groups)
    .map(([type, label]) => {
      const rows = items.filter((p) => p.type === type);
      if (!rows.length) return "";
      return `<h3 class="places-h">${label}</h3>
        <ul class="place-list">${rows
          .map(
            (p) => `<li data-iso="${p.iso}" data-place="${p.id}" class="${active?.id === p.id ? "is-active" : ""}">
              <span class="place-name">${escapeHtml(p.name)}</span>
              <span class="place-type">${escapeHtml(p.region)}</span>
            </li>`
          )
          .join("")}</ul>`;
    })
    .join("");
  document.getElementById("tab-places").innerHTML =
    html ||
    `<ul class="place-list">${items
      .map(
        (p) => `<li data-iso="${p.iso}" data-place="${p.id}">
          <span class="place-name">${escapeHtml(p.name)}</span>
          <span class="place-type">${escapeHtml(p.type)}</span>
        </li>`
      )
      .join("")}</ul>`;
}

function photoFigure(photo) {
  const id = storePhoto(photo);
  return `<figure class="polaroid" data-photo-id="${id}" data-caption="${escapeHtml(photo.title || "")}" style="--tilt:-2deg">
    <img src="${photo.dataUrl}" alt="${escapeHtml(photo.title || "")}" draggable="false" />
    <figcaption><strong>${escapeHtml(photo.title || "Photo")}</strong><span>${escapeHtml(creditLine(photo))}</span></figcaption>
  </figure>`;
}

const photoStore = new Map();
let photoSeq = 0;
function storePhoto(photo) {
  const id = String(++photoSeq);
  photoStore.set(id, photo);
  return id;
}

async function loadCulturePhotos() {
  const nodes = [...document.querySelectorAll("#tab-culture [data-photo-query]")];
  await Promise.allSettled(
    nodes.map(async (el) => {
      const q = el.getAttribute("data-photo-query");
      const caption = el.getAttribute("data-caption") || q;
      try {
        const photo = await commonsPhoto(q);
        if (!photo || !document.body.contains(el)) {
          el.remove();
          return;
        }
        const id = storePhoto(photo);
        el.classList.remove("is-loading");
        el.dataset.photoId = id;
        el.innerHTML = `<img src="${photo.dataUrl}" alt="${escapeHtml(caption)}" draggable="false" /><figcaption><strong>${escapeHtml(caption)}</strong><span>${escapeHtml(creditLine(photo))}</span></figcaption>`;
      } catch {
        el.remove();
      }
    })
  );
}

function bindPolaroidLightbox() {
  const box = document.getElementById("polaroid-lightbox");
  const card = document.getElementById("polaroid-card");
  const img = document.getElementById("polaroid-img");
  const cap = document.getElementById("polaroid-caption");
  const cred = document.getElementById("polaroid-credit");
  const rot = { x: 6, y: -8, z: -3, s: 1 };
  let drag = null;

  function apply() {
    card.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg) rotateZ(${rot.z}deg) scale(${rot.s})`;
  }

  function open(photo, caption) {
    img.src = photo.dataUrl;
    img.alt = caption || photo.title || "";
    cap.textContent = caption || photo.title || "Photo";
    cred.textContent = creditLine(photo);
    rot.x = 6;
    rot.y = -8;
    rot.z = -3;
    rot.s = 1;
    apply();
    box.hidden = false;
    box.classList.add("is-open");
  }

  function close() {
    box.hidden = true;
    box.classList.remove("is-open");
  }

  document.getElementById("info-panel").addEventListener("click", (e) => {
    const fig = e.target.closest(".polaroid[data-photo-id]");
    if (!fig) return;
    const photo = photoStore.get(fig.dataset.photoId);
    if (photo) open(photo, fig.dataset.caption || fig.querySelector("strong")?.textContent);
  });

  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.classList.contains("polaroid-hint")) close();
  });

  card.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY };
    card.setPointerCapture(e.pointerId);
    card.style.cursor = "grabbing";
  });
  card.addEventListener("pointerup", () => {
    drag = null;
    card.style.cursor = "grab";
  });
  card.addEventListener("pointermove", (e) => {
    if (!drag) return;
    rot.y += (e.clientX - drag.x) * 0.35;
    rot.x -= (e.clientY - drag.y) * 0.3;
    drag = { x: e.clientX, y: e.clientY };
    apply();
  });
  box.addEventListener(
    "wheel",
    (e) => {
      if (!box.classList.contains("is-open")) return;
      e.preventDefault();
      rot.s = Math.min(1.8, Math.max(0.6, rot.s + (e.deltaY > 0 ? -0.08 : 0.08)));
      apply();
    },
    { passive: false }
  );
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && box.classList.contains("is-open")) {
      e.stopPropagation();
      close();
    }
  });
}

function setTab(name) {
  document.querySelectorAll(".dossier-tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".dossier-tab").forEach((el) => {
    el.hidden = el.id !== `tab-${name}`;
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text) {
  document.getElementById("status-mode").textContent = text;
}

export function setHoverStatus(text) {
  document.getElementById("status-hover").textContent = text;
}
