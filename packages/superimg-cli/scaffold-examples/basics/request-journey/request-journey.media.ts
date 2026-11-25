//! How a web request becomes a page — one live interactive lesson.

import { defineInteractive, type SceneGuide } from "@foxworth/superimg/interactive/define";
import { Html } from "@foxworth/superimg";

interface LessonData {
  title: string;
}

const STEPS = [
  { id: "dns", label: "DNS", note: "Resolve the hostname to an IP address." },
  { id: "connect", label: "Connect", note: "Open a connection to the server." },
  { id: "server", label: "Server", note: "The origin builds the response." },
  { id: "response", label: "Response", note: "Bytes become a rendered page." },
] as const;

const guide: SceneGuide = {
  id: "request-journey",
  steps: STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    note: step.note,
    scene: { state: step.id },
    duration: "2s",
    focusNodeId: step.id,
  })),
};

export default defineInteractive<LessonData>({
  guide,
  sample: { title: "How a web request becomes a page" },
  render(ctx) {
    const active = ctx.scene.snapshot().activeState ?? "dns";
    const cards = STEPS.map((step) => {
      const selected = step.id === active;
      return ctx.scene.layer(
        step.id,
        `<div style="flex:1;padding:22px;border-radius:16px;text-align:center;
          border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);
          opacity:${selected ? 1 : 0.38};transform:scale(${selected ? 1.06 : 1})">
          <strong>${step.label}</strong>
        </div>`,
        { role: "actor", tags: ["request-path"] },
      );
    });
    const note = STEPS.find((step) => step.id === active)?.note ?? STEPS[0].note;
    return Html({ width: "fill", height: "fill", html: `<main style="width:${ctx.width}px;height:${ctx.height}px;padding:64px;
      box-sizing:border-box;background:#0b1020;color:#e8eefc;font-family:system-ui;
      display:flex;flex-direction:column;justify-content:center;gap:28px">
      <h1>${ctx.data.title}</h1>
      <div style="display:flex;gap:16px">${cards.join("")}</div>
      <p>${note}</p>
    </main>` });
  },
});
