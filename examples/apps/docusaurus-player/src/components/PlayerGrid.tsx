import SuperImgPlayer from "@site/src/components/SuperImgPlayer";
import {
  gradientTemplate,
  helloTemplate,
  pulseTemplate,
} from "@site/src/lib/hello-template";

const demos = [
  { id: "hello", title: "Hello card", template: helloTemplate },
  { id: "pulse", title: "Pulse loop", template: pulseTemplate },
  { id: "gradient", title: "Gradient sweep", template: gradientTemplate },
] as const;

/** Compact comparison row for the bottom of a doc page — not a homepage hero. */
export default function PlayerGrid() {
  return (
    <div className="row margin-top--md">
      {demos.map((demo) => (
        <div key={demo.id} className="col col--4 margin-bottom--md">
          <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 8 }}>{demo.title}</p>
          <SuperImgPlayer
            label={demo.id}
            template={demo.template}
            format="horizontal"
            playbackMode="loop"
            loadMode="lazy"
            hoverBehavior="play"
            hoverDelayMs={200}
          />
        </div>
      ))}
    </div>
  );
}