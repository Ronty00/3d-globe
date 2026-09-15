/** Ordered ISO lists. Rank = index + 1. Ties keep the published rank number. */

export const RANK_META = [
  { key: "happiness", label: "Happiness", source: "World Happiness Report 2024", better: "high", outOf: 143 },
  { key: "passport", label: "Passport power", source: "Henley Passport Index 2026", better: "high", outOf: 199 },
  { key: "military", label: "Military power", source: "Global Firepower 2025", better: "high", outOf: 145 },
  { key: "gdp", label: "Economy (GDP)", source: "IMF WEO 2024, nominal", better: "high", outOf: 196 },
  { key: "hdi", label: "Human development", source: "UNDP HDI 2023/24", better: "high", outOf: 193 },
  { key: "peace", label: "Peace", source: "Global Peace Index 2024/26", better: "high", outOf: 163 },
  { key: "population", label: "Population", source: "UN / national estimates", better: "high", outOf: 195 },
  { key: "area", label: "Land area", source: "UN FAO / World Bank", better: "high", outOf: 195 },
];

const LISTS = {
  happiness: [
    "fi", "dk", "is", "se", "il", "nl", "no", "lu", "ch", "au", "nz", "cr", "kw", "at", "ca",
    "be", "ie", "cz", "lt", "gb", "si", "ae", "us", "de", "mx", "uy", "fr", "sa", "sg", "tw",
    "ro", "sv", "ee", "pl", "es", "rs", "cl", "pa", "mt", "it", "gt", "ni", "br", "sk", "lv",
    "uz", "ar", "kz", "cy", "jp", "kr", "ph", "vn", "pt", "hu", "py", "th", "my", "cn", "hn",
    "bh", "hr", "gr", "ba", "ly", "jm", "pe", "do", "mu", "md", "ru", "bo", "ec", "kg", "me",
    "mn", "co", "ve", "id", "bg", "am", "za", "mk", "dz", "al", "tj", "cg", "mz", "ge", "iq",
    "np", "la", "ga", "gn", "tr", "sn", "ir", "az", "ng", "ps", "cm", "ua", "na", "ma", "pk",
    "ne", "bf", "mr", "gm", "td", "ke", "tn", "bj", "ug", "mm", "kh", "gh", "lr", "ml", "mg",
    "tg", "jo", "in", "eg", "lk", "bd", "et", "tz", "km", "ye", "zm", "sz", "mw", "bw", "zw",
    "cd", "sl", "ls", "lb", "af",
  ],
  passport: [
    "sg", "jp", "kr", "ae", "se", "be", "dk", "fi", "fr", "de", "ie", "it", "lu", "nl", "no",
    "es", "ch", "at", "gr", "mt", "pt", "hu", "my", "pl", "gb", "au", "ca", "cz", "lv", "nz",
    "sk", "si", "hr", "ee", "li", "lt", "is", "us", "bg", "ro", "mc", "cl", "cy", "ad", "ar",
    "br", "il", "sm", "bb", "bn", "bs", "mx", "uy", "vc", "sc", "kn", "ag", "va", "cr", "mu",
    "pa", "gd", "tt", "lc", "ua", "rs", "me", "mk", "al", "ba", "pe", "py", "sv", "gt", "hn",
    "ni", "co", "ve", "ec", "bo", "za", "bw", "na", "tr", "th", "id", "tw", "ru", "cn", "in",
    "md", "ge", "am", "az", "kz", "qa", "kw", "bh", "om", "sa", "by", "tn", "ma", "ph", "vn",
    "kh", "la", "mm", "np", "lk", "bd", "pk", "ir", "iq", "sy", "ye", "af", "ng", "gh", "ke",
    "tz", "ug", "et", "cm", "sn", "ao", "mz", "zw", "cd", "so", "ly", "sd", "ss", "er", "kp",
  ],
  military: [
    "us", "ru", "cn", "in", "kr", "gb", "fr", "jp", "tr", "it", "br", "pk", "id", "de", "il",
    "ir", "es", "au", "eg", "ua", "pl", "tw", "vn", "sa", "th", "dz", "se", "ca", "sg", "gr",
    "ng", "mx", "ar", "kp", "bd", "nl", "mm", "no", "pt", "za", "ph", "my", "iq", "ch", "dk",
    "co", "cl", "fi", "pe", "ve", "ro", "et", "cz", "ae", "hu", "be", "at", "kz", "uz", "az",
    "by", "ma", "tn", "ly", "sd", "ke", "ao", "tz", "ug", "gh", "cm", "cd", "cu", "rs", "sk",
    "bg", "hr", "lt", "lv", "ee", "ge", "am", "jo", "lb", "om", "qa", "kw", "bh", "ye", "sy",
    "af", "np", "lk", "kh", "la", "mn", "nz", "ie", "lu",
  ],
  gdp: [
    "us", "cn", "de", "jp", "in", "gb", "fr", "it", "ca", "br", "ru", "kr", "mx", "au", "es",
    "id", "tr", "sa", "nl", "ch", "pl", "tw", "be", "ar", "ie", "se", "ae", "sg", "il", "th",
    "at", "no", "ph", "vn", "bd", "dk", "my", "co", "ir", "za", "eg", "ro", "pk", "cz", "cl",
    "pt", "fi", "pe", "kz", "iq", "dz", "nz", "gr", "ng", "hu", "qa", "ua", "ma", "kw", "et",
    "sk", "ec", "do", "ve", "ke", "ao", "uz", "gt", "bg", "om", "lk", "cr", "lu", "hr", "rs",
    "lt", "gh", "uy", "tz", "by", "cd", "az", "si", "tm", "pa", "jo", "mm", "tn", "bo", "cm",
    "bh", "ug", "py", "lv", "ee", "np", "kh", "hn", "sn", "cy", "sv", "is", "ge", "ba", "mg",
    "am", "mn", "al", "mt", "mz", "bf", "ml", "ga", "bw", "bj", "ne", "la", "mw", "ni", "td",
    "zw", "rw", "ht", "so", "td", "ly", "ye", "af",
  ],
  hdi: [
    "ch", "no", "is", "se", "dk", "de", "ie", "sg", "au", "nl", "be", "fi", "gb", "nz", "ca",
    "us", "ae", "at", "si", "jp", "kr", "il", "lu", "es", "fr", "cz", "mt", "it", "ee", "gr",
    "pl", "lt", "sa", "cy", "bh", "hu", "pt", "sk", "hr", "lv", "ad", "qa", "cl", "ar", "kw",
    "me", "ro", "ru", "tr", "om", "bs", "kz", "uy", "by", "pa", "bg", "ge", "my", "mu", "rs",
    "th", "al", "cn", "am", "ba", "ir", "lk", "mx", "br", "az", "tn", "ec", "mn", "eg", "vn",
    "ph", "za", "id", "jo", "uz", "lb", "ua", "dz", "tm", "bo", "kg", "iq", "ma",
    "gt", "ni", "hn", "sv", "py", "pe", "co", "do", "na", "bw", "ga", "np", "kh", "la", "mm",
    "ke", "gh", "ao", "cm", "tz", "ng", "in", "bd", "pk", "ug", "rw", "mg", "et", "sd", "af", "td", "ne",
    "ml", "bf", "sl", "lr", "cd", "ss", "ye", "so",
  ],
  peace: [
    "is", "nz", "ch", "si", "ie", "at", "pt", "sg", "fi", "jp", "dk", "my", "cz", "ca", "hu",
    "bt", "nl", "mu", "lv", "au", "be", "pl", "hr", "lt", "ee", "bg", "es", "de", "sk", "me",
    "qa", "tl", "no", "mn", "it", "al", "uz", "gb", "se", "vn", "tw", "uy", "kz", "ro", "mk",
    "tj", "ba", "kw", "om", "ae", "cr", "cl", "gh", "zm", "tz", "sn", "bw", "na", "rw", "id",
    "jo", "ma", "tn", "kh", "la", "np", "ar", "py", "pa", "do", "jm", "tt", "bh", "sa", "cn",
    "fr", "gr", "cy", "rs", "ge", "am", "az", "md", "kg", "bo", "pe", "ec", "br", "mx", "in",
    "bd", "lk", "th", "ph", "my", "eg", "dz", "ma", "ng", "ke", "et", "ug", "cd", "ss", "so",
    "ly", "ye", "sy", "iq", "af", "ua", "ru", "il", "ps", "us", "pk", "mm", "ht", "ml", "bf",
  ],
  population: [
    "in", "cn", "us", "id", "pk", "ng", "br", "bd", "ru", "mx", "jp", "et", "ph", "eg", "vn",
    "cd", "tr", "ir", "de", "th", "gb", "tz", "fr", "za", "it", "ke", "mm", "co", "kr", "ug",
    "sd", "es", "ar", "dz", "iq", "af", "pl", "ca", "ma", "sa", "uz", "pe", "ao", "my", "mz",
    "gh", "ye", "np", "ve", "mg", "cm", "ci", "au", "ne", "lk", "bf", "ml", "mw", "ro", "cl",
    "kz", "zm", "gt", "sn", "td", "so", "nl", "kh", "zw", "gn", "rw", "bj", "bi", "tn", "bo",
    "be", "ht", "cu", "ss", "do", "cz", "gr", "jo", "pt", "az", "se", "hn", "ae", "hu", "tj",
    "by", "at", "pg", "il", "ch", "tg", "sl", "la", "py", "ni", "kg", "ly", "bg", "rs", "ly",
    "tm", "sv", "cg", "dk", "sg", "fi", "sk", "no", "om", "cr", "lr", "ie", "cf", "nz", "mr",
    "pa", "hr", "ge", "er", "uy", "mn", "ba", "qa", "md", "na", "am", "jm", "al", "lt", "qa",
    "jm", "am", "mn", "bw", "ga", "ls", "gw", "si", "lv", "mk", "gq", "bh", "ee", "tt", "cy",
    "mu", "sz", "dj", "fj", "km", "gy", "bt", "sb", "me", "lu", "sr", "cv", "mv", "mt", "bn",
    "bz", "bs", "is", "vu", "bb", "st", "ws", "lc", "ki", "fm", "gd", "to", "vc", "ag", "sc",
    "ad", "dm", "kn", "li", "mc", "sm", "pw", "nr", "tv", "va",
  ],
  area: [
    "ru", "ca", "us", "cn", "br", "au", "in", "ar", "kz", "dz", "cd", "sa", "mx", "id", "sd",
    "ly", "ir", "mn", "pe", "td", "ne", "ao", "ml", "za", "co", "et", "bo", "mr", "eg", "tz",
    "ng", "ve", "pk", "na", "mz", "tr", "cl", "zm", "mm", "af", "so", "cf", "ss", "ua", "mg",
    "bw", "ke", "fr", "ye", "th", "es", "tm", "cm", "pg", "se", "uz", "ma", "iq", "py", "zw",
    "no", "jp", "de", "cg", "fi", "vn", "my", "no", "pl", "om", "it", "ph", "ec", "bf", "nz",
    "ga", "gn", "gb", "ug", "gh", "ro", "la", "gy", "by", "kg", "sn", "sy", "kh", "uy", "tn",
    "sr", "np", "bd", "tj", "gr", "ni", "kp", "mw", "er", "bj", "hn", "lr", "bg", "cu", "gt",
    "is", "kr", "hu", "pt", "jo", "az", "at", "ae", "cz", "rs", "pa", "sl", "ie", "ge", "lk",
    "lt", "lv", "tg", "hr", "ba", "sk", "ee", "dk", "nl", "ch", "bt", "tw", "gn", "be", "ls",
    "am", "al", "gq", "bi", "ht", "rw", "mk", "dj", "bz", "il", "sv", "si", "fj", "kw", "sz",
    "tl", "bs", "me", "vu", "qa", "gm", "jm", "lb", "cy", "ps", "bn", "tt", "cv", "ws", "lu",
    "mu", "km", "st", "ki", "bh", "dm", "to", "sg", "fm", "mh", "lc", "tv", "nr", "pw", "ad",
    "bb", "kn", "sc", "ag", "mt", "mv", "gd", "vc", "li", "sm", "mc", "va",
  ],
};

function unique(list) {
  const seen = new Set();
  return list.filter((iso) => {
    if (seen.has(iso)) return false;
    seen.add(iso);
    return true;
  });
}

for (const key of Object.keys(LISTS)) {
  LISTS[key] = unique(LISTS[key]);
}

export function ranksFor(iso) {
  return RANK_META.map((meta) => {
    const list = LISTS[meta.key];
    const i = list.indexOf(iso);
    return {
      ...meta,
      rank: i === -1 ? null : i + 1,
      outOf: meta.outOf || list.length,
    };
  });
}

export function rankTone(rank, outOf) {
  if (!rank) return "muted";
  const p = rank / outOf;
  if (p <= 0.1) return "gold";
  if (p <= 0.33) return "good";
  if (p <= 0.66) return "mid";
  return "low";
}
