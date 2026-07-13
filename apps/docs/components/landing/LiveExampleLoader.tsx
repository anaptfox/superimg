"use client";

import dynamic from "next/dynamic";
import { DeferredLanding } from "./DeferredLanding";

const LiveExample = dynamic(
  () => import("@/components/landing/LiveExample").then((m) => m.LiveExample),
  { ssr: false }
);

export function LiveExampleLoader() {
  return (
    <DeferredLanding minHeight={560}>
      <LiveExample />
    </DeferredLanding>
  );
}
