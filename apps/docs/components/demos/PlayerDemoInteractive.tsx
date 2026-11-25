"use client";

import { Player } from "@foxworth/superimg/react/player";
import { introTemplate } from "@/content/templates/intro-demo";
import { getExampleById } from "@/lib/video/examples";
import { usePlaygroundExample } from "@/lib/playground/example";

interface PlayerDemoInteractiveProps {
  exampleId?: string;
  duration?: number;
}

export function PlayerDemoInteractive({ exampleId, duration = 5 }: PlayerDemoInteractiveProps) {
  if (!exampleId) {
    return (
      <div className="not-prose my-8 flex flex-col items-center">
        <div
          className="w-full overflow-hidden rounded-xl"
          style={{ maxWidth: 640, aspectRatio: "16/9" }}
        >
          <Player
            media={introTemplate}
            size={{ width: 1920, height: 1080 }}
            playbackMode="loop"
            loadMode="eager"
            controls
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    );
  }

  return <CompiledPlayerDemo exampleId={exampleId} duration={duration} />;
}

function CompiledPlayerDemo({ exampleId, duration }: { exampleId: string; duration: number }) {
  const example = getExampleById(exampleId);
  const { media, assets, assetResolver } = usePlaygroundExample(example);

  if (!example) {
    return (
      <div className="not-prose my-8 flex items-center justify-center rounded-xl bg-muted p-8 text-muted-foreground">
        Example &quot;{exampleId}&quot; not found
      </div>
    );
  }

  return (
    <div className="not-prose my-8 flex flex-col items-center">
      <div
        className="w-full overflow-hidden rounded-xl bg-[#0d0d0d]"
        style={{ maxWidth: 640 }}
      >
        <Player
          media={media ?? undefined}
          assets={assets}
          assetResolver={assetResolver}
          size={{ width: 1920, height: 1080 }}
          duration={duration}
          playbackMode="loop"
          loadMode="eager"
          autoPlay
          controls
          className="w-full"
          style={{ aspectRatio: "16/9" }}
        />
      </div>
    </div>
  );
}
