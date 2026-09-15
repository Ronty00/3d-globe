/** Fetch freely licensed Wikimedia Commons photos, store as data-URLs, keep author credit. */

const cache = new Map();

const FREE = /cc0|cc-by|cc by|public domain|pd-|gfdl|attribution/i;

function meta(info, key) {
  const raw = info?.extmetadata?.[key]?.value;
  if (!raw) return "";
  return String(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function commonsPhoto(query) {
  const key = query.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime|size",
    iiurlwidth: "1280",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) throw new Error("commons");
  const data = await res.json();
  const pages = Object.values(data.query?.pages || {});

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = info.mime || "";
    if (!mime.startsWith("image/") || mime.includes("svg")) continue;
    const license = meta(info, "LicenseShortName") || meta(info, "UsageTerms");
    if (license && !FREE.test(license) && !/public domain/i.test(license)) continue;

    const src = info.thumburl || info.url;
    if (!src) continue;

    const imgRes = await fetch(src);
    if (!imgRes.ok) continue;
    const blob = await imgRes.blob();
    if (blob.size > 3_200_000) continue;
    const dataUrl = await blobToDataUrl(blob);

    const artist = meta(info, "Artist") || "Wikimedia author";
    const credit = meta(info, "Credit");
    const photo = {
      dataUrl,
      title: (page.title || "").replace(/^File:/, ""),
      artist,
      license: license || "Free license",
      credit: credit || artist,
      sourceUrl: info.descriptionshorturl || info.descriptionurl || src,
      query,
    };
    cache.set(key, photo);
    return photo;
  }

  cache.set(key, null);
  return null;
}

export async function wikiSummary(title) {
  const data = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`
  ).then((r) => {
    if (!r.ok) throw new Error("wiki");
    return r.json();
  });

  let hero = null;
  const src = data.originalimage?.source || data.thumbnail?.source;
  if (src) {
    try {
      const imgRes = await fetch(src);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        if (blob.size <= 3_200_000) {
          hero = {
            dataUrl: await blobToDataUrl(blob),
            title: data.title,
            artist: "Wikipedia / Wikimedia contributors",
            license: "CC BY-SA (Wikipedia media)",
            credit: "Wikipedia / Wikimedia Commons",
            sourceUrl: data.content_urls?.desktop?.page || src,
            query: title,
          };
        }
      }
    } catch {
      hero = null;
    }
  }

  return {
    extract: data.extract || "",
    url: data.content_urls?.desktop?.page || "",
    hero,
  };
}

export function creditLine(photo) {
  if (!photo) return "";
  return `${photo.credit} · ${photo.license} · Wikimedia`;
}
