import { Suspense } from "react";
import MapView, { MapViewFromParams } from "../components/MapView";
import { getLocationSummaries, getMapPins } from "../data/rankings";

export default function MapPage() {
  const pins = getMapPins();
  const summaries = getLocationSummaries();

  // ?site= is only known in the browser; the prerendered fallback shows the default pin.
  return (
    <Suspense fallback={<MapView pins={pins} summaries={summaries} />}>
      <MapViewFromParams pins={pins} summaries={summaries} />
    </Suspense>
  );
}
