import { cultureFor, CULTURE_LABELS } from "./data/culture.js";
import { ranksFor } from "./data/rankings.js";

const WIKI_TITLE = {
  cz: "Czech_Republic",
  us: "United_States",
  gb: "United_Kingdom",
  kr: "South_Korea",
  kp: "North_Korea",
  cd: "Democratic_Republic_of_the_Congo",
  cg: "Republic_of_the_Congo",
  va: "Vatican_City",
  sz: "Eswatini",
  tl: "East_Timor",
  mm: "Myanmar",
  ps: "State_of_Palestine",
  tw: "Taiwan",
  mk: "North_Macedonia",
  fm: "Federated_States_of_Micronesia",
  st: "São_Tomé_and_Príncipe",
  gq: "Equatorial_Guinea",
  ba: "Bosnia_and_Herzegovina",
  cf: "Central_African_Republic",
  pg: "Papua_New_Guinea",
  kn: "Saint_Kitts_and_Nevis",
  lc: "Saint_Lucia",
  vc: "Saint_Vincent_and_the_Grenadines",
  ag: "Antigua_and_Barbuda",
  tt: "Trinidad_and_Tobago",
  ae: "United_Arab_Emirates",
  do: "Dominican_Republic",
  sv: "El_Salvador",
  ci: "Ivory_Coast",
};

const cache = new Map();

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function officialFromExtract(extract) {
  const m = extract?.match(/officially(?: the)? ([^.]+?)(?: is|,)/i);
  return m?.[1]?.trim() || "";
}

async function fetchRest(iso) {
  const url = `https://restcountries.com/v3.1/alpha/${iso}`;
  const data = await fetchJson(url);
  const row = Array.isArray(data) ? data[0] : data;
  const languages = row.languages ? Object.values(row.languages) : [];
  const currencies = row.currencies
    ? Object.values(row.currencies).map((c) => (c.symbol ? `${c.name} (${c.symbol})` : c.name))
    : [];
  return {
    official: row.name?.official || "",
    flag: row.flags?.svg || row.flags?.png || `https://flagcdn.com/${iso}.svg`,
    population: row.population || 0,
    area: row.area || 0,
    languages,
    currencies,
    region: row.region || "",
    subregion: row.subregion || "",
    timezones: row.timezones || [],
    demonym: row.demonyms?.eng?.m || "",
    capital: row.capital?.[0] || "",
    maps: row.maps?.googleMaps || "",
  };
}

async function fetchWiki(iso, name) {
  const title = WIKI_TITLE[iso] || name.replaceAll(" ", "_");
  const data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  return {
    extract: data.extract || "",
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`,
  };
}

export function countryIsoFromLocation(loc) {
  return (loc.iso || loc.id || "").toLowerCase().slice(0, 2);
}

export async function loadDossier(loc) {
  const iso = countryIsoFromLocation(loc);
  const countryName = loc.country && loc.country !== loc.name ? loc.country : loc.name;
  const key = iso;
  if (cache.has(key)) {
    const cached = cache.get(key);
    return { ...cached, loc };
  }

  const culture = cultureFor(iso);
  const ranks = ranksFor(iso);

  const parts = await Promise.allSettled([fetchRest(iso), fetchWiki(iso, countryName)]);
  let rest = parts[0].status === "fulfilled" ? parts[0].value : null;
  const wiki = parts[1].status === "fulfilled" ? parts[1].value : null;

  if (!rest) {
    rest = {
      official: officialFromExtract(wiki?.extract),
      flag: `https://flagcdn.com/${iso}.svg`,
      population: 0,
      area: 0,
      languages: [],
      currencies: [],
      region: loc.region || "",
      subregion: "",
      timezones: [],
      demonym: "",
      capital: loc.capital || "",
      maps: "",
    };
  } else if (!rest.official) {
    rest.official = officialFromExtract(wiki?.extract);
  }

  const dossier = {
    iso,
    countryName,
    culture,
    cultureLabels: CULTURE_LABELS,
    ranks,
    rest,
    wiki,
  };
  cache.set(key, dossier);
  return { ...dossier, loc };
}

export function formatPopulation(n) {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} thousand`;
  return String(n);
}

export function formatArea(n) {
  if (!n) return "—";
  return `${Math.round(n).toLocaleString()} km²`;
}
