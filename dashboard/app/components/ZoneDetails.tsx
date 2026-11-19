import {
  forecastLabel,
  formatReading,
  type Forecast,
  type LocationRanking,
  type RankedZone,
  type Sensor,
} from "../data/rankings";
import ForecastIcon from "./ForecastIcon";
import SensorChart from "./SensorChart";

const forecastColor: Record<Forecast, string> = {
  up: "text-[#1E6F66]",
  steady: "text-[#7A6420]",
  down: "text-[#7A1414]",
};

function SensorCard({ sensor }: { sensor: Sensor }) {
  return (
    <div className="rounded-sm bg-[linear-gradient(180deg,#FFFFFF_0%,#E3E7EB_100%)] px-3 py-2.5 shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
      <p className="text-sm">{sensor.name}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#6B6B6B]">Current</p>
          <p className="font-bold">{formatReading(sensor)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#1D6E75]">Forecast</p>
          <p className={`font-bold ${forecastColor[sensor.forecast]}`}>{forecastLabel[sensor.forecast]}</p>
        </div>
      </div>
    </div>
  );
}

function SensorGroup({ title, sensors }: { title: string; sensors: Sensor[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#1D6E75]">{title}</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {sensors.map((s) => (
          <SensorCard key={s.name} sensor={s} />
        ))}
      </div>
    </div>
  );
}

type ZoneDetailsProps = {
  location: LocationRanking;
  zone: RankedZone;
};

export default function ZoneDetails({ location, zone }: ZoneDetailsProps) {
  // The chart follows PM2.5 for now; falls back to the first location sensor.
  const chartSensor = location.sensors.find((s) => s.name === "PM2.5") ?? location.sensors[0];

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-white/60 bg-[#F1F8FC]/50 p-4 shadow-[0_2px_6px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm">{location.name}</p>
          <h2 className="text-xl font-bold text-[#2B2B2B]">{zone.zone}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm">Score</p>
          <p className="flex items-center justify-end gap-1.5 text-xl font-bold tabular-nums">
            <ForecastIcon forecast={zone.forecast} className="h-4 w-6" />
            {zone.score}
          </p>
        </div>
      </div>

      <SensorGroup title="Location sensors" sensors={location.sensors} />
      <SensorGroup title="Zone sensors" sensors={zone.sensors} />

      {chartSensor && <SensorChart sensor={chartSensor} />}
    </div>
  );
}
