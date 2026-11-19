import { Suspense } from "react";
import Loading from "../components/Loading";
import MapView, { MapViewFromParams } from "../components/MapView";
import { getLocationSummaries, getMapPins } from "../data/rankings";
import { getLocations, unassignedSites } from "../data/sensors";

export default function MapPage() {
  // Live data is fetched at request time, so it streams in behind a fallback.
  return (
    <Suspense fallback={<Loading />}>
      <MapContent />
    </Suspense>
  );
}

async function MapContent() {
  const locations = await getLocations();
  const pins = getMapPins(locations, unassignedSites);
  const summaries = getLocationSummaries(locations);

  return (
    <Suspense fallback={<MapView pins={pins} summaries={summaries} />}>
      <MapViewFromParams pins={pins} summaries={summaries} />
    </Suspense>
  );
}
