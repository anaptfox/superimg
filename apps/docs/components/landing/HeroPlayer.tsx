"use client";

import { useRef } from "react";
import { Player, type PlayerRef } from "superimg-react";
import { introTemplate } from "@/content/blog/templates/intro-demo";

export default function HeroPlayer() {
  const playerRef = useRef<PlayerRef>(null);

  return (
    <Player
      ref={playerRef}
      template={introTemplate}
      width={640}
      height={360}
      playbackMode="loop"
      loadMode="eager"
      onLoad={(result) => {
        if (result.status === "success") {
          playerRef.current?.play();
        }
      }}
    />
  );
}
