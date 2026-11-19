import { Suspense } from "react";
import ExploreView, { ExploreViewFromParams } from "../components/ExploreView";
import { getLocationRankings } from "../data/rankings";

export default function ExplorePage() {
  // Data is loaded here (server); ExploreView handles the zone selection (client).
  // ?location=&zone= is only known in the browser; the prerendered fallback shows the default zone.
  const locations = getLocationRankings();
  return (
    <Suspense fallback={<ExploreView locations={locations} />}>
      <ExploreViewFromParams locations={locations} />
    </Suspense>
  );
}
