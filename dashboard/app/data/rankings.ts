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
  /** Set when this zone shows a live device reading: the reading's time (epoch ms). */
  updatedAt?: number;
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

// ---- Queries (pure; the data comes from getLocations() in ./sensors) ----

/** A zone flattened with its location's name and a 1-based rank. */
export type RankedZone = Zone & { name: string; rank: number };

/** A location with its zones ranked best first (rank is within the location). */
export type LocationRanking = Omit<Location, "zones"> & { zones: RankedZone[] };

const byScore = (a: Zone, b: Zone) => b.score - a.score;

/** Every zone across all locations, best (highest score) first. */
export function getRankings(locations: Location[]): RankedZone[] {
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

export function getLocationSummaries(locations: Location[]): LocationSummary[] {
  const all = getRankings(locations);
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

export function getMapPins(locations: Location[], unassignedSites: MapPin[] = []): MapPin[] {
  const located = locations.flatMap((loc) =>
    loc.map ? [{ id: loc.id, ...loc.map, label: loc.name, location: loc.name }] : [],
  );
  return [...located, ...unassignedSites];
}

/** Each location with its own zones ranked best first. */
export function getLocationRankings(locations: Location[]): LocationRanking[] {
  return locations.map((loc) => ({
    ...loc,
    zones: [...loc.zones]
      .sort(byScore)
      .map((z, i) => ({ ...z, name: loc.name, rank: i + 1 })),
  }));
}
