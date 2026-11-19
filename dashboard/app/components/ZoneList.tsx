import type { LocationRanking } from "../data/rankings";
import ForecastIcon from "./ForecastIcon";

type ZoneListProps = {
  locations: LocationRanking[];
  selected: { location: string; zone: string };
  onSelect: (location: string, zone: string) => void;
};

// Rank | Zone | Score | Forecast — shared by the header strip and every row.
const columns = "grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem_4rem] items-center px-3";

export default function ZoneList({ locations, selected, onSelect }: ZoneListProps) {
  return (
    <div className="flex flex-col">
      <div
        className={`${columns} rounded-sm bg-[linear-gradient(180deg,#FFFFFF_0%,#D6DADE_100%)] py-1.5 text-xs font-bold text-[#6B6B6B] shadow-[0_1px_3px_rgba(0,0,0,0.25)]`}
      >
        <span>Rank</span>
        <span>Zone</span>
        <span className="text-center">Score</span>
        <span className="text-center">Forecast</span>
      </div>

      {locations.map((loc) => (
        <div key={loc.name} className="mt-3">
          <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
            <h3 className="truncate font-bold text-[#2B2B2B]">{loc.name}</h3>
            <span className="shrink-0 text-[10px]">{loc.zones.length} Zone(s)</span>
          </div>

          <ul className="flex flex-col gap-0.5">
            {loc.zones.map((z) => {
              const isSelected = selected.location === loc.name && selected.zone === z.zone;
              return (
                <li key={z.zone}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(loc.name, z.zone)}
                    className={`${columns} h-11 w-full cursor-pointer rounded-sm text-left shadow-[0_2px_3px_rgba(0,0,0,0.3)] ${
                      isSelected
                        ? "bg-[linear-gradient(180deg,#EAF4F9_0%,#BCD7E5_100%)] ring-2 ring-inset ring-[#4381A0]"
                        : "bg-[linear-gradient(180deg,#FFFFFF_0%,#E3E7EB_100%)] hover:bg-[linear-gradient(180deg,#FFFFFF_0%,#EDF3F7_100%)]"
                    }`}
                  >
                    <span className="text-sm font-bold text-[#6B6B6B] tabular-nums">
                      {String(z.rank).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm">{z.zone}</span>
                    <span className="text-center font-bold tabular-nums">{z.score}</span>
                    <span className="flex justify-center">
                      <ForecastIcon forecast={z.forecast} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
