/**
 * Carnet — météo (P4b) : Open-Meteo, sans clé ni compte.
 *
 * Activée à la demande : position de l'appareil ou ville choisie, gardée sur l'appareil seulement
 * (elle ne part pas dans le carnet ni dans les sauvegardes). Les jours passés et aujourd'hui sont
 * notés dans le carnet (un souvenir : « pluie, 12° ») ; les prévisions restent en mémoire, affichées
 * plus pâles.
 */

export type Place = { name: string; lat: number; lon: number };
export type Daily = { day: string; code: number; max: number; min: number };

const KEY = "carnet.meteo";
const FRESH_MS = 3 * 3600 * 1000;

export function savedPlace(): (Place & { at?: number }) | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as (Place & { at?: number }) | null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) ? v : null;
  } catch {
    return null;
  }
}
export function savePlace(p: (Place & { at?: number }) | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}
export const isStale = (p: { at?: number } | null) => !p?.at || Date.now() - p.at > FRESH_MS;

/** Villes correspondant à un nom (géocodage Open-Meteo, en français). */
export async function searchPlaces(q: string): Promise<Place[]> {
  const u = `https://geocoding-api.open-meteo.com/v1/search?count=5&language=fr&format=json&name=${encodeURIComponent(q.trim())}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`géocodage : ${r.status}`);
  const j = (await r.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
  return (j.results ?? []).map((x) => ({ name: [x.name, x.admin1, x.country].filter(Boolean).join(", "), lat: x.latitude, lon: x.longitude }));
}

/** Position de l'appareil (demande la permission). */
export function locate(): Promise<Place> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("position indisponible sur cet appareil"));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ name: "Ma position", lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 }),
      (e) => rej(new Error(e.code === e.PERMISSION_DENIED ? "position refusée" : "position introuvable")),
      { maximumAge: 6 * 3600 * 1000, timeout: 15000 },
    );
  });
}

/** Deux semaines passées et une à venir, jour par jour, dans le fuseau du lieu. */
export async function fetchDaily(p: Place): Promise<Daily[]> {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=14&forecast_days=7`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`météo : ${r.status}`);
  const j = (await r.json()) as { daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } };
  const d = j.daily;
  if (!d) return [];
  return d.time
    .map((day, i) => ({ day, code: d.weather_code[i]!, max: d.temperature_2m_max[i]!, min: d.temperature_2m_min[i]! }))
    .filter((x) => Number.isFinite(x.code) && Number.isFinite(x.max) && Number.isFinite(x.min));
}

/** Codes météo OMM → mot et pictogramme (six familles suffisent dans un carnet). */
export type Sky = "soleil" | "voile" | "nuages" | "brume" | "pluie" | "neige" | "orage";
export function describe(code: number): { label: string; sky: Sky } {
  if (code === 0) return { label: "Ciel clair", sky: "soleil" };
  if (code <= 2) return { label: code === 1 ? "Peu nuageux" : "Éclaircies", sky: "voile" };
  if (code === 3) return { label: "Couvert", sky: "nuages" };
  if (code === 45 || code === 48) return { label: "Brouillard", sky: "brume" };
  if (code >= 51 && code <= 57) return { label: "Bruine", sky: "pluie" };
  if (code >= 61 && code <= 67) return { label: code >= 65 ? "Forte pluie" : "Pluie", sky: "pluie" };
  if (code >= 71 && code <= 77) return { label: "Neige", sky: "neige" };
  if (code >= 80 && code <= 82) return { label: "Averses", sky: "pluie" };
  if (code === 85 || code === 86) return { label: "Averses de neige", sky: "neige" };
  if (code >= 95) return { label: "Orage", sky: "orage" };
  return { label: "Temps variable", sky: "nuages" };
}

const P = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const CLOUD = `<path d="M6 17 Q2 17 2.6 13.4 Q3.3 10.4 6.6 11 Q7.6 7 11.6 7.3 Q15.6 7.6 16 11.3 Q20 11.1 20 14.2 Q20 17 17 17 Z" ${P}/>`;
/** Pictogramme au trait, de la couleur du texte. */
export function skyIcon(sky: Sky) {
  const body = {
    soleil: `<circle cx="11" cy="12" r="4" ${P}/><path d="M11 3v2M11 19v2M2 12h2M18 12h2M4.6 5.6l1.4 1.4M16 17l1.4 1.4M17.4 5.6 16 7M6 17l-1.4 1.4" ${P}/>`,
    voile: `<circle cx="8" cy="8" r="3.2" ${P}/><path d="M8 2.6v1M2.6 8h1M4.2 4.2l.7.7M11.8 4.2l-.7.7" ${P}/>${CLOUD}`,
    nuages: CLOUD,
    brume: `<path d="M3 9h16M5 13h14M3 17h12" ${P}/>`,
    pluie: `${CLOUD}<path d="M7 19.5l-.8 2M11 19.5l-.8 2M15 19.5l-.8 2" ${P}/>`,
    neige: `${CLOUD}<path d="M7 20.5h.01M11 21h.01M15 20.5h.01" ${P} stroke-width="2.6"/>`,
    orage: `${CLOUD}<path d="M11.5 17.5l-2 3h3l-2 3" ${P}/>`,
  }[sky];
  return `<svg viewBox="0 0 22 24" width="15" height="16" aria-hidden="true" focusable="false">${body}</svg>`;
}
