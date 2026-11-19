import "server-only";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import type { Forecast, Location, MapPin, Sensor, Zone } from "./rankings";

// ---- Live feed ----
// Server-only: the API key never reaches the browser.
// .env:  SENSOR_API_KEY=...            (sent as the x-api-key header)
//        SENSOR_API_URL=https://...    (optional, defaults to the URL below)

const DEFAULT_API_URL = "https://yvgafxhpjqgq4zoqo2zqjdp2u40mivdo.lambda-url.ap-southeast-2.on.aws/";

/** One device reading, as sent by the sensor API. */
export type Reading = {
  device_id: string;
  ts: number; // epoch ms
  seq?: number;
  pm25: number;
  temp_c: number;
  humidity: number;
  noise: number;
  light: number;
  gas_idx: number;
  gas_warm: boolean;
  comfort: number; // 0–100, used as the zone score
  label?: string; // e.g. "POOR"
  simulated?: boolean;
};

/** Which zone each device sits in. Add a line per new device. */
const DEVICES: Record<string, { location: string; zone: string }> = {
  "node-1": { location: "central-library", zone: "Zone A" },
};

/** The API may return one reading, an array, or an array wrapped in an object. */
function toList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const key of ["items", "readings", "data", "Items"]) {
      const v = (json as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v;
    }
    return [json];
  }
  return [];
}

const isReading = (r: unknown): r is Reading =>
  !!r && typeof r === "object" && typeof (r as Reading).device_id === "string" && typeof (r as Reading).ts === "number";

/** Latest reading per device. Empty if the key is missing or the API fails (the page then shows mock data). */
async function getLatestReadings(): Promise<Reading[]> {
  "use cache";
  cacheLife("seconds");

  const apiKey = process.env.SENSOR_API_KEY?.trim();
  if (!apiKey) {
    console.warn("sensor error");
    return [];
  }

  try {
    const res = await fetch(process.env.SENSOR_API_URL || DEFAULT_API_URL, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const latest = new Map<string, Reading>();
    for (const r of toList(await res.json()).filter(isReading)) {
      const prev = latest.get(r.device_id);
      if (!prev || r.ts > prev.ts || (r.ts === prev.ts && (r.seq ?? 0) > (prev.seq ?? 0))) {
        latest.set(r.device_id, r);
      }
    }
    return [...latest.values()];
  } catch (err) {
    console.error("[sensors] Failed to fetch readings:", err);
    return [];
  }
}

// No history yet, so live values can't show a trend.
const LIVE_FORECAST: Forecast = "steady";

const round1 = (n: number) => Math.round(n * 10) / 10;

// Noise and light are left unitless: the device sends raw values (light tops out at 4095, a 12-bit ADC).
const liveZoneSensors = (r: Reading): Sensor[] => [
  { name: "Temperature", value: round1(r.temp_c), unit: "°C", forecast: LIVE_FORECAST },
  { name: "Humidity", value: round1(r.humidity), unit: "% RH", forecast: LIVE_FORECAST },
  { name: "Noise", value: r.noise, forecast: LIVE_FORECAST },
  { name: "Light", value: r.light, forecast: LIVE_FORECAST },
];

/** Building-wide sensors from all of the location's live devices (PM2.5 averaged, worst gas index). */
function liveLocationSensors(readings: Reading[]): Sensor[] {
  const pm25 = round1(readings.reduce((sum, r) => sum + r.pm25, 0) / readings.length);
  const warm = readings.filter((r) => r.gas_warm);
  const gas = warm.length ? Math.max(...warm.map((r) => r.gas_idx)) : "Warming up";
  return [
    { name: "PM2.5", value: pm25, unit: "µg/m³", forecast: LIVE_FORECAST },
    { name: "Hazardous Gas", value: gas, forecast: LIVE_FORECAST },
  ];
}

/** Mock locations with each mapped device's latest reading laid over its zone. */
export async function getLocations(): Promise<Location[]> {
  await connection(); // live data: never bake a reading into the prerendered shell
  const readings = await getLatestReadings();

  return mockLocations.map((loc) => {
    const here = readings.filter((r) => DEVICES[r.device_id]?.location === loc.id);
    if (here.length === 0) return loc;

    const zones = loc.zones.map((z): Zone => {
      const r = here.find((r) => DEVICES[r.device_id].zone === z.zone);
      if (!r) return z;
      return {
        ...z,
        score: Math.round(r.comfort),
        forecast: LIVE_FORECAST,
        sensors: liveZoneSensors(r),
        updatedAt: r.ts,
      };
    });
    return { ...loc, sensors: liveLocationSensors(here), zones };
  });
}

// ---- Mock data — zones without a device keep these values. ----

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

const mockLocations: Location[] = [
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

/** Pins on the map that don't have a monitored location (yet). */
export const unassignedSites: MapPin[] = [
  { id: "site-sasin", x: 42.9, y: 28.6, label: "Unassigned site" },
  { id: "site-sport-complex", x: 45.5, y: 60.3, label: "Unassigned site" },
  { id: "site-u-center", x: 45.0, y: 72.7, label: "Unassigned site" },
];
