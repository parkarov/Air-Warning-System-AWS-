export type Forecast = "up" | "steady" | "down";

export const forecastLabel: Record<Forecast, string> = {
  up: "Improving",
  steady: "Stable",
  down: "Worsening",
};

/** One sensor reading. `value` is a string for non-numeric sensors (e.g. a status). */
export type Sensor = {
  name: string;
  value: number | string;
  unit?: string;
  forecast: Forecast;
};

/** One monitored zone (sensor area) inside a location. */
export type Zone = {
  zone: string;
  /** Where the zone is, e.g. "1st floor". */
  description?: string;
  score: number;
  forecast: Forecast;
  sensors: Sensor[];
};

/** A location (building): building-wide sensors plus one or more zones. */
export type Location = {
  /** URL-safe id, used for map pins (?site=<id>). */
  id: string;
  name: string;
  description?: string;
  /** Pin position on public/campus-map.png, in % of the image width/height. */
  map?: { x: number; y: number };
  sensors: Sensor[];
  zones: Zone[];
};

/** "5.8 µg/m³", "29 °C", "68% RH", "12,500 lx" */
export function formatReading({ value, unit }: Sensor): string {
  if (typeof value === "string") return value;
  const v = value.toLocaleString("en-US");
  if (!unit) return v;
  return unit.startsWith("%") ? `${v}${unit}` : `${v} ${unit}`;
}

// ---- Mock data — replace with the real sensor feed. ----

const locationSensors = (pm25: number, gas: string, f: [Forecast, Forecast]): Sensor[] => [
  { name: "PM2.5", value: pm25, unit: "µg/m³", forecast: f[0] },
  { name: "Hazardous Gas", value: gas, forecast: f[1] },
];

const zoneSensors = (
  temperature: number,
  humidity: number,
  noise: number,
  light: number,
  f: [Forecast, Forecast, Forecast, Forecast],
): Sensor[] => [
  { name: "Temperature", value: temperature, unit: "°C", forecast: f[0] },
  { name: "Humidity", value: humidity, unit: "% RH", forecast: f[1] },
  { name: "Noise", value: noise, unit: "dB", forecast: f[2] },
  { name: "Light", value: light, unit: "lx", forecast: f[3] },
];

const locations: Location[] = [
  {
    id: "central-library",
    name: "Central Library",
    description:
      "The Office of Academic Resources (Central Library) at Chulalongkorn University is dedicated to providing high-quality services and facilities for accessing various information resources. These resources include international academic journals, rare publications, digital media, textbooks, and magazines. Additionally, the office features studios and spaces for producing various types of media, supporting teaching, research, and knowledge-seeking for students, faculty, staff, and the general public.",
    map: { x: 41.8, y: 52.5 },
    sensors: locationSensors(5.8, "Normal", ["up", "steady"]),
    zones: [
      { zone: "Zone A", description: "1st floor", score: 76, forecast: "up", sensors: zoneSensors(29, 68, 48, 12500, ["up", "steady", "down", "steady"]) },
      { zone: "Zone B", description: "2nd floor", score: 67, forecast: "steady", sensors: zoneSensors(28, 63, 45, 10200, ["steady", "steady", "steady", "up"]) },
      { zone: "Zone C", description: "4th floor north side", score: 45, forecast: "down", sensors: zoneSensors(30, 70, 55, 7600, ["down", "steady", "down", "steady"]) },
      { zone: "Zone D", description: "4th floor south side", score: 12, forecast: "down", sensors: zoneSensors(32, 78, 66, 4200, ["down", "down", "down", "down"]) },
      { zone: "Zone E", score: 7, forecast: "steady", sensors: zoneSensors(33, 81, 70, 2500, ["steady", "down", "steady", "down"]) },
    ],
  },
  {
    id: "engineering-library",
    name: "Chula Engineering Library",
    map: { x: 61.5, y: 66.9 },
    sensors: locationSensors(12.4, "Normal", ["steady", "steady"]),
    zones: [
      { zone: "Zone A", score: 72, forecast: "up", sensors: zoneSensors(26, 55, 42, 9800, ["up", "steady", "steady", "steady"]) },
      { zone: "Zone B", score: 58, forecast: "steady", sensors: zoneSensors(27, 61, 51, 8200, ["steady", "steady", "down", "steady"]) },
      { zone: "Zone C", score: 21, forecast: "down", sensors: zoneSensors(31, 74, 63, 3100, ["down", "down", "down", "steady"]) },
    ],
  },
];

// ---- Queries ----

/** A zone flattened with its location's name and a 1-based rank. */
export type RankedZone = Zone & { name: string; rank: number };

/** A location with its zones ranked best first (rank is within the location). */
export type LocationRanking = Omit<Location, "zones"> & { zones: RankedZone[] };

const byScore = (a: Zone, b: Zone) => b.score - a.score;

/** Every zone across all locations, best (highest score) first. */
export function getRankings(): RankedZone[] {
  return locations
    .flatMap((loc) => loc.zones.map((z) => ({ ...z, name: loc.name })))
    .sort(byScore)
    .map((z, i) => ({ ...z, rank: i + 1 }));
}

/** Summary of one location for the map's "Location Overview" panel. */
export type LocationSummary = Omit<Location, "zones" | "sensors"> & {
  zones: Zone[];
  /** This location's best / worst zone, with their rank across ALL zones. */
  bestZone: RankedZone;
  worstZone: RankedZone;
  forecastCounts: Record<Forecast, number>;
};

export function getLocationSummaries(): LocationSummary[] {
  const all = getRankings();
  return locations
    .filter((loc) => loc.zones.length > 0)
    .map((loc) => {
      const ranked = all.filter((z) => z.name === loc.name); // already best first
      const forecastCounts: Record<Forecast, number> = { up: 0, steady: 0, down: 0 };
      for (const z of loc.zones) forecastCounts[z.forecast]++;
      return {
        id: loc.id,
        name: loc.name,
        description: loc.description,
        map: loc.map,
        zones: loc.zones,
        bestZone: ranked[0],
        worstZone: ranked[ranked.length - 1],
        forecastCounts,
      };
    });
}

/** A clickable pin on the campus map. `location` is unset for sites with no sensors yet. */
export type MapPin = { id: string; x: number; y: number; label: string; location?: string };

// Pins on the map that don't have a monitored location (yet).
const unassignedSites: MapPin[] = [
  { id: "site-sasin", x: 42.9, y: 28.6, label: "Unassigned site" },
  { id: "site-sport-complex", x: 45.5, y: 60.3, label: "Unassigned site" },
  { id: "site-u-center", x: 45.0, y: 72.7, label: "Unassigned site" },
];

export function getMapPins(): MapPin[] {
  const located = locations.flatMap((loc) =>
    loc.map ? [{ id: loc.id, ...loc.map, label: loc.name, location: loc.name }] : [],
  );
  return [...located, ...unassignedSites];
}

/** Each location with its own zones ranked best first. */
export function getLocationRankings(): LocationRanking[] {
  return locations.map((loc) => ({
    ...loc,
    zones: [...loc.zones]
      .sort(byScore)
      .map((z, i) => ({ ...z, name: loc.name, rank: i + 1 })),
  }));
}
