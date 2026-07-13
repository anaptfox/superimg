"use client";

import dynamic from "next/dynamic";
import { DeferredLanding } from "./DeferredLanding";

const HowItWorks = dynamic(
  () => import("@/components/landing/HowItWorks").then((m) => m.HowItWorks),
  { ssr: false }
);

export function HowItWorksLoader() {
  return (
    <DeferredLanding minHeight={520}>
      <HowItWorks />
    </DeferredLanding>
  );
}
