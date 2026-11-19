import { Suspense } from "react";
import Bar from "./components/Bar";
import CampusMap from "./components/CampusMap";
import Loading from "./components/Loading";
import RankingList from "./components/RankingList";
import { getMapPins, getRankings } from "./data/rankings";
import { getLocations, unassignedSites } from "./data/sensors";

const SHOWN = 4;

export default function HomePage() {
  // Live data is fetched at request time, so it streams in behind a fallback.
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const locations = await getLocations();
  const rankings = getRankings(locations);
  const best = rankings.slice(0, SHOWN);
  const worst = rankings.slice(-SHOWN).reverse(); // worst first

  return (
    <div className="flex flex-1 flex-col text-[#474747] md:flex-row">
      {/* Rankings */}
      <section className="flex flex-col md:w-[65%]">
        <Bar className="px-5 py-1 text-lg font-bold">Rankings</Bar>
        <div className="flex-1 p-5">
          <div className="grid grid-cols-1 h-full gap-x-7 gap-y-6 rounded-sm border border-white/60 bg-[#F1F8FC]/50 p-3 shadow-[0_2px_6px_rgba(0,0,0,0.2)] sm:grid-cols-2">
            <RankingList title="Best" titleClassName="text-[#1B7A43]" items={best} />
            <RankingList title="Worst" titleClassName="text-[#A3302A]" items={worst} />
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="flex min-h-80 flex-1 flex-col border-[#9A9A9A] md:border-l">
        <Bar className="px-5 py-1 text-lg font-bold">Map</Bar>
        {/* Pins link to the Map page with that site selected */}
        <CampusMap pins={getMapPins(locations, unassignedSites)} linkTo="/map" className="min-h-80 flex-1" />
      </section>
    </div>
  );
}
