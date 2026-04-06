export interface ChileRegionMapArea {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  markerX: number;
  markerY: number;
  tone: string;
}

export const chileRegions: ChileRegionMapArea[] = [
  { id: "arica-y-parinacota", name: "Arica y Parinacota", shortName: "Arica", x: 222, y: 16, width: 84, height: 32, markerX: 264, markerY: 32, tone: "rgba(255,162,209,0.35)" },
  { id: "tarapaca", name: "Tarapacá", shortName: "Tarapacá", x: 206, y: 50, width: 92, height: 36, markerX: 252, markerY: 68, tone: "rgba(232,207,99,0.34)" },
  { id: "antofagasta", name: "Antofagasta", shortName: "Antofa", x: 190, y: 90, width: 104, height: 58, markerX: 244, markerY: 118, tone: "rgba(56,182,255,0.3)" },
  { id: "atacama", name: "Atacama", shortName: "Atacama", x: 176, y: 150, width: 108, height: 48, markerX: 232, markerY: 174, tone: "rgba(255,162,209,0.28)" },
  { id: "coquimbo", name: "Coquimbo", shortName: "Coquimbo", x: 160, y: 200, width: 110, height: 54, markerX: 216, markerY: 227, tone: "rgba(56,182,255,0.36)" },
  { id: "valparaiso", name: "Valparaíso", shortName: "Valpo", x: 154, y: 258, width: 94, height: 42, markerX: 200, markerY: 279, tone: "rgba(232,207,99,0.32)" },
  { id: "metropolitana", name: "Región Metropolitana", shortName: "RM", x: 148, y: 304, width: 92, height: 38, markerX: 194, markerY: 323, tone: "rgba(255,162,209,0.32)" },
  { id: "ohiggins", name: "O'Higgins", shortName: "O'Higgins", x: 144, y: 346, width: 88, height: 40, markerX: 188, markerY: 366, tone: "rgba(56,182,255,0.27)" },
  { id: "maule", name: "Maule", shortName: "Maule", x: 142, y: 390, width: 92, height: 48, markerX: 188, markerY: 414, tone: "rgba(232,207,99,0.28)" },
  { id: "nuble", name: "Ñuble", shortName: "Ñuble", x: 134, y: 440, width: 88, height: 34, markerX: 178, markerY: 457, tone: "rgba(255,162,209,0.3)" },
  { id: "biobio", name: "Biobío", shortName: "Biobío", x: 128, y: 478, width: 92, height: 48, markerX: 174, markerY: 502, tone: "rgba(56,182,255,0.3)" },
  { id: "araucania", name: "La Araucanía", shortName: "Araucanía", x: 122, y: 530, width: 96, height: 46, markerX: 170, markerY: 553, tone: "rgba(232,207,99,0.3)" },
  { id: "los-rios", name: "Los Ríos", shortName: "Los Ríos", x: 112, y: 580, width: 92, height: 36, markerX: 158, markerY: 598, tone: "rgba(255,162,209,0.28)" },
  { id: "los-lagos", name: "Los Lagos", shortName: "Los Lagos", x: 106, y: 620, width: 106, height: 58, markerX: 160, markerY: 649, tone: "rgba(56,182,255,0.33)" },
  { id: "aysen", name: "Aysén", shortName: "Aysén", x: 90, y: 684, width: 118, height: 82, markerX: 148, markerY: 725, tone: "rgba(232,207,99,0.32)" },
  { id: "magallanes", name: "Magallanes y la Antártica Chilena", shortName: "Magallanes", x: 86, y: 774, width: 136, height: 110, markerX: 154, markerY: 828, tone: "rgba(255,162,209,0.3)" }
];

export const regionOptions = chileRegions.map((region) => region.name);

export function normalizeRegionKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const chileRegionByKey = Object.fromEntries(
  chileRegions.map((region) => [normalizeRegionKey(region.name), region])
);
