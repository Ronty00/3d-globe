import { countries, searchCountries } from "./locations.js";
import { findPlaces, getPlace, PLACES } from "./places.js";
import { CATALOGS } from "./catalogs.js";

export const TRIPS = [
  {
    id: "spice",
    name: "Capitals of spice",
    blurb: "A monsoon-side run of kitchens that taught the world to want heat.",
    stops: [
      { iso: "in", placeId: "kerala" },
      { iso: "in", placeId: "chennai" },
      { iso: "lk" },
      { iso: "th" },
      { iso: "id" },
      { iso: "tz" },
    ],
  },
  {
    id: "silk",
    name: "Silk Road",
    blurb: "Caravan cities from the Yellow River to a lagoon republic.",
    stops: [
      { iso: "cn", placeId: "xi-an" },
      { iso: "uz" },
      { iso: "ir" },
      { iso: "tr", placeId: "istanbul" },
      { iso: "it", placeId: "venice" },
    ],
  },
  {
    id: "monsoon",
    name: "Monsoon cities",
    blurb: "Where the sky breaks open and the street food gets better.",
    stops: [
      { iso: "in", placeId: "mumbai" },
      { iso: "in", placeId: "kolkata" },
      { iso: "in", placeId: "chennai" },
      { iso: "bd" },
      { iso: "mm" },
    ],
  },
  {
    id: "partition",
    name: "Partition cities",
    blurb: "1947 redrew the map. These cities still carry the seam.",
    stops: [
      { iso: "in", placeId: "kolkata" },
      { iso: "in", placeId: "delhi" },
      { iso: "bd" },
      { iso: "pk" },
    ],
  },
  {
    id: "heritage-north",
    name: "North India stone",
    blurb: "Forts, tombs, and a river that is a city.",
    stops: [
      { iso: "in", placeId: "delhi" },
      { iso: "in", placeId: "agra" },
      { iso: "in", placeId: "jaipur" },
      { iso: "in", placeId: "varanasi" },
    ],
  },
  {
    id: "lights",
    name: "Cities after dark",
    blurb: "Harbours and grids that look like constellations from orbit.",
    stops: [
      { iso: "jp", placeId: "tokyo" },
      { iso: "us", placeId: "new-york" },
      { iso: "ae", placeId: "dubai" },
      { iso: "gb", placeId: "london" },
      { iso: "in", placeId: "mumbai" },
    ],
  },
];

export const VISITS = {
  kolkata: [
    { when: "Morning", title: "Howrah & the Hooghly", note: "Watch the working river from the bridge or Prinsep Ghat.", query: "Howrah Bridge Kolkata", lat: 22.5851, lng: 88.3468 },
    { when: "Midday", title: "Victoria Memorial", note: "Marble, gardens, and the Maidan in hard light.", query: "Victoria Memorial Kolkata", lat: 22.5448, lng: 88.3426 },
    { when: "Afternoon", title: "College Street", note: "Second-hand books, Coffee House adda.", query: "College Street Kolkata books", lat: 22.5754, lng: 88.3639 },
    { when: "Evening", title: "A pandal, or Kalighat", note: "If it’s Puja, walk the pandals. If not, the older shrine.", query: "Durga Puja Kolkata pandal", lat: 22.52, lng: 88.342 },
    { when: "Night", title: "Kathi roll & Park Street", note: "Nizam’s invention, then lights on the old club street.", query: "Kathi roll Kolkata", lat: 22.548, lng: 88.351 },
  ],
  delhi: [
    { when: "Morning", title: "Nizamuddin", note: "The dargah before the city is fully awake.", query: "Nizamuddin Dargah", lat: 28.5913, lng: 77.2419 },
    { when: "Midday", title: "Humayun’s Tomb", note: "The garden that taught the Taj.", query: "Humayun Tomb Delhi", lat: 28.5933, lng: 77.2507 },
    { when: "Afternoon", title: "Chandni Chowk", note: "Parathas, alleys, Jama Masjid.", query: "Chandni Chowk", lat: 28.656, lng: 77.23 },
    { when: "Evening", title: "Lodhi Garden", note: "Tombs and peacocks as the heat drops.", query: "Lodhi Garden tomb", lat: 28.5931, lng: 77.2197 },
    { when: "Night", title: "India Gate lawns", note: "The people’s monument after dark.", query: "India Gate Delhi", lat: 28.6129, lng: 77.2295 },
  ],
  chennai: [
    { when: "Morning", title: "Filter coffee in Mylapore", note: "Then the tank of Kapaleeshwarar.", query: "Kapaleeshwarar Temple", lat: 13.0336, lng: 80.2687 },
    { when: "Midday", title: "Fort St George", note: "Where Madras began.", query: "Fort St George Chennai", lat: 13.0796, lng: 80.2874 },
    { when: "Afternoon", title: "San Thome", note: "The basilica on the spit.", query: "San Thome Basilica", lat: 13.0335, lng: 80.278 },
    { when: "Evening", title: "Marina Beach", note: "The city’s living room.", query: "Marina Beach Chennai evening", lat: 13.05, lng: 80.2824 },
    { when: "Night", title: "A sabha, if it’s Margazhi", note: "Otherwise a banana-leaf dinner.", query: "Chennai music season sabha", lat: 13.06, lng: 80.26 },
  ],
  mumbai: [
    { when: "Morning", title: "CST & the fountain", note: "Gothic Bombay at work.", query: "Chhatrapati Shivaji Terminus", lat: 18.9398, lng: 72.8355 },
    { when: "Midday", title: "Gateway of India", note: "The harbour’s arch.", query: "Gateway of India Mumbai", lat: 18.922, lng: 72.8347 },
    { when: "Afternoon", title: "Elephanta, or a Koli village", note: "Caves in the harbour, or the city’s first people.", query: "Elephanta Caves", lat: 18.9633, lng: 72.9314 },
    { when: "Evening", title: "Marine Drive", note: "The Queen’s Necklace lights up.", query: "Marine Drive Mumbai Art Deco", lat: 18.9432, lng: 72.8236 },
    { when: "Night", title: "Vada pav, then the local", note: "The city’s hamburger, then the 7:13 religion.", query: "Vada pav Mumbai", lat: 18.96, lng: 72.82 },
  ],
  tokyo: [
    { when: "Morning", title: "Meiji Jingū", note: "Forest shrine in the megacity.", query: "Meiji Jingu", lat: 35.6764, lng: 139.6993 },
    { when: "Midday", title: "Senso-ji", note: "Asakusa’s incense and gates.", query: "Senso-ji", lat: 35.7148, lng: 139.7967 },
    { when: "Evening", title: "Shinjuku or a quiet izakaya", note: "Neon, or one counter and seasonal fish.", query: "Tokyo night Shinjuku", lat: 35.6938, lng: 139.7034 },
  ],
  paris: [
    { when: "Morning", title: "Île de la Cité", note: "The island the city grew from.", query: "Notre Dame Paris", lat: 48.853, lng: 2.3499 },
    { when: "Afternoon", title: "Louvre or a smaller museum", note: "Then the Seine banks.", query: "Louvre Paris", lat: 48.8606, lng: 2.3376 },
    { when: "Evening", title: "A neighbourhood table", note: "Not a chain on the Champs.", query: "Paris cafe evening", lat: 48.86, lng: 2.33 },
  ],
  london: [
    { when: "Morning", title: "The river", note: "Bridge, market, or the Tate side.", query: "Tower Bridge London", lat: 51.5055, lng: -0.0754 },
    { when: "Afternoon", title: "A free museum", note: "British Museum or V&A — pick one.", query: "British Museum", lat: 51.5194, lng: -0.127 },
    { when: "Evening", title: "A pub, then a stage", note: "The city’s real civic religion.", query: "London pub", lat: 51.51, lng: -0.13 },
  ],
};

const SEASONS = {
  kolkata: [
    { months: [8, 9], title: "Durga Puja", note: "The city becomes a theatre. If you can be here only once, be here now." },
    { months: [9, 10], title: "Kali Puja / Diwali", note: "Midnight temples and lights." },
    { months: [0], title: "Book Fair winter", note: "The Maidan of pages." },
    { months: [5, 6, 7, 8], title: "Monsoon", note: "Telebhaja weather. The Hooghly runs high." },
  ],
  delhi: [
    { months: [9, 10], title: "Diwali", note: "The old city in lamps." },
    { months: [1, 2], title: "Spring mild", note: "The best walking weather." },
    { months: [4, 5, 6], title: "Hard heat", note: "Dawn and after dark only." },
  ],
  chennai: [
    { months: [11], title: "Margazhi season", note: "Carnatic concerts every evening." },
    { months: [0], title: "Pongal", note: "Harvest, kolam, sugarcane." },
    { months: [9, 10, 11], title: "Northeast monsoon", note: "The city’s real rain." },
  ],
  mumbai: [
    { months: [7, 8], title: "Ganesh Chaturthi", note: "Mandals and visarjan in the sea." },
    { months: [5, 6, 7, 8], title: "Monsoon", note: "The local trains vs the sky." },
  ],
  tokyo: [{ months: [2, 3], title: "Sakura", note: "Brief and crowded, still worth it." }],
  kyoto: [{ months: [2, 3], title: "Sakura", note: "Temples in pink." }, { months: [10], title: "Momiji", note: "Maple fire." }],
  paris: [{ months: [3, 4], title: "Spring", note: "The city everyone photographed." }],
};

export function resolveStop(stop) {
  if (stop.placeId) {
    const p = getPlace(stop.iso, stop.placeId);
    if (p) {
      const country = countries.find((c) => c.id === stop.iso);
      return {
        ...country,
        iso: p.iso,
        id: p.iso,
        placeId: p.id,
        displayName: p.name,
        lat: p.lat,
        lng: p.lng,
        kind: "place",
        capital: p.region,
      };
    }
  }
  const c = countries.find((x) => x.id === stop.iso);
  return c ? { ...c, iso: c.id, kind: "country" } : null;
}

export function seasonNow(placeId) {
  const month = new Date().getUTCMonth();
  const rows = SEASONS[placeId] || [];
  return rows.find((r) => r.months.includes(month)) || null;
}

export function localClock(lng) {
  const utc = new Date();
  const hours = utc.getUTCHours() + utc.getUTCMinutes() / 60 + lng / 15;
  const wrapped = ((hours % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.round((wrapped - h) * 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} local (approx.)`;
}

export function haversineKm(a, b) {
  const R = 6371;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function flightHours(km) {
  return (km / 820 + 0.6).toFixed(1);
}

function catalogHits(q) {
  const hits = [];
  for (const [placeId, cat] of Object.entries(CATALOGS)) {
    let iso = "in";
    for (const [code, pack] of Object.entries(PLACES)) {
      if (pack.items.some((p) => p.id === placeId)) iso = code;
    }
    const place = getPlace(iso, placeId);
    if (!place) continue;
    for (const [kind, list] of Object.entries(cat)) {
      for (const it of list) {
        const blob = `${it.name} ${it.note} ${it.query}`.toLowerCase();
        if (!blob.includes(q)) continue;
        hits.push({
          kind: "topic",
          topic: kind,
          label: it.name,
          place,
          iso,
        });
        if (hits.length >= 8) return hits;
      }
    }
  }
  return hits;
}

export function searchExplore(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { countries: [], places: [], topics: [] };
  return {
    countries: searchCountries(query),
    places: findPlaces(query),
    topics: catalogHits(q),
  };
}

const PIN_KEY = "globe-atlas-pins";

export function loadPins() {
  try {
    return JSON.parse(localStorage.getItem(PIN_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePins(pins) {
  localStorage.setItem(PIN_KEY, JSON.stringify(pins));
  const token = pins.map((p) => (p.placeId ? `${p.iso}:${p.placeId}` : p.iso)).join(",");
  const url = new URL(window.location.href);
  if (token) url.searchParams.set("pins", token);
  else url.searchParams.delete("pins");
  history.replaceState({}, "", url);
}

export function pinsFromURL() {
  const raw = new URLSearchParams(window.location.search).get("pins");
  if (!raw) return loadPins();
  const pins = [];
  for (const part of raw.split(",")) {
    const [iso, placeId] = part.split(":");
    if (!iso) continue;
    if (placeId) {
      const p = getPlace(iso, placeId);
      if (p) pins.push({ iso, placeId, name: p.name, lat: p.lat, lng: p.lng });
    } else {
      const c = countries.find((x) => x.id === iso);
      if (c) pins.push({ iso, placeId: "", name: c.name, lat: c.lat, lng: c.lng });
    }
  }
  savePins(pins);
  return pins;
}

export function pinKey(loc) {
  const iso = (loc.iso || loc.id || "").slice(0, 2);
  return loc.placeId ? `${iso}:${loc.placeId}` : iso;
}

export function locToPin(loc) {
  const iso = (loc.iso || loc.id || "").slice(0, 2);
  return {
    iso,
    placeId: loc.placeId || "",
    name: loc.displayName || loc.name,
    lat: loc.lat,
    lng: loc.lng,
  };
}
