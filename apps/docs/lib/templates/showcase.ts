import { define, type RenderContext } from "superimg/browser";

// Getting Started: Hello World with fade-in effect
export const helloWorldTemplate = define({
  config: {
    fps: 30,
    duration: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const  { timeline, std, width, height } = ctx;

    const textProgress = std.math.clamp(timeline.progress / 0.4, 0, 1);
    const textOpacity = std.interpolate(textProgress, [0, 1], [0, 1], "easeOutCubic");
    const textScale = std.interpolate(textProgress, [0, 1], [0.8, 1], "easeOutCubic");

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:system-ui,-apple-system,sans-serif;
      ">
        <div style="
          font-size:32px;
          font-weight:700;
          color:white;
          opacity:${textOpacity};
          transform:scale(${textScale});
          text-shadow:0 2px 10px rgba(0,0,0,0.2);
        ">Hello, World!</div>
      </div>
    `;
  },
});

// Marketing: Countdown timer animation
export const countdownTemplate = define({
  config: {
    fps: 30,
    duration: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const  { timeline, std, width, height } = ctx;

    const units = [
      { label: "DAYS", value: 14 },
      { label: "HRS", value: 8 },
      { label: "MIN", value: 32 },
      { label: "SEC", value: Math.floor(45 - timeline.progress * 5) },
    ];

    const unitsHtml = units
      .map((unit, i) => {
        const delay = i * 0.1;
        const opacity = std.math.clamp((timeline.progress - delay) * 3, 0, 1);
        const scale = 0.8 + opacity * 0.2;
        return `
          <div style="text-align:center;opacity:${opacity};transform:scale(${scale});">
            <div style="
              background:linear-gradient(180deg, #2a2a4a 0%, #1a1a3a 100%);
              border-radius:6px;
              padding:8px 10px;
              min-width:50px;
            ">
              <div style="font-size:24px;font-weight:700;color:white;line-height:1;">
                ${String(unit.value).padStart(2, "0")}
              </div>
            </div>
            <div style="margin-top:4px;font-size:8px;color:#666;letter-spacing:1px;">
              ${unit.label}
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:linear-gradient(180deg, #0f0f23 0%, #1a1a3e 100%);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        font-family:system-ui,-apple-system,sans-serif;
      ">
        <div style="font-size:12px;color:#888;letter-spacing:2px;margin-bottom:12px;opacity:${std.math.clamp(timeline.progress * 3, 0, 1)};">
          PRODUCT LAUNCH
        </div>
        <div style="display:flex;gap:12px;">
          ${unitsHtml}
        </div>
      </div>
    `;
  },
});

// Social: Testimonial quote card animation
export const testimonialTemplate = define({
  config: {
    fps: 30,
    duration: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const  { timeline, std, width, height } = ctx;

    const cardOpacity = std.math.clamp(timeline.progress * 3, 0, 1);
    const cardY = std.interpolate(timeline.progress, [0, 0.5], [20, 0], "easeOutCubic");
    const quoteOpacity = std.math.clamp((timeline.progress - 0.2) * 2.5, 0, 1);

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:system-ui,-apple-system,sans-serif;
        padding:20px;
      ">
        <div style="
          background:rgba(255,255,255,0.05);
          border-radius:12px;
          padding:16px;
          opacity:${cardOpacity};
          transform:translateY(${cardY}px);
        ">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="font-size:24px;">👩‍💻</span>
            <div>
              <div style="color:white;font-weight:600;font-size:12px;">Sarah Chen</div>
              <div style="color:#888;font-size:10px;">@sarahc</div>
            </div>
          </div>
          <p style="color:#ccc;font-size:11px;line-height:1.4;opacity:${quoteOpacity};margin:0;">
            "This changed how we build videos. Incredible DX!"
          </p>
        </div>
      </div>
    `;
  },
});

// Data: Animated bar chart (viz.charts.bar)
export const chartTemplate = define({
  config: {
    fps: 30,
    duration: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const  { timeline, std, width, height } = ctx;
    const viz = std.viz;

    const bars = [
      { label: "Mon", value: 75 },
      { label: "Tue", value: 45 },
      { label: "Wed", value: 90 },
      { label: "Thu", value: 60 },
      { label: "Fri", value: 100 },
    ];

    const coords = viz.createCoords({
      width,
      height,
      xRange: [0, 5],
      yRange: [0, 100],
      padding: { top: 36, bottom: 28, left: 20, right: 20 },
    });

    const barsEl = viz.charts.bar(coords, bars, {
      animate: "grow",
      progress: timeline.progress,
      colors: ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"],
      showLabels: true,
      barRadius: 4,
      labelFontSize: 9,
    });

    const titleOp = std.math.clamp(timeline.progress * 3, 0, 1);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0f172a"/>
  <text x="${width / 2}" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#ffffff" opacity="${titleOp.toFixed(3)}">Weekly Activity</text>
  ${barsEl}
</svg>`;
  },
});

// Vector: Animated shapes and strokes
export const vectorTemplate = define({
  config: {
    fps: 30,
    duration: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const  { timeline, std, width, height } = ctx;

    const ringProgress = std.math.clamp(timeline.progress / 0.45, 0, 1);
    const orbitProgress = std.math.clamp((timeline.progress - 0.15) / 0.7, 0, 1);
    const fadeProgress = std.math.clamp((timeline.progress - 0.75) / 0.25, 0, 1);

    const ringScale = std.interpolate(ringProgress, [0, 1], [0.7, 1], "easeOutBack");
    const ringOpacity = std.interpolate(ringProgress, [0, 1], [0, 1], "easeOutCubic") * (1 - fadeProgress * 0.5);
    const orbitX = std.interpolate(orbitProgress, [0, 1], [64, 256], "easeInOutCubic");
    const orbitY = 90 + Math.sin(orbitProgress * Math.PI * 2) * 24;
    const pathOffset = std.interpolate(orbitProgress, [0, 1], [220, 0], "easeOutCubic");

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:radial-gradient(circle at 20% 20%, #1f2a44 0%, #0b1020 60%, #050812 100%);
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
      ">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <path
            d="M36 128 C 84 44, 236 44, 284 128"
            fill="none"
            stroke="rgba(116, 236, 214, 0.45)"
            stroke-width="3"
            stroke-linecap="round"
            stroke-dasharray="220"
            stroke-dashoffset="${pathOffset}"
          />
          <circle
            cx="160"
            cy="90"
            r="42"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            stroke-width="4"
            style="opacity:${ringOpacity};transform-origin:160px 90px;transform:scale(${ringScale});"
          />
          <circle
            cx="160"
            cy="90"
            r="18"
            fill="#74ecd6"
            style="opacity:${ringOpacity};transform-origin:160px 90px;transform:scale(${std.interpolate(ringProgress, [0, 1], [0.4, 1], "easeOutBack")});"
          />
          <circle
            cx="${orbitX}"
            cy="${orbitY}"
            r="12"
            fill="#ff8b5e"
            style="filter:drop-shadow(0 0 12px rgba(255,139,94,0.45));"
          />
        </svg>
      </div>
    `;
  },
});

// Developer: Terminal typing effect
export const terminalTemplate = define({
  config: {
    fps: 30,
    duration: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const  { timeline, std, width, height } = ctx;

    const command = "npm create superimg@latest";
    const output = "✓ Project created successfully!";

    const cmdProgress = std.math.clamp(timeline.progress * 2.5, 0, 1);
    const { visible: displayCmd, typing: cmdTyping } = std.text.type(command, cmdProgress);
    const showCursor = std.text.cursor(timeline.seconds);
    const outputOpacity = std.math.clamp((timeline.progress - 0.5) * 3, 0, 1);

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:#1a1b26;
        font-family:'SF Mono',Monaco,monospace;
        padding:16px;
      ">
        <div style="
          background:#0f0f14;
          border-radius:8px;
          height:100%;
          padding:12px;
        ">
          <div style="display:flex;gap:6px;margin-bottom:12px;">
            <div style="width:10px;height:10px;border-radius:50%;background:#ff5f56;"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:#ffbd2e;"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:#27ca40;"></div>
          </div>
          <div style="color:#7aa2f7;font-size:12px;margin:6px 0;">
            <span style="color:#9ece6a;">❯</span> ${displayCmd}<span style="opacity:${cmdTyping && showCursor ? 1 : 0};color:#7aa2f7;">▋</span>
          </div>
          <div style="color:#9ece6a;font-size:11px;opacity:${outputOpacity};">
            ${output}
          </div>
        </div>
      </div>
    `;
  },
});
