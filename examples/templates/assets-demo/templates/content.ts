import { defineTemplate } from "superimg";

export default defineTemplate({
  config: {
    fonts: ["IBM+Plex+Sans:wght@400;700"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100vw; height: 100vh;
        font-family: 'IBM Plex Sans', system-ui, sans-serif;
        overflow: hidden;
      }
      .container { max-width: 80%; text-align: center; }
      .brand {
        font-size: 18px; text-transform: uppercase;
        letter-spacing: 4px; opacity: 0.6; margin-bottom: 32px;
      }
      .heading {
        font-size: 72px; font-weight: 700; margin-bottom: 32px;
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
      }
      .body { font-size: 28px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
      .progress-bar {
        position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
        width: 200px; height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px; overflow: hidden;
      }
      .progress-fill { height: 100%; background: white; border-radius: 2px; }
    `],
  },
  defaults: {
    heading: "Main Content",
    body: "This demonstrates the asset API.",
    showProgress: true,
    textColor: "#ffffff",
  },
  render(ctx) {
    const { std, sceneProgress, data, shared } = ctx;
    const { heading, body, showProgress, textColor } = data;

    const headingOpacity = std.math.clamp(sceneProgress * 3, 0, 1);
    const bodyOpacity = std.math.clamp((sceneProgress - 0.2) * 2, 0, 1);
    const headingY = std.tween(20, 0, headingOpacity, "easeOutCubic");
    const brandName = shared?.brandName;

    const headingStyle = std.css({ opacity: headingOpacity, transform: "translateY(" + headingY + "px)" });

    return `
    <div style="${std.css.fill()};${std.css.center()};${std.css({ color: textColor })}">
      <div class="container">
        ${brandName ? `<div class="brand">${brandName}</div>` : ""}
        <h1 class="heading" style="${headingStyle}">${heading}</h1>
        <p class="body" style="${std.css({ opacity: bodyOpacity })}">${body}</p>
      </div>
    </div>
    ${showProgress ? `
      <div class="progress-bar">
        <div class="progress-fill" style="${std.css({ width: sceneProgress * 100 + "%" })}"></div>
      </div>
    ` : ""}
  `;
  },
});
