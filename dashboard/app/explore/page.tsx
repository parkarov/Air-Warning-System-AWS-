import { Suspense } from "react";
import ExploreView, { ExploreViewFromParams } from "../components/ExploreView";
import Loading from "../components/Loading";
import { getLocationRankings } from "../data/rankings";
import { getLocations } from "../data/sensors";

export default function ExplorePage() {
  // Live data is fetched at request time, so it streams in behind a fallback.
  return (
    <Suspense fallback={<Loading />}>
      <Explore />
    </Suspense>
  );
}

async function Explore() {
  // Data is loaded here (server); ExploreView handles the zone selection (client).
  const locations = getLocationRankings(await getLocations());
  return (
    <Suspense fallback={<ExploreView locations={locations} />}>
      <ExploreViewFromParams locations={locations} />
    </Suspense>
  );
}
