"use client";

import dynamic from "next/dynamic";

const LiveExample = dynamic(
  () => import("@/components/landing/LiveExample").then((m) => m.LiveExample),
  { ssr: false }
);

export function LiveExampleLoader() {
  return <LiveExample />;
}
