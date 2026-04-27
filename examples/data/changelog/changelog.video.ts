import { defineScene, type RenderContext } from "superimg";

export interface ChangelogSection {
  type: "added" | "changed" | "fixed" | "removed" | "security" | "deprecated";
  items: string[];
}

export interface ChangelogVideoData extends Record<string, unknown> {
  version: string;
  date: string;
  title: string;
  sections: ChangelogSection[];
  theme: "dark" | "light";
  accentColor: string;
}

const SECTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  added: { icon: "+", color: "#22c55e", label: "Added" },
  changed: { icon: "~", color: "#3b82f6", label: "Changed" },
  fixed: { icon: "x", color: "#f59e0b", label: "Fixed" },
  removed: { icon: "-", color: "#ef4444", label: "Removed" },
  security: { icon: "!", color: "#a855f7", label: "Security" },
  deprecated: { icon: "d", color: "#71717a", label: "Deprecated" },
};

const TIMING = {
  headerFadeIn: { start: 0, end: 0.15 },
  sectionsReveal: { start: 0.15, end: 0.95 },
  final: { start: 0.95, end: 1.0 },
};

export default defineScene<ChangelogVideoData>({
  data: {
    version: "2.0.0",
    date: "2025-01-15",
    title: "Major Release",
    sections: [
      { type: "added", items: ["New dashboard with real-time analytics", "Dark mode support"] },
      { type: "changed", items: ["Improved performance by 50%"] },
      { type: "fixed", items: ["Fixed login issue on Safari"] },
    ],
    theme: "dark",
    accentColor: "#3b82f6",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6.2,
  },
  render(ctx: RenderContext<ChangelogVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { version, date, title, sections, theme, accentColor } = data;

    const bgColor = theme === "dark" ? "#0f0f0f" : "#ffffff";
    const textColor = theme === "dark" ? "#ffffff" : "#0f0f0f";
    const mutedColor = theme === "dark" ? "#71717a" : "#a1a1aa";
    const gradientEnd = theme === "dark" ? "#1a1a2e" : "#e4e4e7";

    const headerProgress = std.interpolate(sceneProgress, [TIMING.headerFadeIn.start, TIMING.headerFadeIn.end], [0, 1], "easeOutBack");
    const sectionsProgress = std.interpolate(sceneProgress, [TIMING.sectionsReveal.start, TIMING.sectionsReveal.end], [0, 1]);

    const totalItems = sections.reduce((acc: number, s: ChangelogSection) => acc + s.items.length + 1, 0);
    let itemIndex = 0;

    let sectionsHtml = "";

    for (const section of sections) {
      const config = (SECTION_CONFIG[section.type] ?? SECTION_CONFIG.changed)!;

      const sectionHeaderProgress = Math.max(0, Math.min(1, (sectionsProgress * totalItems - itemIndex) * 2));
      itemIndex++;

      if (sectionHeaderProgress <= 0) continue;

      const headerOpacity = std.interpolate(sectionHeaderProgress, [0, 1], [0, 1], "easeOutCubic");
      const headerTransform = (1 - sectionHeaderProgress) * 20;

      sectionsHtml += `
      <div style="margin-bottom: 24px; opacity: ${headerOpacity}; transform: translateX(${headerTransform}px);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: ${config.color}20; display: flex; align-items: center; justify-content: center; font-weight: 700; color: ${config.color}; font-size: 18px;">${config.icon}</div>
          <span style="font-size: 28px; font-weight: 600; color: ${config.color};">${config.label}</span>
        </div>
        <div style="padding-left: 44px;">
    `;

      let sectionClosed = false;
      for (let i = 0; i < section.items.length; i++) {
        const itemProgress = Math.max(0, Math.min(1, (sectionsProgress * totalItems - itemIndex) * 3));
        itemIndex++;

        if (itemProgress <= 0) {
          sectionsHtml += "</div></div>";
          sectionClosed = true;
          break;
        }

        const itemOpacity = std.interpolate(itemProgress, [0, 1], [0, 1], "easeOutCubic");
        const itemTransform = (1 - itemProgress) * 15;

        sectionsHtml += `
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; opacity: ${itemOpacity}; transform: translateX(${itemTransform}px);">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${config.color}; margin-top: 12px; flex-shrink: 0;"></div>
          <span style="font-size: 24px; color: ${textColor}; line-height: 1.5;">${section.items[i]}</span>
        </div>
      `;
      }
      if (!sectionClosed) sectionsHtml += "</div></div>";
    }

    return `
    <div style="width: ${width}px; height: ${height}px; background: linear-gradient(180deg, ${bgColor} 0%, ${gradientEnd} 100%); display: flex; flex-direction: column; padding: 80px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="margin-bottom: 48px; opacity: ${headerProgress}; transform: scale(${0.8 + headerProgress * 0.2});">
        <div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: 8px;">
          <span style="font-size: 64px; font-weight: 800; color: ${accentColor};">v${version}</span>
          ${date ? `<span style="font-size: 24px; color: ${mutedColor};">${date}</span>` : ""}
        </div>
        ${title ? `<div style="font-size: 32px; color: ${textColor}; opacity: 0.9;">${title}</div>` : ""}
      </div>
      <div style="flex: 1; overflow: hidden;">
        ${sectionsHtml}
      </div>
    </div>
  `;
  },
});
