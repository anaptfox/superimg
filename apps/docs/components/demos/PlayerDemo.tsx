"use client";

import dynamic from "next/dynamic";
import { DeferredDemo } from "./DeferredDemo";

const InteractivePlayerDemo = dynamic(
  () => import("./PlayerDemoInteractive").then((module) => module.PlayerDemoInteractive),
  { ssr: false },
);

interface PlayerDemoProps {
  exampleId?: string;
  duration?: number;
}

export function PlayerDemo({ exampleId, duration = 5 }: PlayerDemoProps) {
  return (
    <DeferredDemo label={`Interactive player${exampleId ? `: ${exampleId}` : ""}`}>
      <InteractivePlayerDemo exampleId={exampleId} duration={duration} />
    </DeferredDemo>
  );
}
