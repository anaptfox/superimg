// Compilable template code strings used by CodeDemo in the introducing-superimg blog post.
// The code shown in the UI is the same code that gets compiled and rendered.

export const BLOG_INTRO_TEMPLATE = `import { defineScene } from "superimg";

export default defineScene({
  render(ctx) {
    const { width, height, sceneProgress, std } = ctx;

    const opacity = std.tween(0, 1, std.math.clamp(sceneProgress * 3, 0, 1), "easeOutCubic");
    const scale = std.tween(0.8, 1, sceneProgress, "easeOutCubic");

    return \`
      <div style="
        width: \${width}px;
        height: \${height}px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <h1 style="
          font-family: system-ui, sans-serif;
          font-size: 80px;
          font-weight: bold;
          color: white;
          opacity: \${opacity};
          transform: scale(\${scale});
        ">Hello, World!</h1>
      </div>
    \`;
  },
});`;

export const BLOG_EASING_TEMPLATE = `import { defineScene } from "superimg";

export default defineScene({
  config: { duration: 3 },
  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height } = ctx;

    // Map the first second of time to a 0–1 progress value
    const progress = std.math.clamp(time / 1.0, 0, 1);

    const opacity = std.tween(0, 1, progress, "easeOutCubic");
    const y = std.tween(30, 0, progress, "easeOutCubic");

    return \`
      <div style="
        width: \${width}px;
        height: \${height}px;
        background: #0f0f23;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, sans-serif;
      ">
        <h1 style="
          font-size: 72px;
          color: white;
          opacity: \${opacity};
          transform: translateY(\${y}px);
          margin: 0;
        ">Smooth motion</h1>
      </div>
    \`;
  },
});`;

export const BLOG_DATA_TEMPLATE = `import { defineScene } from "superimg";

export default defineScene({
  data: {
    title: "Welcome",
    subtitle: "Customize via data",
    accentColor: "#667eea",
  },
  render(ctx) {
    const { data, std, sceneTimeSeconds: time, width, height } = ctx;
    const { title, subtitle, accentColor } = data;

    const progress = std.math.clamp(time / 1.0, 0, 1);
    const opacity = std.tween(0, 1, progress, "easeOutCubic");
    const y = std.tween(30, 0, progress, "easeOutCubic");

    return \`
      <div style="
        width: \${width}px;
        height: \${height}px;
        background: linear-gradient(135deg, #0f0f23, #1a1a2e);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: system-ui, sans-serif;
      ">
        <h1 style="
          font-size: 64px;
          color: \${accentColor};
          opacity: \${opacity};
          transform: translateY(\${y}px);
          margin: 0;
        ">\${title}</h1>
        <p style="
          font-size: 24px;
          color: white;
          opacity: \${opacity * 0.8};
          transform: translateY(\${y}px);
          margin-top: 16px;
        ">\${subtitle}</p>
      </div>
    \`;
  },
});`;

// Same as "Your First Template" in Getting Started doc — used by CodeDemo on docs + blog
export const GETTING_STARTED_TEMPLATE = `import { defineScene } from "superimg";

export interface TemplateData {
  title: string;
  subtitle: string;
}

export default defineScene<TemplateData>({
  config: {
    fps: 30,
    duration: 4,
    width: 1920,
    height: 1080,
    inlineCss: [\`
      body { font-family: system-ui; color: white; }
      .tagline { font-size: 18px; margin-top: 12px; opacity: 0.5; letter-spacing: 3px; text-transform: uppercase; }
    \`],
  },
  data: {
    title: "Hello, SuperImg",
    subtitle: "Video as code",
  },
  render({ sceneProgress: p, data, std, width, height }) {
    const hue = 230 + p * 60;
    const opacity = std.tween(0, 1, std.math.clamp(p / 0.4, 0, 1), "easeOutCubic");
    const y = std.tween(20, 0, std.math.clamp(p / 0.35, 0, 1), "easeOutCubic");
    const bgStyle = std.css({
      width,
      height,
      background: \`linear-gradient(135deg, hsl(\${hue},65%,14%), hsl(\${hue + 45},75%,8%))\`,
    }, std.css.center());
    return \`
      <div style="\${bgStyle}">
        <div style="\${std.css({ textAlign: "center", opacity, transform: "translateY(" + y + "px)" })}">
          <div style="font-size:64px; font-weight:700; letter-spacing:-2px;">\${data.title}</div>
          <div class="tagline">\${data.subtitle}</div>
        </div>
      </div>
    \`;
  },
});`;

export const BLOG_DEMOS: Record<string, { code: string; duration: number }> = {
  "blog-intro":       { code: BLOG_INTRO_TEMPLATE,       duration: 4 },
  "blog-easing":      { code: BLOG_EASING_TEMPLATE,      duration: 3 },
  "blog-data":        { code: BLOG_DATA_TEMPLATE,        duration: 4 },
  "getting-started":  { code: GETTING_STARTED_TEMPLATE,   duration: 4 },
};
