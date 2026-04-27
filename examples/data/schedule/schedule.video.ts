import { defineScene, type RenderContext } from "superimg";

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

export default defineScene<ScheduleVideoData>({
  data: {
    schedule: {
      Mon: [{ start: 9, duration: 2, type: "deep", label: "Standup" }],
      Tue: [{ start: 14, duration: 1, type: "meeting", label: "Code Review" }],
      Wed: [{ start: 11, duration: 2, type: "deep", label: "Sprint Planning" }],
    },
    theme: "dark",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
  },
  render(ctx: RenderContext<ScheduleVideoData>) {
    const { width, height, sceneProgress, data } = ctx;
    const { schedule, theme } = data;

    const bgColor = theme === "dark" ? "#1e1e2e" : "#f8fafc";
    const textColor = theme === "dark" ? "#94a3b8" : "#475569";
    const mutedColor = theme === "dark" ? "#64748b" : "#94a3b8";
    const lineColor = theme === "dark" ? "rgba(148, 163, 184, 0.1)" : "rgba(71, 85, 105, 0.1)";

    const padding = 40;
    const labelWidth = 60;
    const headerHeight = 50;
    const gridWidth = width - padding * 2 - labelWidth;
    const gridHeight = height - padding * 2 - headerHeight - 60;
    const colWidth = gridWidth / DAYS.length;
    const rowHeight = gridHeight / HOURS.length;

    const daysHtml = DAYS.map((day, i) => {
      const opacity = Math.min(1, Math.max(0, (sceneProgress * 2 - i * 0.1) * 2));
      return `<div style="width: ${colWidth}px; text-align: center; color: ${textColor}; font-weight: 600; font-size: 16px; opacity: ${opacity};">${day}</div>`;
    }).join("");

    const hoursHtml = HOURS.map((hour, i) => {
      const opacity = Math.min(1, Math.max(0, sceneProgress * 3 - i * 0.05));
      return `<div style="height: ${rowHeight}px; color: ${mutedColor}; font-size: 13px; display: flex; align-items: center; opacity: ${opacity};">${hour}:00</div>`;
    }).join("");

    const gridLinesH = HOURS.map((_, i) =>
      `<div style="position: absolute; top: ${i * rowHeight}px; left: 0; right: 0; height: 1px; background: ${lineColor};"></div>`
    ).join("");

    const gridLinesV = DAYS.map((_, i) =>
      `<div style="position: absolute; left: ${i * colWidth}px; top: 0; bottom: 0; width: 1px; background: ${lineColor};"></div>`
    ).join("");

    const blocksHtml = DAYS.map((day, dayIndex) => {
      const dayProgress = Math.max(0, Math.min(1, (sceneProgress - 0.2 - dayIndex * 0.1) * 3));
      const blocks = schedule[day] || [];
      return blocks.map((block: ScheduleBlock, blockIndex: number) => {
        const blockProgress = Math.max(0, Math.min(1, (dayProgress - blockIndex * 0.2) * 2));
        const x = dayIndex * colWidth + 4;
        const y = ((block.start - (HOURS[0] ?? 9)) * rowHeight) + 4;
        const blockHeight = block.duration * rowHeight - 8;
        const blockWidth = colWidth - 8;
        const color = (COLORS[block.type] ?? COLORS.deep)!;

        return `
          <div style="
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${blockWidth}px;
            height: ${blockHeight * blockProgress}px;
            background: ${color.bg};
            border-left: 3px solid ${color.border};
            border-radius: 4px;
            opacity: ${blockProgress};
            overflow: hidden;
          ">
            <div style="padding: 8px; color: white; font-size: 12px; font-weight: 500;">${block.label}</div>
          </div>
        `;
      }).join("");
    }).join("");

    const legendOpacity = Math.min(1, sceneProgress * 2);

    return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: ${bgColor};
      font-family: system-ui, sans-serif;
      padding: ${padding}px;
      box-sizing: border-box;
    ">
      <div style="display: flex; margin-left: ${labelWidth}px; margin-bottom: 10px;">
        ${daysHtml}
      </div>

      <div style="display: flex; position: relative;">
        <div style="width: ${labelWidth}px;">
          ${hoursHtml}
        </div>

        <div style="position: relative; width: ${gridWidth}px; height: ${gridHeight}px;">
          ${gridLinesH}
          ${gridLinesV}
          ${blocksHtml}
        </div>
      </div>

      <div style="display: flex; gap: 24px; margin-top: 20px; margin-left: ${labelWidth}px; opacity: ${legendOpacity};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 3px;"></div>
          <span style="color: ${textColor}; font-size: 13px;">Deep Work</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: #f59e0b; border-radius: 3px;"></div>
          <span style="color: ${textColor}; font-size: 13px;">Meetings</span>
        </div>
      </div>
    </div>
  `;
  },
});
