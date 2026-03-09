import { defineScene } from "superimg";

export default defineScene({
  config: {
    duration: "3s",
    fonts: ["IBM+Plex+Sans:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { width: 100vw; height: 100vh; font-family: 'IBM Plex Sans', sans-serif;
        color: white; overflow: hidden; }
      .container { max-width: 80%; text-align: center; }
      .brand { font-size: 18px; text-transform: uppercase; letter-spacing: 4px; opacity: 0.6; }
    `],
  },
  defaults: {
    heading: "Main Content",
    body: "Shared data flows via compose().",
  },
  render(ctx) {
    const opacity = ctx.std.tween(0, 1, ctx.sceneProgress * 2, "easeOutCubic");
    return `
      <div style="${ctx.std.css.fill()};${ctx.std.css.center()}">
        <div class="container">
          ${ctx.data.brandName ? `<div class="brand">${ctx.data.brandName}</div>` : ""}
          <h1 style="${ctx.std.css({ opacity })}">${ctx.data.heading}</h1>
          <p style="${ctx.std.css({ opacity })}">${ctx.data.body}</p>
        </div>
      </div>
    `;
  },
});
