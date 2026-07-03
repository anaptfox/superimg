import { define, type RenderContext } from "superimg/browser";

/** Homepage LiveExample — countdown → GO! with customizable data via player.update */
export const landingCountdownTemplate = define({
  config: {
    fps: 30,
    duration: 6,
    width: 640,
    height: 360,
  },
  sample: {
    name: "GO!",
    startFrom: 5,
    color: "#ffffff",
    fontSize: 180,
    gradient: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
  },
  render(ctx: RenderContext) {
    const { timeline, fps, width, height, std, data } = ctx;
    const second = Math.floor(timeline.frame / fps);
    const count = Math.max(1, (data.startFrom as number) - second);
    const showGo = second >= (data.startFrom as number);

    const bg = std.css(
      {
        width,
        height,
        background: data.gradient as string,
        fontFamily: "system-ui, sans-serif",
      },
      std.css.center(),
    );

    const num = std.css({
      fontSize: data.fontSize as number,
      fontWeight: 800,
      color: data.color as string,
      textShadow: "0 4px 20px rgba(0,0,0,0.5)",
    });

    return `
      <div style="${bg}">
        <div style="${num}">${showGo ? data.name : count}</div>
      </div>
    `;
  },
});

/** How it works — step 1: plain countdown */
export const howItWorksBeforeTemplate = define({
  config: {
    fps: 30,
    duration: 6,
    width: 360,
    height: 360,
  },
  render(ctx: RenderContext) {
    const { timeline, fps, width, height, std } = ctx;
    const count = Math.max(1, 5 - Math.floor(timeline.frame / fps));
    const bgStyle = std.css(
      {
        width,
        height,
        background: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
        fontFamily: "system-ui, sans-serif",
      },
      std.css.center(),
    );
    return `
      <div style="${bgStyle}">
        <div style="${std.css({ fontSize: 180, fontWeight: 800, color: "white", textShadow: "0 4px 20px rgba(0,0,0,0.5)" })}">
          ${count}
        </div>
      </div>
    `;
  },
});

/** How it works — step 3: countdown with pulse + GO! */
export const howItWorksAfterTemplate = define({
  config: {
    fps: 30,
    duration: 6,
    width: 360,
    height: 360,
  },
  render(ctx: RenderContext) {
    const { timeline, fps, width, height, std } = ctx;
    const count = Math.max(1, 5 - Math.floor(timeline.frame / fps));
    const showGo = Math.floor(timeline.frame / fps) >= 5;
    const fraction = (timeline.frame % fps) / fps;
    const pulse = std.interpolate(fraction, [0, 1], [1.2, 1], "easeOutCubic");
    const glow = std.interpolate(fraction, [0, 1], [0.8, 0.2], "easeOutCubic");
    const bgStyle = std.css(
      {
        width,
        height,
        background: "linear-gradient(135deg, #1e1e2e, #2d2d44)",
        fontFamily: "system-ui, sans-serif",
      },
      std.css.center(),
    );
    const numStyle = std.css({
      fontSize: 180,
      fontWeight: 800,
      color: "white",
      transform: `scale(${pulse})`,
      textShadow: `0 0 ${40 * glow}px rgba(102,126,234,${glow})`,
    });
    return `
      <div style="${bgStyle}">
        <div style="${numStyle}">${showGo ? "GO!" : count}</div>
      </div>
    `;
  },
});