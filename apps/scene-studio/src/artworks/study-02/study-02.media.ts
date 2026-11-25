import { captionStates, centeredCamera, defineInteractive, focusOn } from "@foxworth/superimg/interactive/define";
import { Html } from "@foxworth/superimg";

const ACTS = ["intro", "hold"] as const;

const inlineCss = `* { margin: 0; box-sizing: border-box; }
      body { background: #0b0d12; color: #f5f0e6; font-family: system-ui, sans-serif; }
      .scene-root {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        background: var(--art-bg, #0b0d12);
        color: var(--art-ink, #f5f0e6);
      }
      .scaffold-card {
        width: min(70%, 720px);
        padding: 48px 56px;
        border-radius: 28px;
        border: 1px solid rgba(255,255,255,.12);
        background: linear-gradient(160deg, #171a24, #0f121a);
        box-shadow: 0 40px 80px rgba(0,0,0,.35);
      }
      .scaffold-card h1 { font-size: 56px; letter-spacing: -0.03em; }
      .scaffold-card p { margin-top: 12px; opacity: .7; font-size: 22px; }
      .art-caption-stack {
        position: absolute;
        left: 6.5%;
        right: 6.5%;
        bottom: 7%;
        min-height: 80px;
        pointer-events: none;
      }
      .art-caption {
        position: absolute;
        left: 0;
        bottom: 0;
        max-width: 720px;
        font: 500 42px/1.05 system-ui, sans-serif;
        letter-spacing: -0.03em;
        text-shadow: 0 6px 30px rgba(0,0,0,.28);
      }`;

export default defineInteractive({
  guide: {
    id: "study-02",
    steps: ACTS.map((id) => ({
      id,
      label: id === "intro" ? "Intro" : "Hold",
      duration: "3s",
      scene: { state: id },
      focusNodeId: "card",
    })),
  },
  sample: { edition: "Study02", debugOverlay: false },
  render(ctx) {
    const { scene, std, timeline, width, height, data } = ctx;
    const floatY = std.oscillate(timeline.seconds, { period: "3s", from: -8, to: 8 });
    const quiet = {
      card: { opacity: 1, transform: { y: 0, scale: 1 } },
    };

    scene.states({
      intro: {
        nodes: {
          ...focusOn(quiet, {
            card: { opacity: 1, transform: { y: 24, scale: 0.96 } },
          }),
          ...captionStates(ACTS, "intro"),
        },
        camera: centeredCamera(width, height, {
          zoom: 1,
          fit: { target: "card", padding: 80 },
        }),
      },
      hold: {
        nodes: {
          ...focusOn(quiet, {
            card: { opacity: 1, transform: { y: 0, scale: 1 } },
          }),
          ...captionStates(ACTS, "hold"),
        },
        camera: centeredCamera(width, height, {
          zoom: 1.06,
          fit: { target: "card", padding: 64 },
        }),
      },
    });

    const card = scene.node(
      "card",
      `<div class="scaffold-card" style="transform: translateY(${floatY.toFixed(2)}px)">
        <h1>${data.edition ?? "Study02"}</h1>
        <p>Scaffolded semantic scene — replace me.</p>
      </div>`,
      { kind: "panel", role: "subject", parent: "story" },
    );

    const captionHtml = ACTS.map((id) =>
      scene.node(
        `caption.${id}`,
        `<div class="art-caption">${id}</div>`,
        { kind: "caption", role: "narration", parent: "caption", space: "screen" },
      ),
    ).join("");

    const debugClass = data.debugOverlay ? " is-debug" : "";
    const storyLayer = scene.layer(
      "story",
      `<div class="art-story">${card}</div>`,
      { role: "narrative", space: "world" },
    );
    const captionLayer = scene.layer(
      "caption",
      `<div class="art-caption-stack">${captionHtml}</div>`,
      { role: "narration", space: "screen" },
    );
    return Html({ width: "fill", height: "fill", html: `<style>${inlineCss}</style><div class="scene-root${debugClass}" style="${std.css({ width, height }, std.css.center())}">
      ${storyLayer}
      ${captionLayer}
    </div>` });
  },
});
