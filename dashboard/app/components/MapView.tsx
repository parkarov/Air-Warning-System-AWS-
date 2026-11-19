"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { LocationSummary, MapPin } from "../data/rankings";
import Bar from "./Bar";
import CampusMap from "./CampusMap";
import LocationOverview from "./LocationOverview";

type MapViewProps = {
  pins: MapPin[];
  summaries: LocationSummary[];
  /** Pin id to start on; defaults to the first pin. */
  initialSite?: string;
};

export default function MapView({ pins, summaries, initialSite }: MapViewProps) {
  const [selectedId, setSelectedId] = useState(
    () => pins.find((p) => p.id === initialSite)?.id ?? pins[0]?.id,
  );
  const pin = pins.find((p) => p.id === selectedId);
  const summary = summaries.find((s) => s.name === pin?.location);

  return (
    <div className="flex flex-1 flex-col text-[#474747] md:flex-row">
      <CampusMap
        pins={pins}
        selectedId={selectedId}
        onSelect={(p) => setSelectedId(p.id)}
        className="min-h-80 flex-1"
      />

      <section className="flex flex-col border-[#9A9A9A] md:w-[26%] md:min-w-72 md:border-l">
        <Bar className="px-5 py-1 text-lg font-bold">Location Overview</Bar>
        <div className="flex-1 bg-[linear-gradient(180deg,#FFFFFF80_0%,#4381A080_100%)] p-3">
          {pin ? (
            <LocationOverview summary={summary} label={pin.label} />
          ) : (
            <p className="p-4">Select a pin on the map.</p>
          )}
        </div>
      </section>
    </div>
  );
}

/** Reads ?site=<pin id> (links from the home page map). Render inside <Suspense>. */
export function MapViewFromParams(props: Omit<MapViewProps, "initialSite">) {
  const site = useSearchParams().get("site") ?? undefined;
  return <MapView key={site} {...props} initialSite={site} />;
}
