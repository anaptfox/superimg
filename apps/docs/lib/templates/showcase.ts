import { defineTemplate, type RenderContext } from "superimg";

// Getting Started: Hello World with fade-in effect
export const helloWorldTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const { sceneProgress: p, std, width, height } = ctx;

    const textProgress = std.math.clamp(p / 0.4, 0, 1);
    const textOpacity = std.easing.easeOutCubic(textProgress);
    const textScale = std.math.lerp(0.8, 1, std.easing.easeOutCubic(textProgress));

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
export const countdownTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const { sceneProgress: p, std, width, height } = ctx;

    const units = [
      { label: "DAYS", value: 14 },
      { label: "HRS", value: 8 },
      { label: "MIN", value: 32 },
      { label: "SEC", value: Math.floor(45 - p * 5) },
    ];

    const unitsHtml = units
      .map((unit, i) => {
        const delay = i * 0.1;
        const opacity = std.math.clamp((p - delay) * 3, 0, 1);
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
        <div style="font-size:12px;color:#888;letter-spacing:2px;margin-bottom:12px;opacity:${std.math.clamp(p * 3, 0, 1)};">
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
export const testimonialTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const { sceneProgress: p, std, width, height } = ctx;

    const cardOpacity = std.math.clamp(p * 3, 0, 1);
    const cardY = std.math.lerp(20, 0, std.easing.easeOutCubic(std.math.clamp(p * 2, 0, 1)));
    const quoteOpacity = std.math.clamp((p - 0.2) * 2.5, 0, 1);

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

// Data: Animated bar chart
export const chartTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const { sceneProgress: p, std, width, height } = ctx;

    const bars = [
      { label: "Mon", value: 75, color: "#3b82f6" },
      { label: "Tue", value: 45, color: "#8b5cf6" },
      { label: "Wed", value: 90, color: "#10b981" },
      { label: "Thu", value: 60, color: "#f59e0b" },
      { label: "Fri", value: 100, color: "#ef4444" },
    ];

    const maxValue = Math.max(...bars.map((b) => b.value));
    const barWidth = 36;
    const chartHeight = 100;

    const barsHtml = bars
      .map((bar, i) => {
        const delay = i * 0.1;
        const barProgress = std.math.clamp((p - delay) * 2, 0, 1);
        const barHeight = (bar.value / maxValue) * chartHeight * std.easing.easeOutCubic(barProgress);
        return `
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="
              width:${barWidth}px;
              height:${chartHeight}px;
              display:flex;
              align-items:flex-end;
            ">
              <div style="
                width:100%;
                height:${barHeight}px;
                background:${bar.color};
                border-radius:4px 4px 0 0;
              "></div>
            </div>
            <div style="font-size:9px;color:#94a3b8;">${bar.label}</div>
          </div>
        `;
      })
      .join("");

    return `
      <style>* { margin:0; padding:0; box-sizing:border-box; }</style>
      <div style="
        width:${width}px;
        height:${height}px;
        background:#0f172a;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        font-family:system-ui,-apple-system,sans-serif;
        padding:16px;
      ">
        <div style="font-size:14px;color:white;font-weight:600;margin-bottom:12px;opacity:${std.math.clamp(p * 3, 0, 1)};">
          Weekly Activity
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;">
          ${barsHtml}
        </div>
      </div>
    `;
  },
});

// Developer: Terminal typing effect
export const terminalTemplate = defineTemplate({
  config: {
    fps: 30,
    durationSeconds: 3,
    width: 320,
    height: 180,
  },
  render(ctx: RenderContext) {
    const { sceneProgress: p, sceneTimeSeconds, std, width, height } = ctx;

    const command = "npm create superimg@latest";
    const output = "✓ Project created successfully!";

    const cmdChars = Math.floor(std.math.clamp(p * 2.5, 0, 1) * command.length);
    const displayCmd = command.slice(0, cmdChars);
    const showCursor = Math.floor(sceneTimeSeconds * 3) % 2 === 0;
    const outputOpacity = std.math.clamp((p - 0.5) * 3, 0, 1);

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
            <span style="color:#9ece6a;">❯</span> ${displayCmd}<span style="opacity:${showCursor && cmdChars < command.length ? 1 : 0};color:#7aa2f7;">▋</span>
          </div>
          <div style="color:#9ece6a;font-size:11px;opacity:${outputOpacity};">
            ${output}
          </div>
        </div>
      </div>
    `;
  },
});
