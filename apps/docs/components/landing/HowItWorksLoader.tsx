"use client";

import dynamic from "next/dynamic";

const HowItWorks = dynamic(
  () => import("@/components/landing/HowItWorks").then((m) => m.HowItWorks),
  { ssr: false }
);

export function HowItWorksLoader() {
  return <HowItWorks />;
}
