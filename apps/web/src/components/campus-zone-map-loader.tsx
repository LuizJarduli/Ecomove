"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map renders client-side only. */
export const CampusZoneMapLoader = dynamic(() => import("./campus-zone-map"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] w-full animate-pulse rounded-2xl border border-[#E7E7E4] bg-[#F3F2EF]" />
  ),
});
