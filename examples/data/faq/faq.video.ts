import { defineScene, type RenderContext } from "superimg";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqVideoData extends Record<string, unknown> {
  topic: string;
  items: FaqItem[];
  theme: "dark" | "light" | "neon";
  accentColor: string;
}

const THEMES: Record<string, { bg: string; cardBg: string; text: string; muted: string; border: string }> = {
  dark: { bg: "#0f0f0f", cardBg: "#18181b", text: "#ffffff", muted: "#a1a1aa", border: "#27272a" },
  light: { bg: "#f4f4f5", cardBg: "#ffffff", text: "#18181b", muted: "#71717a", border: "#e4e4e7" },
  neon: { bg: "#0a0014", cardBg: "#150025", text: "#ffffff", muted: "#c4b5fd", border: "#581c87" },
};

export default defineScene<FaqVideoData>({
  data: {
    topic: "TypeScript Myths Busted",
    items: [
      { question: "TypeScript is slow?", answer: "Types are removed at compile time. Zero runtime cost." },
      { question: "It's just for big teams?", answer: "Solo devs benefit most from autocomplete and error catching." },
      { question: "Hard to learn?", answer: "Start with any, then gradually add types. It's incremental." },
    ],
    theme: "dark",
    accentColor: "#3b82f6",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 8.5,
  },
  render(ctx: RenderContext<FaqVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { topic, items, theme, accentColor } = data;

    const t = (THEMES[theme] ?? THEMES.dark) as (typeof THEMES)["dark"];
    const isNeon = theme === "neon";

    const topicProgress = std.interpolate(sceneProgress, [0, 0.1], [0, 1], "easeOutCubic");

    const numItems = Math.max(1, items.length);
    const itemDuration = 0.85 / numItems;
    const startOffset = 0.1;

    let itemsHtml = "";

    items.forEach((item: FaqItem, i: number) => {
      const itemStart = startOffset + i * itemDuration;
      const qStart = itemStart;
      const qEnd = itemStart + itemDuration * 0.2;
      const qProgress = std.interpolate(sceneProgress, [qStart, qEnd], [0, 1], "easeOutBack");

      const aStart = itemStart + itemDuration * 0.4;
      const aEnd = itemStart + itemDuration * 0.6;
      const aProgress = std.interpolate(sceneProgress, [aStart, aEnd], [0, 1], "easeOutCubic");

      const holdProgress = std.interpolate(sceneProgress, [aEnd, 1], [0, 1]);
      const breathe = holdProgress > 0 ? 1 + Math.sin(holdProgress * Math.PI * 4) * 0.02 : 1;

      const qGlow = isNeon ? `0 0 20px ${accentColor}80` : `0 0 15px ${accentColor}30`;

      if (qProgress > 0) {
        itemsHtml += `
        <div style="margin-bottom: 32px; opacity: ${qProgress}; transform: translateY(${(1 - qProgress) * 20}px);">
          <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 12px;">
            <div style="background: ${accentColor}20; color: ${accentColor}; font-weight: 800; font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; flex-shrink: 0; transform: scale(${breathe}); box-shadow: ${qGlow}; text-shadow: ${isNeon ? "0 0 10px " + accentColor : "none"};">Q</div>
            <div style="font-size: 28px; font-weight: 600; color: ${t.text}; line-height: 1.4; padding-top: 2px;">${item.question}</div>
          </div>

          ${aProgress > 0 ? `
            <div style="display: flex; gap: 16px; align-items: flex-start; opacity: ${aProgress}; transform: translateY(${(1 - aProgress) * 10}px);">
              <div style="background: ${t.border}; color: ${t.muted}; font-weight: 800; font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; flex-shrink: 0; transform: scale(${breathe});">A</div>
              <div style="font-size: 24px; color: ${t.muted}; line-height: 1.5; padding-top: 4px;">${item.answer}</div>
            </div>
          ` : ""}
        </div>
      `;
      }
    });

    const gradientOverlay = isNeon
      ? `radial-gradient(ellipse at 20% 30%, ${accentColor}25 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, ${accentColor}15 0%, transparent 50%)`
      : `radial-gradient(ellipse at 30% 20%, ${accentColor}10 0%, transparent 50%)`;

    return `
    <div style="width: ${width}px; height: ${height}px; background: ${t.bg}; padding: 80px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; position: relative;">
      <div style="position: absolute; inset: 0; background: ${gradientOverlay}; pointer-events: none;"></div>

      <div style="opacity: ${topicProgress}; transform: translateY(${(1 - topicProgress) * -20}px); margin-bottom: 60px; text-align: center; position: relative;">
        <div style="display: inline-block; background: ${accentColor}; color: white; font-weight: 700; font-size: 20px; padding: 8px 24px; border-radius: 99px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; box-shadow: ${isNeon ? "0 0 25px " + accentColor + "80" : "none"};">FAQ / Myth Busting</div>
        <div style="font-size: 48px; font-weight: 800; color: ${t.text}; text-shadow: ${isNeon ? "0 0 20px " + accentColor + "40" : "none"};">${topic}</div>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 900px; margin: 0 auto; width: 100%; position: relative;">
        ${itemsHtml}
      </div>
    </div>
  `;
  },
});
