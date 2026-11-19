import type { RankedZone } from "../data/rankings";
import ForecastIcon from "./ForecastIcon";

type RankingListProps = {
  title?: string;
  titleClassName?: string;
  items: RankedZone[];
  /** false when the list is already grouped under one location: cards show the zone only. */
  showLocation?: boolean;
};

// Location | Score | Forecast — shared by the header row and every card.
// Padding lives here too, so header labels sit exactly over the card cells.
const columns =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_3.5rem] items-center gap-1 px-3 lg:grid-cols-[minmax(0,1fr)_4rem_4rem] lg:gap-2";

export default function RankingList({
  title,
  titleClassName = "",
  items,
  showLocation = true,
}: RankingListProps) {
  return (
    <div className="flex flex-col">
      {title && <h3 className={`mb-2 text-lg font-bold ${titleClassName}`}>{title}</h3>}

      <div className={`${columns} mb-1 text-xs font-normal text-[#6B6B6B]`}>
        <span>{showLocation ? "Location" : "Zone"}</span>
        <span className="text-center">Score</span>
        <span className="text-center">Forecast</span>
      </div>

      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.rank}
            className={`${columns} min-h-12 rounded-sm bg-[linear-gradient(180deg,#FFFFFF_0%,#E3E7EB_100%)] py-1.5 shadow-[0_2px_4px_rgba(0,0,0,0.25)]`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-5 shrink-0 text-xs font-bold tabular-nums">{String(item.rank).padStart(2, "0")}</span>
              <div className="min-w-0 leading-tight">
                {showLocation ? (
                  <>
                    <p className="truncate text-sm font-normal">{item.name}</p>
                    <p className="truncate text-xs font-normal">{item.zone}</p>
                  </>
                ) : (
                  <p className="truncate text-sm font-normal">{item.zone}</p>
                )}
              </div>
            </div>
            <span className="text-center text-base font-bold tabular-nums">{item.score}</span>
            <span className="flex justify-center">
              <ForecastIcon forecast={item.forecast} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
