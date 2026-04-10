import { defineScene } from "superimg";

export default defineScene({
  config: {
    fps: 30,
    duration: 12,
    width: 1920,
    height: 1080,
  },
  data: {
    title: "Project Timeline",
    events: [] as { date: string; title: string; description: string }[],
    accentColor: "#38bdf8",
  },
  render({ sceneTimeSeconds: t, data, std, width, height, isPortrait }) {
    const { title, events, accentColor } = data;
    if (!events.length) {
      return `<div style="${std.css({ width, height, background: "#08080f" }, std.css.center())}">
        <div style="color:rgba(255,255,255,0.3); font-size:24px; font-family:system-ui">No events</div>
      </div>`;
    }

    const eventSpacing = isPortrait ? 200 : 160;
    const spineX = isPortrait ? Math.round(width / 2) : 340;
    const titleSize = isPortrait ? 48 : 64;
    const dateSize = isPortrait ? 26 : 32;
    const titleTextSize = isPortrait ? 22 : 26;
    const descSize = isPortrait ? 16 : 19;
    const textMaxW = isPortrait ? Math.round(width / 2 - 80) : 1100;

    const titleEnterP = std.math.clamp(t / 1.5, 0, 1);
    const accentLineP = std.math.clamp((t - 0.5) / 0.8, 0, 1);
    const scrollP = std.math.clamp((t - 2.0) / 8.5, 0, 1);
    const spineDrawP = std.math.clamp((t - 2.1) / 7.8, 0, 1);
    const exitP = std.math.clamp((t - 10.5) / 1.5, 0, 1);

    const titleOpacity = std.tween(0, 1, titleEnterP, "easeOutCubic");
    const titleY = std.tween(40, 0, titleEnterP, "easeOutCubic");
    const accentLineWidth = std.tween(0, 140, accentLineP, "easeOutCubic");

    const titleArea = isPortrait ? 180 : 220;
    const startY = isPortrait ? 600 : 380;
    const endY = Math.round(height / 2) - (titleArea + (events.length - 1) * eventSpacing);
    const scrollY = startY + (endY - startY) * scrollP;

    const totalSpineLength = (events.length - 1) * eventSpacing + 20;
    const activeSpineH = totalSpineLength * std.tween(0, 1, spineDrawP, "easeOutCubic");
    const exitOverlay = std.tween(0, 1, exitP, "easeInOutCubic");
    const staggerInterval = 7.8 / Math.max(events.length - 1, 1);

    const eventsHtml = events
      .map((event, i) => {
        const eventStart = 2.2 + i * staggerInterval;
        const eventP = std.math.clamp((t - eventStart) / 0.8, 0, 1);
        const dotP = std.math.clamp((t - eventStart) / 0.5, 0, 1);
        const ringP = std.math.clamp((t - eventStart - 0.08) / 0.5, 0, 1);

        const eventOpacity = std.tween(0, 1, eventP, "easeOutCubic");
        const dotScale = std.tween(0, 1, dotP, "easeOutBack");
        const outerRingScale = std.tween(0, 1, ringP, "easeOutCubic");
        const topPx = i * eventSpacing;
        const isLeftSide = isPortrait && i % 2 === 1;
        const slideDir = isLeftSide ? -1 : 1;
        const eventSlideX = std.tween(50 * slideDir, 0, eventP, "easeOutCubic");

        let textStyle = `margin-left:${spineX + 40}px; padding-right:120px;`;
        if (isPortrait && isLeftSide) {
          textStyle = `text-align:right; margin-right:${width - spineX + 40}px; margin-left:60px;`;
        } else if (isPortrait) {
          textStyle = `margin-left:${spineX + 40}px; margin-right:60px;`;
        }

        return `
          <div style="position:absolute; top:${topPx}px; left:0; right:0; opacity:${eventOpacity}; transform:translateX(${eventSlideX}px);">
            <div style="position:absolute; left:${spineX - 12}px; top:4px; width:24px; height:24px; border-radius:50%; background:${std.color.alpha(accentColor, 0.15)}; transform:scale(${outerRingScale});"></div>
            <div style="position:absolute; left:${spineX - 6}px; top:10px; width:12px; height:12px; border-radius:50%; background:${accentColor}; transform:scale(${dotScale});"></div>
            <div style="${textStyle}">
              <div style="font-size:${dateSize}px; font-weight:700; color:${accentColor}; line-height:1; margin-bottom:8px;">${event.date}</div>
              <div style="font-size:${titleTextSize}px; font-weight:700; color:white; letter-spacing:-0.5px; line-height:1.2; margin-bottom:6px; max-width:${textMaxW}px;${isLeftSide ? "margin-left:auto;" : ""}">${event.title}</div>
              <div style="font-size:${descSize}px; font-weight:400; color:rgba(255,255,255,0.45); line-height:1.5; max-width:${textMaxW}px;${isLeftSide ? "margin-left:auto;" : ""}">${event.description}</div>
            </div>
          </div>
        `;
      })
      .join("");

    const glowX = isPortrait ? spineX - 250 : 300;

    // If sparse (<= 3 events), center them vertically by reducing scroll
    const isSparse = events.length <= 3;
    const scrollOffset = isSparse ? (height / 2) - (titleArea + (events.length * eventSpacing) / 2) : scrollY;

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden", fontFamily: "Inter, system-ui, -apple-system, sans-serif", background: "linear-gradient(170deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)" })}">
        <div style="position:absolute; top:0; left:${glowX}px; width:500px; height:100%; background:radial-gradient(ellipse at center, ${std.color.alpha(accentColor, 0.07)} 0%, transparent 70%); pointer-events:none;"></div>
        <div style="position:absolute; left:0; right:0; transform:translateY(${scrollOffset}px);">
          <div style="text-align:center; padding:0 ${isPortrait ? 60 : 140}px; opacity:${titleOpacity}; transform:translateY(${titleY}px);">
            <div style="font-size:${titleSize}px; font-weight:800; color:white; letter-spacing:-2px; margin:0 0 16px; line-height:1.1;">${title}</div>
            <div style="width:${accentLineWidth}px; height:3px; margin:0 auto; background:linear-gradient(90deg, transparent, ${accentColor}, transparent); border-radius:2px;"></div>
          </div>
          <div style="position:relative; margin-top:60px;">
            <div style="position:absolute; left:${spineX}px; top:0; width:2px; height:${events.length * eventSpacing}px; background:rgba(255,255,255,0.06);"></div>
            <div style="position:absolute; left:${spineX}px; top:0; width:2px; height:${activeSpineH}px; background:${std.color.alpha(accentColor, 0.5)}; border-radius:1px;"></div>
            ${eventsHtml}
          </div>
        </div>
        <div style="position:absolute; inset:0; background:black; opacity:${exitOverlay}; pointer-events:none;"></div>
      </div>
    `;
  },
});
