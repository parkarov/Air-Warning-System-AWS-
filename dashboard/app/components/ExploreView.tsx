"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { LocationRanking } from "../data/rankings";
import Bar from "./Bar";
import ZoneDetails from "./ZoneDetails";
import ZoneList from "./ZoneList";

type ExploreViewProps = {
  locations: LocationRanking[];
  /** Location name / zone to start on; defaults to the first location's best zone. */
  initialLocation?: string;
  initialZone?: string;
};

export default function ExploreView({ locations, initialLocation, initialZone }: ExploreViewProps) {
  const [selected, setSelected] = useState(() => {
    const loc = locations.find((l) => l.name === initialLocation) ?? locations[0];
    const zone = loc?.zones.find((z) => z.zone === initialZone) ?? loc?.zones[0];
    return { location: loc?.name ?? "", zone: zone?.zone ?? "" };
  });

  const location = locations.find((l) => l.name === selected.location) ?? locations[0];
  const zone = location?.zones.find((z) => z.zone === selected.zone) ?? location?.zones[0];

  return (
    <div className="flex flex-1 flex-col text-[#474747] md:flex-row">
      {/* Location */}
      <section className="flex flex-col md:w-1/3">
        <Bar className="px-5 py-1 text-lg font-bold">Location</Bar>
        <div className="flex-1 bg-[linear-gradient(180deg,#FFFFFF80_0%,#4381A080_100%)] p-3">
          <ZoneList
            locations={locations}
            selected={selected}
            onSelect={(loc, z) => setSelected({ location: loc, zone: z })}
          />
        </div>
      </section>

      {/* Detailed Information */}
      <section className="flex flex-1 flex-col border-[#9A9A9A] md:border-l">
        <Bar className="px-5 py-1 text-lg font-bold">Detailed Information</Bar>
        <div className="flex-1 p-3">
          {location && zone ? (
            <ZoneDetails location={location} zone={zone} />
          ) : (
            <p className="p-4">No locations to show.</p>
          )}
        </div>
      </section>
    </div>
  );
}

/** Reads ?location=&zone= (links from the map page). Render inside <Suspense>. */
export function ExploreViewFromParams({ locations }: { locations: LocationRanking[] }) {
  const params = useSearchParams();
  const location = params.get("location") ?? undefined;
  const zone = params.get("zone") ?? undefined;
  return (
    <ExploreView
      key={`${location}|${zone}`}
      locations={locations}
      initialLocation={location}
      initialZone={zone}
    />
  );
}
