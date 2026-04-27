import { defineScene, type RenderContext } from "superimg";

export interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  accentColor?: string;
}

export type TimelineTheme = "minimalist" | "tech" | "corporate" | "playful";

export interface TimelineVideoData extends Record<string, unknown> {
  title: string;
  subtitle?: string;
  events: TimelineEvent[];
  mode?: "dark" | "light";
  theme?: TimelineTheme;
}

interface ThemeConfig {
  bg: { dark: string; light: string };
  text: { dark: string; light: string };
  muted: { dark: string; light: string };
  accent: { dark: string; light: string };
  fontFamily: string;
  nodeActiveStyle: (accent: string, isDark: boolean) => string;
  containerStyle: (isDark: boolean) => string;
  easing: "easeOutCubic" | "easeOutBack";
  imageFilter?: string;
}

const THEMES: Record<TimelineTheme, ThemeConfig> = {
  minimalist: {
    bg: { dark: "#000000", light: "#ffffff" },
    text: { dark: "#ffffff", light: "#000000" },
    muted: { dark: "#888888", light: "#666666" },
    accent: { dark: "#ffffff", light: "#000000" },
    fontFamily: '"Inter", system-ui, sans-serif',
    nodeActiveStyle: (accent) => `background: ${accent}; transform: scale(1.3);`,
    containerStyle: () => "",
    easing: "easeOutCubic",
  },
  tech: {
    bg: { dark: "#0A0A0F", light: "#F3F4F6" },
    text: { dark: "#E2E8F0", light: "#0F172A" },
    muted: { dark: "#888888", light: "#666666" },
    accent: { dark: "#3B82F6", light: "#3B82F6" },
    fontFamily: '"Fira Code", monospace',
    nodeActiveStyle: (accent) => `box-shadow: 0 0 15px ${accent}; border: 1px solid ${accent}; background: ${accent};`,
    containerStyle: (isDark) => isDark ? `background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(148, 163, 184, 0.1);` : "",
    easing: "easeOutCubic",
    imageFilter: "filter: grayscale(80%) sepia(20%) hue-rotate(180deg);",
  },
  corporate: {
    bg: { dark: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", light: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)" },
    text: { dark: "#ffffff", light: "#000000" },
    muted: { dark: "#888888", light: "#666666" },
    accent: { dark: "#2563EB", light: "#2563EB" },
    fontFamily: '"Roboto", system-ui, sans-serif',
    nodeActiveStyle: (accent) => `background: ${accent}; border: 2px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1);`,
    containerStyle: () => "",
    easing: "easeOutCubic",
  },
  playful: {
    bg: { dark: "#1A1A1A", light: "#FEF3C7" },
    text: { dark: "#FDF8F6", light: "#431407" },
    muted: { dark: "#A8A29E", light: "#78716C" },
    accent: { dark: "#EC4899", light: "#EC4899" },
    fontFamily: '"Outfit", "Varela Round", system-ui, sans-serif',
    nodeActiveStyle: (accent) => `background: ${accent}; transform: rotate(-5deg) scale(1.2); box-shadow: 4px 4px 0px rgba(0,0,0,0.2);`,
    containerStyle: (isDark) => `box-shadow: 8px 8px 0px rgba(0,0,0,0.05); border-radius: 24px; border: 2px solid ${isDark ? "#333" : "#ddd"};`,
    easing: "easeOutBack",
  },
};

export default defineScene<TimelineVideoData>({
  data: {
    title: "Product Roadmap",
    subtitle: "What is next for our company",
    events: [
      { date: "Q1 2025", title: "Launch v2.0", description: "Major release", icon: "🚀" },
      { date: "Q2 2025", title: "Mobile app", description: "iOS & Android", icon: "📱" },
      { date: "Q3 2025", title: "Enterprise", description: "Team features", icon: "🏢" },
    ],
    theme: "tech",
    mode: "dark",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
    fonts: [
      "Inter:wght@400;700;800",
      "Fira+Code:wght@400;700",
      "Roboto:wght@400;500;700;800",
      "Outfit:wght@400;500;700;800",
    ],
  },
  render(ctx: RenderContext<TimelineVideoData>) {
    const { width, height, sceneProgress, data, std } = ctx;
    const { title, subtitle, events, mode, theme } = data;
    const isPortrait = height > width;

    const selectedTheme: TimelineTheme = theme ?? "minimalist";
    const themeConfig = THEMES[selectedTheme] ?? THEMES.minimalist;
    const isDark = mode === "dark";
    const themeEasing = themeConfig.easing;

    const bgColor = themeConfig.bg[isDark ? "dark" : "light"];
    const textColor = themeConfig.text[isDark ? "dark" : "light"];
    const mutedColor = themeConfig.muted[isDark ? "dark" : "light"];
    const accentColor = themeConfig.accent[isDark ? "dark" : "light"];
    const fontFamily = themeConfig.fontFamily;
    const containerStyle = themeConfig.containerStyle(isDark);

    const totalEvents = events.length;
    const ENTRANCE_END = totalEvents <= 3 ? 0.15 : totalEvents <= 6 ? 0.10 : 0.07;
    const EXIT_BUFFER = 0.05;
    const progressRemaining = 1 - ENTRANCE_END - EXIT_BUFFER;
    const slicePerEvent = totalEvents > 0 ? progressRemaining / totalEvents : 1;

    const titleProgress = std.interpolate(sceneProgress, [0, 0.1], [0, 1], themeEasing);

    const sidebarWidth = isPortrait ? 80 : 120;
    const mainPadding = isPortrait ? 40 : 60;
    const titleFontSize = isPortrait ? 36 : 48;
    const subtitleFontSize = isPortrait ? 20 : 24;
    const dateFontSize = isPortrait ? 24 : 32;
    const eventTitleFontSize = isPortrait ? 48 : 64;
    const descFontSize = isPortrait ? 22 : 28;
    const imageHeight = isPortrait ? 280 : 360;

    const sidebarNodesHtml = events.map((event: TimelineEvent, i: number) => {
      const eventStart = ENTRANCE_END + i * slicePerEvent;
      const eventEnd = eventStart + slicePerEvent;
      const isActive = sceneProgress >= eventStart && sceneProgress < eventEnd;
      const isPast = sceneProgress >= eventEnd;

      const nodeBaseColor = isPast ? accentColor : (isDark ? "#333333" : "#DDDDDD");
      let currentStyle = `background: ${nodeBaseColor};`;
      if (isActive) {
        currentStyle = themeConfig.nodeActiveStyle(accentColor, isDark);
      }

      const truncatedDate = event.date.length > 6 ? event.date.slice(0, 5) + "…" : event.date;
      const labelOpacity = isActive ? 1 : isPast ? 0.7 : 0.4;

      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; z-index: 2;">
          <div style="width: ${isPortrait ? 12 : 16}px; height: ${isPortrait ? 12 : 16}px; border-radius: 50%; ${currentStyle} z-index: 2;"></div>
          <span style="font-size: ${isPortrait ? 8 : 10}px; color: ${mutedColor}; margin-top: 4px; opacity: ${labelOpacity}; white-space: nowrap; text-align: center;">${truncatedDate}</span>
        </div>
      `;
    }).join("");

    const activeNodeIndex = events.findIndex((_: TimelineEvent, i: number) => {
      const start = ENTRANCE_END + i * slicePerEvent;
      const end = start + slicePerEvent;
      return sceneProgress >= start && sceneProgress < end;
    });

    const displayIndex = activeNodeIndex === -1 ? (sceneProgress > 0.5 ? totalEvents - 1 : 0) : activeNodeIndex;

    const fillPercent = sceneProgress < ENTRANCE_END
      ? 0
      : Math.min(100, ((sceneProgress - ENTRANCE_END) / progressRemaining) * 100);

    let eventContentHtml = "";
    if (totalEvents > 0 && displayIndex >= 0) {
      const e = events[displayIndex]!;
      const start = ENTRANCE_END + displayIndex * slicePerEvent;

      const lp = Math.max(0, Math.min(1, (sceneProgress - start) / slicePerEvent));

      const IN_DUR = 0.15;
      const OUT_DUR = 0.15;

      const t = std.score(lp, [0, IN_DUR, 1 - OUT_DUR, 1]);
      const opacity = t.motion([0, 1, 1, 0], [themeEasing, "linear", "easeOutCubic"]);
      const yOffset = t.motion([40, 0, 0, -40], [themeEasing, "linear", "easeOutCubic"]);

      const eventAccent = e.accentColor || accentColor;

      const imageFilter = themeConfig.imageFilter || "";
      const playfulBorder = theme === "playful" ? `border: 4px solid ${textColor};` : "";
      const imageHtml = e.imageUrl ? `
        <div style="margin-top: ${isPortrait ? 24 : 32}px; width: 100%; height: ${imageHeight}px; border-radius: 16px; background: url('${e.imageUrl}') center/cover; ${playfulBorder} ${imageFilter}"></div>
      ` : "";

      eventContentHtml = `
        <div style="opacity: ${opacity}; transform: translateY(${yOffset}px); display: flex; flex-direction: column; height: 100%; justify-content: center;">
          <div style="font-size: ${dateFontSize}px; font-weight: 700; color: ${eventAccent}; margin-bottom: 8px; letter-spacing: 2px;">
            ${e.date.toUpperCase()}
          </div>
          <div style="font-size: ${eventTitleFontSize}px; font-weight: 800; color: ${textColor}; line-height: 1.1; margin-bottom: 24px;">
            ${e.icon ? `<span style="margin-right: 16px;">${e.icon}</span>` : ""}${e.title}
          </div>
          ${e.description ? `<div style="font-size: ${descFontSize}px; line-height: 1.5; color: ${mutedColor}; font-weight: ${theme === "tech" ? "400" : "500"};">${e.description}</div>` : ""}
          ${imageHtml}
        </div>
        `;
        }

        const mainLayoutOpacity = std.interpolate(std.clamp01((titleProgress - 0.8) / 0.2), [0, 1], [0, 1], "easeOutCubic");

        return `
        <div style="width: ${width}px; height: ${height}px; background: ${bgColor}; font-family: ${fontFamily}; display: flex; flex-direction: column; overflow: hidden; padding: ${mainPadding}px;">      <div style="opacity: ${titleProgress}; transform: translateY(${30 * (1 - titleProgress)}px); margin-bottom: ${isPortrait ? 24 : 40}px;">
        <h1 style="color: ${textColor}; font-size: ${titleFontSize}px; margin: 0; font-weight: 800; letter-spacing: -1px;">${title}</h1>
        ${subtitle ? `<h2 style="color: ${mutedColor}; font-size: ${subtitleFontSize}px; margin: 8px 0 0 0; font-weight: 500;">${subtitle}</h2>` : ""}
      </div>

      <div style="display: flex; flex: 1; height: 100%; opacity: ${mainLayoutOpacity};">
        <div style="width: ${sidebarWidth}px; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 20px 0;">
          <div style="position: absolute; left: 50%; top: 20px; bottom: 20px; width: 4px; background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}; transform: translateX(-50%); border-radius: 2px;"></div>
          <div style="position: absolute; left: 50%; top: 20px; height: ${fillPercent}%; width: 4px; background: ${accentColor}; transform: translateX(-50%); border-radius: 2px;"></div>
          ${sidebarNodesHtml}
        </div>

        <div style="flex: 1; padding-left: ${isPortrait ? 24 : 40}px; ${containerStyle} border-radius: 24px; padding: ${isPortrait ? 24 : 40}px; position: relative;">
          ${eventContentHtml}
        </div>
      </div>
    </div>
  `;
  },
});
