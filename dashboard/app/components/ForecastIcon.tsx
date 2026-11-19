import { forecastLabel, type Forecast } from "../data/rankings";

// Same shapes/colours as public/Icon.svg, Icon(1).svg, Icon(2).svg,
// inlined so they scale with the text and need no extra requests.
const icons: Record<Forecast, { viewBox: string; d: string; color: string }> = {
  up: {
    viewBox: "0 0 32 19",
    d: "M30.6666 1.5L18 14.1667L11.3333 7.5L1.33331 17.5M30.6666 9.5V1.5H22.6666",
    color: "#009951",
  },
  steady: {
    viewBox: "0 0 22 22",
    d: "M1.50002 10.8333H20.1667M10.8334 20.1667L20.1667 10.8333L10.8334 1.5",
    color: "#BF6A02",
  },
  down: {
    viewBox: "0 0 32 19",
    d: "M30.6666 17.5L18 4.83333L11.3333 11.5L1.33331 1.5M30.6666 9.5L30.6666 17.5H22.6666",
    color: "#C00F0C",
  },
};

type ForecastIconProps = {
  forecast: Forecast;
  className?: string;
};

export default function ForecastIcon({ forecast, className = "h-4 w-5" }: ForecastIconProps) {
  const { viewBox, d, color } = icons[forecast];
  return (
    <svg viewBox={viewBox} fill="none" className={className} role="img" aria-label={forecastLabel[forecast]}>
      <path d={d} stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
