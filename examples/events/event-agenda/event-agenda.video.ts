import { defineScene, type RenderContext } from "superimg";

export interface EventSession {
  time: string;
  title: string;
  speaker: string;
}

export interface EventAgendaVideoData extends Record<string, unknown> {
  eventName: string;
  date: string;
  sessions: EventSession[];
  theme: "dark" | "light" | "neon";
  accentColor: string;
}

const THEMES: Record<string, { bg: string; text: string; muted: string; cardBg: string }> = {
  dark: { bg: "#0f0f0f", text: "#ffffff", muted: "#a1a1aa", cardBg: "#18181b" },
  light: { bg: "#f4f4f5", text: "#18181b", muted: "#71717a", cardBg: "#ffffff" },
  neon: { bg: "#0a0014", text: "#ffffff", muted: "#c4b5fd", cardBg: "#150025" },
};

export default defineScene<EventAgendaVideoData>({
  data: {
    eventName: "DevConf 2025",
    date: "March 15, 2025",
    sessions: [
      { time: "9:00 AM", title: "Opening Keynote", speaker: "Sarah Chen" },
      { time: "10:30 AM", title: "The Future of Web", speaker: "Alex Rivera" },
      { time: "1:00 PM", title: "Building at Scale", speaker: "Jordan Lee" },
      { time: "3:30 PM", title: "Lightning Talks", speaker: "Various Speakers" },
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
  render(ctx: RenderContext<EventAgendaVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { eventName, date, sessions, theme, accentColor } = data;

    const t = (THEMES[theme] ?? THEMES.dark) as (typeof THEMES)["dark"];
    const isNeon = theme === "neon";

    const headerProgress = std.interpolate(sceneProgress, [0, 0.15], [0, 1], "easeOutBack");

    const sessionDuration = 0.8 / Math.max(1, sessions.length);
    let maxRevealedIndex = -1;

    let sessionsHtml = "";

    sessions.forEach((session: EventSession, i: number) => {
      const start = 0.15 + i * sessionDuration;
      const end = start + Math.min(sessionDuration, 0.15);
      const sessionProgress = std.interpolate(sceneProgress, [start, end], [0, 1], "easeOutCubic");

      if (sessionProgress > 0) {
        maxRevealedIndex = i;
        const holdProgress = std.interpolate(sceneProgress, [end, 1], [0, 1]);
        const breathe = holdProgress > 0 ? 1 + Math.sin(holdProgress * Math.PI * 4) * 0.006 : 1;
        const timeGlow = isNeon ? `0 0 20px ${accentColor}80, 0 0 40px ${accentColor}40` : `0 0 15px ${accentColor}30`;

        sessionsHtml += `
        <div style="display: flex; gap: 24px; margin-bottom: 24px; opacity: ${sessionProgress}; transform: translateX(${(1 - sessionProgress) * -40}px) scale(${breathe});">
          <div style="width: 160px; flex-shrink: 0; text-align: right; font-size: 24px; font-weight: 700; color: ${accentColor}; padding-top: 4px; text-shadow: ${isNeon ? "0 0 15px " + accentColor : "none"};">
            ${session.time}
          </div>
          <div style="flex: 1; background: ${t.cardBg}; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05), ${timeGlow}; border-left: 4px solid ${accentColor};">
            <div style="font-size: 28px; font-weight: 700; color: ${t.text}; margin-bottom: 8px;">${session.title}</div>
            <div style="font-size: 20px; color: ${t.muted}; display: flex; align-items: center; gap: 8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              ${session.speaker}
            </div>
          </div>
        </div>
      `;
      }
    });

    const totalSessions = sessions.length;
    const lineHeight = maxRevealedIndex >= 0 ? ((maxRevealedIndex + 1) / totalSessions) * 100 : 0;
    const lineProgress = std.interpolate(sceneProgress, [0.15, 0.9], [0, lineHeight], "easeOutCubic");

    let dotsHtml = "";
    sessions.forEach((_: EventSession, i: number) => {
      const start = 0.15 + i * sessionDuration;
      const end = start + Math.min(sessionDuration, 0.1);
      const dotProgress = std.interpolate(sceneProgress, [start, end], [0, 1], "easeOutBack");
      const topPercent = (i / Math.max(1, totalSessions - 1)) * 100;

      if (dotProgress > 0) {
        dotsHtml += `
        <div style="
          position: absolute;
          right: -6px;
          top: ${topPercent}%;
          width: 12px;
          height: 12px;
          background: ${accentColor};
          border-radius: 50%;
          transform: scale(${dotProgress}) translateY(-50%);
          box-shadow: ${isNeon ? "0 0 15px " + accentColor + ", 0 0 30px " + accentColor + "80" : "0 0 10px " + accentColor + "40"};
        "></div>
      `;
      }
    });

    const gradientOverlay = isNeon
      ? `radial-gradient(ellipse at 30% 20%, ${accentColor}20 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, ${accentColor}15 0%, transparent 50%)`
      : `radial-gradient(ellipse at 30% 20%, ${accentColor}10 0%, transparent 50%)`;

    return `
    <div style="width: ${width}px; height: ${height}px; background: ${t.bg}; padding: 60px 80px; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; position: relative;">
      <div style="position: absolute; inset: 0; background: ${gradientOverlay}; pointer-events: none;"></div>

      <div style="text-align: center; margin-bottom: 60px; opacity: ${headerProgress}; transform: translateY(${(1 - headerProgress) * -30}px); position: relative;">
        <div style="font-size: 56px; font-weight: 800; color: ${t.text}; margin-bottom: 12px; letter-spacing: -1px; text-shadow: ${isNeon ? "0 0 30px " + accentColor + "60" : "none"};">${eventName}</div>
        <div style="font-size: 24px; font-weight: 600; color: ${accentColor}; text-transform: uppercase; letter-spacing: 2px; text-shadow: ${isNeon ? "0 0 15px " + accentColor : "none"};">${date}</div>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 900px; margin: 0 auto; width: 100%; position: relative;">
        <div style="position: absolute; left: 154px; top: 30px; bottom: 30px; width: 4px;">
          <div style="position: absolute; inset: 0; background: ${t.muted}20; border-radius: 2px;"></div>
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: ${lineProgress}%;
            background: linear-gradient(180deg, ${accentColor}, ${accentColor}80);
            border-radius: 2px;
            box-shadow: ${isNeon ? "0 0 10px " + accentColor + ", 0 0 20px " + accentColor + "60" : "0 0 8px " + accentColor + "40"};
          "></div>
          ${dotsHtml}
        </div>

        ${sessionsHtml}
      </div>
    </div>
  `;
  },
});
