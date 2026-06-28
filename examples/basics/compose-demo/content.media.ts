import { define } from "superimg";

export default define({
  config: {
    fps: 30,
    duration: "3s",
    fonts: ["IBM+Plex+Sans:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 100vw; height: 100vh; font-family: 'IBM Plex Sans', sans-serif;
        color: white; overflow: hidden; }
      .container { max-width: 80%; text-align: center; }
      .brand { font-size: 18px; text-transform: uppercase; letter-spacing: 4px; opacity: 0.6; }
      h1 { font-size: 64px; font-weight: 700; margin-bottom: 16px; }
      p { font-size: 28px; opacity: 0.85; line-height: 1.5; }
    `],
  },
  sample: {
    heading: "Main Content",
    body: "Shared data flows via compose().",
    brandName: undefined as string | undefined,
  },
  render(ctx) {
    const { std, data } = ctx;
    const t = ctx.director({ enter: "60%", hold: "30%", exit: "10%" });
    const heading = t.motion({ during: "enter", at: "0%", for: "35%", y: 20, easing: "easeOutCubic" });
    const body = t.motion({ during: "enter", at: "15%", for: "35%", y: 16, easing: "easeOutCubic" });

    return `
      <div style="${std.css(std.css.fill(), std.css.center())}">
        <div class="container">
          ${data.brandName ? `<div class="brand" style="opacity:${heading.opacity * 0.6}">${data.brandName}</div>` : ""}
          <h1 style="${heading.style}">${data.heading}</h1>
          <p style="${body.style}">${data.body}</p>
        </div>
      </div>
    `;
  },
});