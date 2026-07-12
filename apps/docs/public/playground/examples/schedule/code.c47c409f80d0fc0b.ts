import { define, type RenderContext } from "superimg";

export interface ScheduleBlock {
  start: number;
  duration: number;
  type: "deep" | "meeting";
  label: string;
}

export interface ScheduleVideoData extends Record<string, unknown> {
  schedule: Record<string, ScheduleBlock[]>;
  theme: "dark" | "light";
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

const COLORS: Record<string, { bg: string; border: string }> = {
  deep: { bg: "#3b82f6", border: "#2563eb" },
  meeting: { bg: "#f59e0b", border: "#d97706" },
};

export default define<ScheduleVideoData>({
  sample: {
    schedule: {
      Mon: [
        { start: 9, duration: 2, type: "deep", label: "Deep work" },
        { start: 14, duration: 1, type: "meeting", label: "Standup" },
      ],
      Tue: [{ start: 14, duration: 1, type: "meeting", label: "Code review" }],
      Wed: [
        { start: 11, duration: 2, type: "deep", label: "Sprint planning" },
        { start: 15, duration: 1, type: "meeting", label: "1:1" },
      ],
      Thu: [{ start: 10, duration: 3, type: "deep", label: "Feature build" }],
      Fri: [{ start: 13, duration: 2, type: "meeting", label: "Demo day" }],
    },
    theme: "dark",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "6s",
    fonts: ["Inter:wght@400;500;600"],
    inlineCss: [`* { margin: 0; padding: 0; box-sizing: border-box; }`],
  },
  render(ctx: RenderContext<ScheduleVideoData>) {
    const { std, width, height, data } = ctx;
    const { schedule, theme } = data;

    const t = ctx.director({ enter: "55%", hold: "35%", exit: "10%" });

    const bgColor = theme === "dark" ? "#0f172a" : "#f8fafc";
    const textColor = theme === "dark" ? "#e2e8f0" : "#334155";
    const mutedColor = theme === "dark" ? "#64748b" : "#94a3b8";
    const lineColor = theme === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(71, 85, 105, 0.12)";

    const padding = 48;
    const labelWidth = 64;
    const headerHeight = 56;
    const gridWidth = width - padding * 2 - labelWidth;
    const gridHeight = height - padding * 2 - headerHeight - 72;
    const colWidth = gridWidth / DAYS.length;
    const rowHeight = gridHeight / HOURS.length;

    const daysHtml = DAYS.map((day, i) => {
      const opacity = t.tween(0, 1, { during: "enter", at: `${((0.04 + i * 0.035) * 100).toFixed(1)}%`, for: "14%", easing: "easeOutCubic" });
      return `<div style="width: ${colWidth}px; text-align: center; color: ${textColor}; font-weight: 600; font-size: 17px; opacity: ${opacity};">${day}</div>`;
    }).join("");

    const hoursHtml = HOURS.map((hour, i) => {
      const opacity = t.tween(0, 1, { during: "enter", at: `${((0.08 + i * 0.025) * 100).toFixed(1)}%`, for: "12%", easing: "easeOutCubic" });
      return `<div style="height: ${rowHeight}px; color: ${mutedColor}; font-size: 13px; display: flex; align-items: center; opacity: ${opacity};">${hour}:00</div>`;
    }).join("");

    const gridLinesH = HOURS.map((_, i) =>
      `<div style="position: absolute; top: ${i * rowHeight}px; left: 0; right: 0; height: 1px; background: ${lineColor};"></div>`
    ).join("");

    const gridLinesV = DAYS.map((_, i) =>
      `<div style="position: absolute; left: ${i * colWidth}px; top: 0; bottom: 0; width: 1px; background: ${lineColor};"></div>`
    ).join("");

    let blockIndex = 0;
    const blocksHtml = DAYS.map((day, dayIndex) => {
      const blocks = schedule[day] || [];
      return blocks.map((block: ScheduleBlock) => {
        const i = blockIndex++;
        const blockP = t.tween(0, 1, { during: "enter", at: `${((0.22 + i * 0.06) * 100).toFixed(1)}%`, for: "20%", easing: "easeOutCubic" });
        const x = dayIndex * colWidth + 6;
        const y = ((block.start - (HOURS[0] ?? 9)) * rowHeight) + 6;
        const blockHeight = block.duration * rowHeight - 12;
        const blockWidth = colWidth - 12;
        const color = (COLORS[block.type] ?? COLORS.deep)!;

        return `
          <div style="
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${blockWidth}px;
            height: ${blockHeight * blockP}px;
            background: ${color.bg};
            border-left: 3px solid ${color.border};
            border-radius: 6px;
            opacity: ${blockP};
            overflow: hidden;
            box-shadow: 0 4px 12px ${std.color.alpha(color.bg, 0.35)};
          ">
            <div style="padding: 10px; color: white; font-size: 13px; font-weight: 500;">${block.label}</div>
          </div>
        `;
      }).join("");
    }).join("");

    const legendOpacity = t.tween(0, 1, { during: "enter", at: "42%", for: "18%", easing: "easeOutCubic" });
    const titleOpacity = t.tween(0, 1, { during: "enter", at: "0%", for: "20%", easing: "easeOutCubic" });
    const globalOpacity = 1 - t.tween(0, 1, { during: "exit", easing: "easeInCubic" });

    return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: ${bgColor};
      font-family: 'Inter', system-ui, sans-serif;
      padding: ${padding}px;
      box-sizing: border-box;
      opacity: ${globalOpacity};
    ">
      <div style="margin-bottom: 20px; margin-left: ${labelWidth}px; opacity: ${titleOpacity};">
        <div style="font-size: 28px; font-weight: 600; color: ${textColor}; letter-spacing: -0.02em;">Weekly schedule</div>
        <div style="font-size: 15px; color: ${mutedColor}; margin-top: 4px;">Deep work blocks vs meetings</div>
      </div>

      <div style="display: flex; margin-left: ${labelWidth}px; margin-bottom: 12px;">
        ${daysHtml}
      </div>

      <div style="display: flex; position: relative;">
        <div style="width: ${labelWidth}px;">
          ${hoursHtml}
        </div>

        <div style="position: relative; width: ${gridWidth}px; height: ${gridHeight}px; border-radius: 8px; background: ${theme === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"};">
          ${gridLinesH}
          ${gridLinesV}
          ${blocksHtml}
        </div>
      </div>

      <div style="display: flex; gap: 28px; margin-top: 24px; margin-left: ${labelWidth}px; opacity: ${legendOpacity};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 14px; height: 14px; background: #3b82f6; border-radius: 4px;"></div>
          <span style="color: ${textColor}; font-size: 14px;">Deep work</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 14px; height: 14px; background: #f59e0b; border-radius: 4px;"></div>
          <span style="color: ${textColor}; font-size: 14px;">Meetings</span>
        </div>
      </div>
    </div>
  `;
  },
});