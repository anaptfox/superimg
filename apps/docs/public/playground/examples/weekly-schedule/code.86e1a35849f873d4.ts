// Weekly Schedule
// Calendar grid with animated time blocks

const SCHEDULE = {
  Mon: [{ start: 9, duration: 2, type: "deep", label: "Focus Time" }],
  Tue: [
    { start: 10, duration: 1, type: "meeting", label: "Standup" },
    { start: 14, duration: 2, type: "deep", label: "Coding" },
  ],
  Wed: [{ start: 11, duration: 2, type: "meeting", label: "Planning" }],
  Thu: [
    { start: 9, duration: 1, type: "meeting", label: "1:1" },
    { start: 13, duration: 3, type: "deep", label: "Project Work" },
  ],
  Fri: [{ start: 10, duration: 2, type: "deep", label: "Review" }],
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

import { define } from "superimg";
export default define({
  render(ctx) {
  const { width, height, timeline } = ctx;

  const padding = 40;
  const labelWidth = 60;
  const headerHeight = 50;
  const gridWidth = width - padding * 2 - labelWidth;
  const gridHeight = height - padding * 2 - headerHeight;
  const colWidth = gridWidth / DAYS.length;
  const rowHeight = gridHeight / HOURS.length;

  const colors = {
    deep: { bg: "#3b82f6", border: "#2563eb" },
    meeting: { bg: "#f59e0b", border: "#d97706" },
  };

  return `
    <div style="
      width: ${width}px;
      height: ${height}px;
      background: #1e1e2e;
      font-family: system-ui, sans-serif;
      padding: ${padding}px;
      box-sizing: border-box;
    ">
      <!-- Header row with days -->
      <div style="
        display: flex;
        margin-left: ${labelWidth}px;
        margin-bottom: 10px;
      ">
        ${DAYS.map((day, i) => {
          const opacity = Math.min(1, Math.max(0, (timeline.progress * 2 - i * 0.1) * 2));
          return `
            <div style="
              width: ${colWidth}px;
              text-align: center;
              color: #94a3b8;
              font-weight: 600;
              font-size: 16px;
              opacity: ${opacity};
            ">${day}</div>
          `;
        }).join('')}
      </div>

      <!-- Grid container -->
      <div style="display: flex; position: relative;">
        <!-- Time labels -->
        <div style="width: ${labelWidth}px;">
          ${HOURS.map((hour, i) => {
            const opacity = Math.min(1, Math.max(0, timeline.progress * 3 - i * 0.05));
            return `
              <div style="
                height: ${rowHeight}px;
                color: #64748b;
                font-size: 13px;
                display: flex;
                align-items: center;
                opacity: ${opacity};
              ">${hour}:00</div>
            `;
          }).join('')}
        </div>

        <!-- Grid lines -->
        <div style="
          position: relative;
          width: ${gridWidth}px;
          height: ${gridHeight}px;
        ">
          <!-- Horizontal lines -->
          ${HOURS.map((_, i) => `
            <div style="
              position: absolute;
              top: ${i * rowHeight}px;
              left: 0;
              right: 0;
              height: 1px;
              background: rgba(148, 163, 184, 0.1);
            "></div>
          `).join('')}

          <!-- Vertical lines -->
          ${DAYS.map((_, i) => `
            <div style="
              position: absolute;
              left: ${i * colWidth}px;
              top: 0;
              bottom: 0;
              width: 1px;
              background: rgba(148, 163, 184, 0.1);
            "></div>
          `).join('')}

          <!-- Schedule blocks -->
          ${DAYS.map((day, dayIndex) => {
            const dayProgress = Math.max(0, Math.min(1, (timeline.progress - 0.2 - dayIndex * 0.1) * 3));
            return SCHEDULE[day].map((block, blockIndex) => {
              const blockProgress = Math.max(0, Math.min(1, (dayProgress - blockIndex * 0.2) * 2));
              const x = dayIndex * colWidth + 4;
              const y = (block.start - HOURS[0]) * rowHeight + 4;
              const blockHeight = block.duration * rowHeight - 8;
              const blockWidth = colWidth - 8;
              const color = colors[block.type];

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
                  <div style="
                    padding: 8px;
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                  ">${block.label}</div>
                </div>
              `;
            }).join('');
          }).join('')}
        </div>
      </div>

      <!-- Legend -->
      <div style="
        display: flex;
        gap: 24px;
        margin-top: 20px;
        margin-left: ${labelWidth}px;
        opacity: ${Math.min(1, timeline.progress * 2)};
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 3px;"></div>
          <span style="color: #94a3b8; font-size: 13px;">Deep Work</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; background: #f59e0b; border-radius: 3px;"></div>
          <span style="color: #94a3b8; font-size: 13px;">Meetings</span>
        </div>
      </div>
    </div>
  `;
  },
});