export interface SceneTheme {
  id: string;
  label: string;
  /** Sky colour at the zenith and at the horizon; the horizon colour also drives fog and the page backdrop. */
  top: string;
  horizon: string;
  floor: string;
  ambient: number;
  hemi: { sky: string; ground: string; intensity: number };
  key: { color: string; intensity: number; position: [number, number, number] };
  rim: { color: string; intensity: number; position: [number, number, number] };
  stars?: number;
  /** A glowing disc in the sky: the moon or the sun. */
  body?: { color: string; glow: string; position: [number, number, number]; size: number; glowSize: number; craters?: boolean };
}

export const sceneThemes: SceneTheme[] = [
  {
    id: "day", label: "Day", top: "#cfe0ea", horizon: "#e9edea", floor: "#e0e5df", ambient: 0.7,
    hemi: { sky: "#ffffff", ground: "#b3bba6", intensity: 1.6 },
    key: { color: "#ffffff", intensity: 2.8, position: [4, 6, 5] }, rim: { color: "#dbe6ff", intensity: 1.8, position: [-4, 3, -3] },
  },
  {
    id: "evening", label: "Evening", top: "#3b3a6b", horizon: "#f2a65a", floor: "#6b4a3c", ambient: 0.45,
    hemi: { sky: "#ffb77a", ground: "#4a3040", intensity: 1.0 },
    key: { color: "#ff9a52", intensity: 2.6, position: [6, 2.2, 4] }, rim: { color: "#7d7bd6", intensity: 1.6, position: [-5, 3, -3] },
    body: { color: "#ffd08a", glow: "#ff8a3c", position: [14, 5, -38], size: 3.2, glowSize: 26 },
  },
  {
    id: "dawn", label: "Dawn", top: "#7c8fc4", horizon: "#f6c6c0", floor: "#d7b9b6", ambient: 0.6,
    hemi: { sky: "#ffd9d2", ground: "#9a8a9c", intensity: 1.3 },
    key: { color: "#ffc9a8", intensity: 2.3, position: [-6, 2.6, 4] }, rim: { color: "#a9b8ff", intensity: 1.4, position: [5, 3, -3] },
    body: { color: "#fff0d0", glow: "#ffb08a", position: [-15, 4, -38], size: 2.8, glowSize: 22 },
  },
  {
    id: "night", label: "Night", top: "#04060f", horizon: "#141b33", floor: "#0e1220", ambient: 0.18,
    hemi: { sky: "#4a5b9a", ground: "#0a0d18", intensity: 0.55 },
    key: { color: "#8fa4ff", intensity: 1.1, position: [3, 5, 5] }, rim: { color: "#5b6fc2", intensity: 1.2, position: [-4, 3, -3] },
    stars: 3500,
  },
  {
    id: "moon", label: "Moon", top: "#02030a", horizon: "#0d1530", floor: "#0a0f20", ambient: 0.2,
    hemi: { sky: "#6f86c9", ground: "#080b16", intensity: 0.6 },
    key: { color: "#b9c8ff", intensity: 1.5, position: [-5, 6, 4] }, rim: { color: "#6d82d6", intensity: 1.4, position: [4, 3, -3] },
    stars: 2500,
    body: { color: "#f6f2e2", glow: "#9fb4ff", position: [-11, 8, -36], size: 2.2, glowSize: 22, craters: true },
  },
  {
    id: "full-moon", label: "Full moon", top: "#01020a", horizon: "#16224a", floor: "#0b1226", ambient: 0.25,
    hemi: { sky: "#8aa0e0", ground: "#090c18", intensity: 0.75 },
    key: { color: "#c8d4ff", intensity: 1.9, position: [-3, 7, 5] }, rim: { color: "#7f94e8", intensity: 1.6, position: [4, 4, -3] },
    stars: 1800,
    body: { color: "#f7f1d6", glow: "#aebfff", position: [-10, 7.5, -34], size: 4.2, glowSize: 36, craters: true },
  },
  {
    id: "studio", label: "Studio dark", top: "#1b1c21", horizon: "#2a2c33", floor: "#1d1e23", ambient: 0.35,
    hemi: { sky: "#aab0c0", ground: "#1a1a1f", intensity: 0.8 },
    key: { color: "#ffffff", intensity: 2.4, position: [4, 6, 5] }, rim: { color: "#9db4ff", intensity: 2.0, position: [-4, 3, -3] },
  },
  {
    id: "neon", label: "Neon", top: "#12041f", horizon: "#4a1466", floor: "#1a0a2a", ambient: 0.3,
    hemi: { sky: "#ff4fd8", ground: "#0b1a3a", intensity: 0.8 },
    key: { color: "#ff6ad5", intensity: 2.0, position: [5, 4, 5] }, rim: { color: "#33e0ff", intensity: 2.4, position: [-5, 3, -3] },
    stars: 800,
  },
  {
    id: "forest", label: "Forest", top: "#16301f", horizon: "#4f7a58", floor: "#2c4a34", ambient: 0.5,
    hemi: { sky: "#c9e8c0", ground: "#233a28", intensity: 1.1 },
    key: { color: "#fff2c4", intensity: 2.4, position: [4, 6, 4] }, rim: { color: "#9fd8c0", intensity: 1.4, position: [-4, 3, -3] },
  },
];

export const defaultThemeId = "day";
export const themeStorageKey = "avatar-scene-theme";
export function findTheme(id: string | null | undefined): SceneTheme {
  return sceneThemes.find((theme) => theme.id === id) ?? sceneThemes[0];
}

export const customThemeId = "custom";
export const customStorageKey = "avatar-scene-custom";
export const defaultBody: NonNullable<SceneTheme["body"]> = { color: "#f6f2e2", glow: "#9fb4ff", position: [-10, 7.5, -34], size: 3.6, glowSize: 30, craters: true };

/** Editable copy of a theme; changing any value turns the scene into "Custom" lighting. */
export function cloneTheme(theme: SceneTheme): SceneTheme {
  return JSON.parse(JSON.stringify(theme)) as SceneTheme;
}

/** Light direction as azimuth (0 = from the camera side, positive toward +X) and elevation above the floor, both in degrees. */
export function toAngles([x, y, z]: [number, number, number]): { azimuth: number; elevation: number; distance: number } {
  const distance = Math.hypot(x, y, z) || 1;
  return {
    azimuth: Math.round(Math.atan2(x, z) * 180 / Math.PI),
    elevation: Math.round(Math.asin(Math.max(-1, Math.min(1, y / distance))) * 180 / Math.PI),
    distance,
  };
}
export function fromAngles(azimuth: number, elevation: number, distance: number): [number, number, number] {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
  return [distance * Math.cos(el) * Math.sin(az), distance * Math.sin(el), distance * Math.cos(el) * Math.cos(az)];
}

const isColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const isVector = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));
const isLight = (value: unknown): boolean => !!value && typeof value === "object" && isColor((value as { color: unknown }).color) && Number.isFinite((value as { intensity: unknown }).intensity) && isVector((value as { position: unknown }).position);

/** Saved custom setups come from storage, so only accept a complete, well-formed theme. */
export function validateCustomTheme(input: unknown): SceneTheme | null {
  if (!input || typeof input !== "object") return null;
  const value = input as SceneTheme;
  const hemi = value.hemi;
  const valid = isColor(value.top) && isColor(value.horizon) && isColor(value.floor) && Number.isFinite(value.ambient)
    && !!hemi && isColor(hemi.sky) && isColor(hemi.ground) && Number.isFinite(hemi.intensity) && isLight(value.key) && isLight(value.rim)
    && (value.stars === undefined || Number.isFinite(value.stars))
    && (value.body === undefined || (!!value.body && isColor(value.body.color) && isColor(value.body.glow) && isVector(value.body.position) && Number.isFinite(value.body.size) && Number.isFinite(value.body.glowSize)));
  return valid ? { ...value, id: customThemeId, label: "Custom" } : null;
}

export function parseCustomTheme(raw: string | null): SceneTheme | null {
  if (!raw) return null;
  try { return validateCustomTheme(JSON.parse(raw)); } catch { return null; }
}
