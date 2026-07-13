"use client";

import dynamic from "next/dynamic";
import { DeferredDemo } from "./DeferredDemo";

const InteractivePlayerDemo = dynamic(
  () => import("./PlayerDemoInteractive").then((module) => module.PlayerDemoInteractive),
  { ssr: false },
);

interface PlayerDemoProps {
  templateId?: string;
  duration?: number;
}

export function PlayerDemo({ templateId, duration = 5 }: PlayerDemoProps) {
  return (
    <DeferredDemo label={`Interactive player${templateId ? `: ${templateId}` : ""}`}>
      <InteractivePlayerDemo templateId={templateId} duration={duration} />
    </DeferredDemo>
  );
}
