"use client";

import { useRef } from "react";
import { Player, type PlayerRef } from "superimg-react/player";
import { introTemplate } from "@/content/blog/templates/intro-demo";

export default function HeroPlayer() {
  const playerRef = useRef<PlayerRef>(null);

  return (
    <Player
      ref={playerRef}
      template={introTemplate}
      format="horizontal"
      playbackMode="loop"
      loadMode="eager"
      style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
      onLoad={(result) => {
        if (result.status === "success") {
          playerRef.current?.play();
        }
      }}
    />
  );
}
