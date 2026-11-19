import { formatReading, type Sensor } from "../data/rankings";

type SensorChartProps = {
  sensor: Sensor;
  /** Length of the history window shown on the x-axis. */
  hours?: number;
  // TODO: add `history: { time: Date; value: number }[]` and draw the line/area
  // in the plot area below once the data feed exists.
};

/** Template for the sensor history chart — header, axes and labels only, no plot yet. */
export default function SensorChart({ sensor, hours = 24 }: SensorChartProps) {
  const xLabels = [hours, (hours * 3) / 4, hours / 2, hours / 4].map((h) => `${h}h ago`).concat("Now");

  return (
    <div className="rounded-sm border border-[#C9D6DD] bg-white/70 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#1D6E75]">Sensor data · {sensor.name}</p>
          <p className="text-xs">Sample history · {hours} hours</p>
        </div>
        <p className="text-right font-bold text-[#1D6E75]">
          Current <span className="ml-1">{formatReading(sensor)}</span>
        </p>
      </div>

      <div className="mt-3">
        {sensor.unit && <p className="text-[10px]">{sensor.unit}</p>}

        {/* Plot area — replace the placeholder with the real chart */}
        <div className="relative mt-1 h-44 border-b border-l border-[#B9C6CD]">
          <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-[#D5DEE3]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#D5DEE3]" />
          <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-[#D5DEE3]" />
          <p className="absolute inset-0 flex items-center justify-center text-sm text-[#8A9AA3]">
            Chart coming soon
          </p>
        </div>

        <div className="mt-1 flex justify-between text-[10px]">
          {xLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
