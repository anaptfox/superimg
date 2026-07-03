import SuperImgPlayer from "./SuperImgPlayer";
import type { TemplateVariant } from "../lib/templates";

const demos: {
  id: TemplateVariant;
  title: string;
  controls?: boolean;
  hover?: boolean;
}[] = [
  { id: "hello", title: "Hello card", controls: true },
  { id: "pulse", title: "Pulse loop", hover: true },
  { id: "gradient", title: "Gradient sweep", hover: true },
];

export default function PlayerGrid() {
  return (
    <div className="player-grid">
      {demos.map((demo) => (
        <article key={demo.id} className="player-card">
          <h3>{demo.title}</h3>
          <SuperImgPlayer
            variant={demo.id}
            format="horizontal"
            playbackMode="loop"
            loadMode={demo.hover ? "lazy" : "eager"}
            hoverBehavior={demo.hover ? "play" : "none"}
            hoverDelayMs={200}
            controls={demo.controls}
          />
        </article>
      ))}
    </div>
  );
}