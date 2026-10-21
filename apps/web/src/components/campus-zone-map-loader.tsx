"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map renders client-side only. */
export const CampusZoneMapLoader = dynamic(() => import("./campus-zone-map"), {
  ssr: false,
  loading: () => <div className="h-[480px] w-full animate-pulse rounded-lg bg-zinc-200" />,
});
