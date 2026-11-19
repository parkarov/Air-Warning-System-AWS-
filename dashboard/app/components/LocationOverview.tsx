import Link from "next/link";
import type { Forecast, LocationSummary } from "../data/rankings";

const exploreHref = (location: string, zone?: string) =>
  `/explore?${new URLSearchParams(zone ? { location, zone } : { location })}`;

const counts: { forecast: Forecast; label: string; color: string }[] = [
  { forecast: "up", label: "Improving", color: "text-[#009951]" },
  { forecast: "steady", label: "Stable", color: "text-[#BF6A02]" },
  { forecast: "down", label: "Worsening", color: "text-[#C00F0C]" },
];

const card =
  "rounded-sm border border-white/60 bg-[#F1F8FC]/70 p-4 shadow-[0_2px_6px_rgba(0,0,0,0.2)]";

export default function LocationOverview({ summary, label }: { summary?: LocationSummary; label: string }) {
  if (!summary) {
    return (
      <div className={card}>
        <h2 className="text-center text-2xl font-bold">{label}</h2>
        <p className="mt-3 text-center text-sm">No sensors are reporting from this site yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={card}>
        <h2 className="text-center text-3xl font-bold">{summary.name}</h2>

        <div className="mt-3 flex flex-col text-sm font-bold text-[#1A6FD6]">
          <Link href={exploreHref(summary.name, summary.bestZone.zone)} className="hover:underline">
            #{summary.bestZone.rank} Best Zone
          </Link>
          <Link href={exploreHref(summary.name, summary.worstZone.zone)} className="hover:underline">
            #{summary.worstZone.rank} Worst Zone
          </Link>
        </div>

        {summary.description && <p className="mt-2 text-xs leading-snug">{summary.description}</p>}

        <ul className="mt-3 text-xs">
          {summary.zones.map((z) => (
            <li key={z.zone}>
              {z.zone}
              {z.description && ` : ${z.description}`}
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs font-bold">Zones</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {counts.map(({ forecast, label: text, color }) => (
            <div key={forecast}>
              <p className={`text-2xl font-bold leading-none ${color}`}>{summary.forecastCounts[forecast]}</p>
              <p className="mt-1 text-xs">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <Link
        href={exploreHref(summary.name)}
        className="block rounded-sm bg-[linear-gradient(180deg,#FFFFFF_0%,#B7B7B7_100%)] py-2 text-center text-2xl font-bold shadow-[0_2px_4px_rgba(0,0,0,0.3)] hover:bg-[linear-gradient(180deg,#FFFFFF_0%,#CFCFCF_100%)]"
      >
        View Details
      </Link>
    </div>
  );
}
