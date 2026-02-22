// Content template with defaults
export const config = {
  fonts: ["IBM+Plex+Sans:wght@400;700"],
};

export const defaults = {
  heading: "Main Content",
  body: "This demonstrates the asset API.",
  showProgress: true,
  textColor: "#ffffff",
};

export function render(ctx) {
  const { std, sceneProgress, data, shared } = ctx;
  const { heading, body, showProgress, textColor } = data;

  // Animate text reveal
  const headingOpacity = std.math.clamp(sceneProgress * 3, 0, 1);
  const bodyOpacity = std.math.clamp((sceneProgress - 0.2) * 2, 0, 1);

  // Subtle parallax effect on heading
  const headingY = std.math.lerp(20, 0, std.easing.easeOutCubic(headingOpacity));

  // Access shared data if available (e.g., brand name)
  const brandName = shared?.brandName;

  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'IBM Plex Sans', system-ui, sans-serif;
        color: ${textColor};
        overflow: hidden;
      }
      .container {
        max-width: 80%;
        text-align: center;
      }
      .brand {
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 4px;
        opacity: 0.6;
        margin-bottom: 32px;
      }
      .heading {
        font-size: 72px;
        font-weight: 700;
        margin-bottom: 32px;
        opacity: ${headingOpacity};
        transform: translateY(${headingY}px);
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
      }
      .body {
        font-size: 28px;
        line-height: 1.6;
        opacity: ${bodyOpacity};
        max-width: 800px;
        margin: 0 auto;
      }
      .progress-bar {
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 200px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        width: ${sceneProgress * 100}%;
        background: white;
        border-radius: 2px;
      }
    </style>
    <div class="container">
      ${brandName ? `<div class="brand">${brandName}</div>` : ""}
      <h1 class="heading">${heading}</h1>
      <p class="body">${body}</p>
    </div>
    ${showProgress ? `
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
    ` : ""}
  `;
}
