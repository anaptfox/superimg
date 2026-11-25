"use client";

import dynamic from "next/dynamic";
import { DeferredDemo } from "./DeferredDemo";

const InteractiveCodeDemo = dynamic(
  () => import("./CodeDemoInteractive").then((module) => module.CodeDemoInteractive),
  { ssr: false },
);

interface CodeDemoProps {
  exampleId: string;
}

export function CodeDemo({ exampleId }: CodeDemoProps) {
  return (
    <DeferredDemo label={`Interactive code example: ${exampleId}`}>
      <InteractiveCodeDemo exampleId={exampleId} />
    </DeferredDemo>
  );
}
