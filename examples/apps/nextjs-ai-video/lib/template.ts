import { defineScene } from "superimg";

export interface TimelineData extends Record<string, unknown> {
  title: string;
  events: { date: string; title: string; description: string }[];
  accentColor: string;
}

export const timelineTemplate = defineScene<TimelineData>({
  config: {
    fps: 30,
    duration: 7,
    width: 1920,
    height: 1080,
  },
  defaults: {
    title: "Timeline",
    events: [
      { date: "2020", title: "Event One", description: "Description here" },
      { date: "2021", title: "Event Two", description: "Description here" },
      { date: "2022", title: "Event Three", description: "Description here" },
      { date: "2023", title: "Event Four", description: "Description here" },
      { date: "2024", title: "Event Five", description: "Description here" },
    ],
    accentColor: "#667eea",
  },
  render({ sceneTimeSeconds: t, data, std, width, height }) {
    const { title, events, accentColor } = data;

    const EVENT_SPACING = 160;
    const TITLE_AREA = 220;

    // --- Phase progress ---
    const titleEnterP = std.math.clamp(t / 1.2, 0, 1);
    const accentLineP = std.math.clamp((t - 0.4) / 0.8, 0, 1);
    const scrollP = std.math.clamp((t - 1.2) / 5.0, 0, 1);
    const spineDrawP = std.math.clamp((t - 1.3) / 4.5, 0, 1);
    const exitP = std.math.clamp((t - 6.0) / 1.0, 0, 1);

    // --- Title ---
    const titleOpacity = std.tween(0, 1, titleEnterP, "easeOutCubic");
    const titleY = std.tween(40, 0, titleEnterP, "easeOutCubic");
    const accentLineWidth = std.tween(0, 140, accentLineP, "easeOutCubic");

    // --- Scroll ---
    const startY = 380;
    const endY = 540 - (TITLE_AREA + (events.length - 1) * EVENT_SPACING);
    const easedScroll = std.tween(0, 1, scrollP, "easeInOutCubic");
    const scrollY = startY + (endY - startY) * easedScroll;

    // --- Spine ---
    const totalSpineLength = (events.length - 1) * EVENT_SPACING + 20;
    const activeSpineH = totalSpineLength * std.tween(0, 1, spineDrawP, "easeOutCubic");

    // --- Exit ---
    const exitOverlay = std.tween(0, 1, exitP, "easeInOutCubic");

    // --- Events ---
    const staggerInterval = 4.0 / Math.max(events.length - 1, 1);

    const eventsHtml = events
      .map((event, i) => {
        const eventStart = 1.5 + i * staggerInterval;
        const eventP = std.math.clamp((t - eventStart) / 0.6, 0, 1);
        const dotP = std.math.clamp((t - eventStart) / 0.5, 0, 1);
        const ringP = std.math.clamp((t - eventStart - 0.08) / 0.5, 0, 1);

        const eventOpacity = std.tween(0, 1, eventP, "easeOutCubic");
        const eventSlideX = std.tween(50, 0, eventP, "easeOutCubic");
        const dotScale = std.tween(0, 1, dotP, "easeOutBack");
        const outerRingScale = std.tween(0, 1, ringP, "easeOutCubic");

        const topPx = i * EVENT_SPACING;

        return `
          <div style="position:absolute; top:${topPx}px; left:0; right:0;
                       opacity:${eventOpacity}; transform:translateX(${eventSlideX}px);">
            <!-- Outer ring -->
            <div style="position:absolute; left:${340 - 12}px; top:4px;
                         width:24px; height:24px; border-radius:50%;
                         background:${std.color.alpha(accentColor, 0.15)};
                         transform:scale(${outerRingScale});"></div>
            <!-- Inner dot -->
            <div style="position:absolute; left:${340 - 6}px; top:10px;
                         width:12px; height:12px; border-radius:50%;
                         background:${accentColor};
                         transform:scale(${dotScale});"></div>
            <!-- Text -->
            <div style="margin-left:380px; padding-right:120px;">
              <div style="font-size:32px; font-weight:700; color:${accentColor};
                           line-height:1; margin-bottom:8px;">${event.date}</div>
              <div style="font-size:26px; font-weight:700; color:white;
                           letter-spacing:-0.5px; line-height:1.2; margin-bottom:6px;">${event.title}</div>
              <div style="font-size:19px; font-weight:400; color:rgba(255,255,255,0.45);
                           line-height:1.5; max-width:1100px;">${event.description}</div>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <div style="${std.css({ width, height, position: "relative", overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "linear-gradient(170deg, #08080f 0%, #0d0d1a 50%, #08080f 100%)" })}">

        <!-- Accent glow -->
        <div style="position:absolute; top:0; left:300px; width:500px; height:100%;
                     background:radial-gradient(ellipse at center,
                       ${std.color.alpha(accentColor, 0.07)} 0%, transparent 70%);
                     pointer-events:none;"></div>

        <!-- Scrolling content -->
        <div style="position:absolute; left:0; right:0; transform:translateY(${scrollY}px);">

          <!-- Title -->
          <div style="text-align:center; padding:0 140px;
                       opacity:${titleOpacity}; transform:translateY(${titleY}px);">
            <div style="font-size:64px; font-weight:800; color:white;
                         letter-spacing:-2px; margin:0 0 16px; line-height:1.1;">${title}</div>
            <div style="width:${accentLineWidth}px; height:3px; margin:0 auto;
                         background:linear-gradient(90deg, transparent, ${accentColor}, transparent);
                         border-radius:2px;"></div>
          </div>

          <!-- Timeline -->
          <div style="position:relative; margin-top:60px;">
            <!-- Ghost spine -->
            <div style="position:absolute; left:340px; top:0;
                         width:2px; height:${events.length * EVENT_SPACING}px;
                         background:rgba(255,255,255,0.06);"></div>
            <!-- Active spine -->
            <div style="position:absolute; left:340px; top:0;
                         width:2px; height:${activeSpineH}px;
                         background:${std.color.alpha(accentColor, 0.5)};
                         border-radius:1px;"></div>
            ${eventsHtml}
          </div>
        </div>

        <!-- Exit overlay -->
        <div style="position:absolute; inset:0; background:black;
                     opacity:${exitOverlay}; pointer-events:none;"></div>

        <!-- Watermark -->
        <div style="position:absolute; bottom:36px; right:48px;
                     font-size:16px; color:rgba(255,255,255,0.15);
                     letter-spacing:1px; font-weight:500;
                     opacity:${1 - exitOverlay};">superimg.app</div>
      </div>
    `;
  },
});
