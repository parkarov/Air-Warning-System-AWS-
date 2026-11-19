"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the current page's server data every `seconds`, keeping client state (selections) intact. */
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
