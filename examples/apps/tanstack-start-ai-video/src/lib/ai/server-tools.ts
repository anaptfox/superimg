import { enrichTopicDef } from "#/lib/ai/tools";

const ACCENT_PALETTE = ["#667eea", "#a855f7", "#22d3ee", "#f97316", "#10b981", "#ef4444"];

export const enrichTopic = enrichTopicDef.server(async ({ topic }, { emitCustomEvent }) => {
  emitCustomEvent("progress", { step: 1, total: 3, message: `Scanning "${topic}"…` });
  await new Promise((r) => setTimeout(r, 200));

  emitCustomEvent("progress", { step: 2, total: 3, message: "Extracting eras and themes…" });
  await new Promise((r) => setTimeout(r, 200));

  const words = topic.split(/\s+/).filter(Boolean);
  const themes = [
    words.slice(0, 2).join(" ") || topic,
    "Key breakthroughs",
    "Industry impact",
  ];

  const era =
    topic.match(/\b(19|20)\d{2}s?\b/)?.[0] ??
    (topic.toLowerCase().includes("history") ? "Historical arc" : "Modern era");

  const suggestedAccent =
    ACCENT_PALETTE[Math.abs(hash(topic)) % ACCENT_PALETTE.length] ?? "#667eea";

  emitCustomEvent("progress", { step: 3, total: 3, message: "Research complete" });

  return { themes, era, suggestedAccent };
});

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h << 5) - h + value.charCodeAt(i);
  return h;
}