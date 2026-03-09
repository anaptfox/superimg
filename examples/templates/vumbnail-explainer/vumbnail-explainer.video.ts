// Vumbnail.com Explainer Video Template
// Showcases the video thumbnail service with animated URL demos
import { defineScene } from "superimg";

export default defineScene({
  defaults: {
    brandColor: "#6366f1",
    accentColor: "#22d3ee",
    videoId: "148751763",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: 12,
    fonts: ["Inter:wght@400;600;700", "JetBrains+Mono:wght@400;600"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
        font-family: 'Inter', sans-serif;
        overflow: hidden;
      }
      .code {
        font-family: 'JetBrains Mono', monospace;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 24px 32px;
      }
      .url-part { display: inline; }
      .thumbnail-grid { display: flex; gap: 24px; align-items: flex-end; }
      .thumbnail {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
        font-size: 14px;
      }
      .platform-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 24px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
    `],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { brandColor, accentColor, videoId } = data;

    // Scene phases: Intro (0-3s) | URL Demo (3-7s) | Sizes (7-10s) | Platforms (10-12s)
    const phase1 = std.math.clamp(time / 3, 0, 1);
    const phase2 = std.math.clamp((time - 3) / 4, 0, 1);
    const phase3 = std.math.clamp((time - 7) / 3, 0, 1);
    const phase4 = std.math.clamp((time - 10) / 2, 0, 1);

    // Phase transitions
    const fadeOut1 = std.math.clamp((time - 2.5) / 0.5, 0, 1);
    const fadeOut2 = std.math.clamp((time - 6.5) / 0.5, 0, 1);
    const fadeOut3 = std.math.clamp((time - 9.5) / 0.5, 0, 1);

    const bodyStyle = std.css({ width, height }) + ";" + std.css.center();

    // ========== PHASE 1: Logo & Tagline (0-3s) ==========
    const logoEnter = std.tween(0, 1, std.math.clamp(time / 0.8, 0, 1), "easeOutCubic");
    const logoY = std.tween(40, 0, std.math.clamp(time / 0.8, 0, 1), "easeOutCubic");
    const taglineEnter = std.tween(0, 1, std.math.clamp((time - 0.4) / 0.8, 0, 1), "easeOutCubic");
    const taglineY = std.tween(30, 0, std.math.clamp((time - 0.4) / 0.8, 0, 1), "easeOutCubic");
    const phase1Opacity = (1 - fadeOut1);

    const logoStyle = std.css({
      fontSize: 72,
      fontWeight: 700,
      color: "#ffffff",
      opacity: logoEnter * phase1Opacity,
      transform: `translateY(${logoY}px)`,
      marginBottom: 16,
    });

    const taglineStyle = std.css({
      fontSize: 28,
      color: std.color.alpha("#ffffff", 0.7),
      opacity: taglineEnter * phase1Opacity,
      transform: `translateY(${taglineY}px)`,
    });

    // ========== PHASE 2: URL Demo (3-7s) ==========
    const urlEnter = std.tween(0, 1, std.math.clamp((time - 3) / 0.6, 0, 1), "easeOutCubic");
    const urlY = std.tween(30, 0, std.math.clamp((time - 3) / 0.6, 0, 1), "easeOutCubic");

    // Typewriter effect for video ID
    const typeProgress = std.math.clamp((time - 3.8) / 1.2, 0, 1);
    const charsToShow = Math.floor(typeProgress * videoId.length);
    const typedId = videoId.slice(0, charsToShow);
    const cursor = typeProgress < 1 && time % 0.6 < 0.3 ? "|" : "";

    const jpgEnter = std.tween(0, 1, std.math.clamp((time - 5.2) / 0.4, 0, 1), "easeOutBack");
    const phase2Opacity = phase2 * (1 - fadeOut2);

    const urlContainerStyle = std.css({
      opacity: urlEnter * phase2Opacity,
      transform: `translateY(${urlY}px)`,
    });

    const domainStyle = std.css({ color: std.color.alpha("#ffffff", 0.6), fontSize: 32 });
    const idStyle = std.css({ color: accentColor, fontSize: 32 });
    const extStyle = std.css({
      color: brandColor,
      fontSize: 32,
      opacity: jpgEnter,
      transform: `scale(${std.tween(0.5, 1, jpgEnter, "easeOutBack")})`,
      display: "inline-block",
    });

    const labelStyle = std.css({
      fontSize: 20,
      color: std.color.alpha("#ffffff", 0.5),
      marginBottom: 16,
      opacity: urlEnter * phase2Opacity,
    });

    // ========== PHASE 3: Thumbnail Sizes (7-10s) ==========
    const sizesEnter = std.tween(0, 1, std.math.clamp((time - 7) / 0.6, 0, 1), "easeOutCubic");
    const phase3Opacity = phase3 * (1 - fadeOut3);

    const smallEnter = std.tween(0, 1, std.math.clamp((time - 7.3) / 0.5, 0, 1), "easeOutBack");
    const medEnter = std.tween(0, 1, std.math.clamp((time - 7.5) / 0.5, 0, 1), "easeOutBack");
    const largeEnter = std.tween(0, 1, std.math.clamp((time - 7.7) / 0.5, 0, 1), "easeOutBack");

    const sizeLabelStyle = std.css({
      fontSize: 20,
      color: std.color.alpha("#ffffff", 0.5),
      marginBottom: 24,
      opacity: sizesEnter * phase3Opacity,
    });

    const gridStyle = std.css({ opacity: phase3Opacity });

    const smallStyle = std.css({
      width: 100, height: 56,
      opacity: smallEnter,
      transform: `scale(${std.tween(0.5, 1, smallEnter, "easeOutBack")})`,
      borderColor: std.color.alpha(accentColor, 0.5),
    });
    const medStyle = std.css({
      width: 200, height: 112,
      opacity: medEnter,
      transform: `scale(${std.tween(0.5, 1, medEnter, "easeOutBack")})`,
      borderColor: std.color.alpha(accentColor, 0.5),
    });
    const largeStyle = std.css({
      width: 320, height: 180,
      opacity: largeEnter,
      transform: `scale(${std.tween(0.5, 1, largeEnter, "easeOutBack")})`,
      borderColor: std.color.alpha(brandColor, 0.5),
    });

    // ========== PHASE 4: Platform Support (10-12s) ==========
    const platformEnter = std.tween(0, 1, std.math.clamp((time - 10) / 0.6, 0, 1), "easeOutCubic");
    const ytEnter = std.tween(0, 1, std.math.clamp((time - 10.3) / 0.5, 0, 1), "easeOutBack");
    const vimeoEnter = std.tween(0, 1, std.math.clamp((time - 10.6) / 0.5, 0, 1), "easeOutBack");
    const phase4Opacity = phase4;

    const platformLabelStyle = std.css({
      fontSize: 20,
      color: std.color.alpha("#ffffff", 0.5),
      marginBottom: 24,
      opacity: platformEnter * phase4Opacity,
    });

    const platformsStyle = std.css({
      display: "flex",
      gap: 24,
      opacity: phase4Opacity,
    });

    const ytStyle = std.css({
      opacity: ytEnter,
      transform: `translateY(${std.tween(20, 0, ytEnter, "easeOutBack")}px)`,
      borderColor: std.color.alpha("#ff0000", 0.3),
    });
    const vimeoStyle = std.css({
      opacity: vimeoEnter,
      transform: `translateY(${std.tween(20, 0, vimeoEnter, "easeOutBack")}px)`,
      borderColor: std.color.alpha("#1ab7ea", 0.3),
    });

    return `
      <div style="${bodyStyle}">
        <!-- Phase 1: Logo -->
        <div style="${std.css.stack()};${std.css({ position: "absolute", textAlign: "center" })}">
          ${phase1Opacity > 0.01 ? `
            <div style="${logoStyle}">vumbnail</div>
            <div style="${taglineStyle}">Video thumbnails via simple URLs</div>
          ` : ""}
        </div>

        <!-- Phase 2: URL Demo -->
        ${phase2Opacity > 0.01 ? `
          <div style="${std.css.stack()};${std.css({ position: "absolute", textAlign: "center" })}">
            <div style="${labelStyle}">Simple URL Structure</div>
            <div class="code" style="${urlContainerStyle}">
              <span style="${domainStyle}">vumbnail.com/</span><span style="${idStyle}">${typedId}${cursor}</span><span style="${extStyle}">.jpg</span>
            </div>
          </div>
        ` : ""}

        <!-- Phase 3: Sizes -->
        ${phase3Opacity > 0.01 ? `
          <div style="${std.css.stack()};${std.css({ position: "absolute", alignItems: "center" })}">
            <div style="${sizeLabelStyle}">Multiple Sizes Available</div>
            <div class="thumbnail-grid" style="${gridStyle}">
              <div style="${std.css.stack()};${std.css({ alignItems: "center", gap: 8 })}">
                <div class="thumbnail" style="${smallStyle}">100w</div>
                <span style="${std.css({ fontSize: 12, color: std.color.alpha("#fff", 0.4 * smallEnter) })}">_small.jpg</span>
              </div>
              <div style="${std.css.stack()};${std.css({ alignItems: "center", gap: 8 })}">
                <div class="thumbnail" style="${medStyle}">200w</div>
                <span style="${std.css({ fontSize: 12, color: std.color.alpha("#fff", 0.4 * medEnter) })}">_medium.jpg</span>
              </div>
              <div style="${std.css.stack()};${std.css({ alignItems: "center", gap: 8 })}">
                <div class="thumbnail" style="${largeStyle}">640w</div>
                <span style="${std.css({ fontSize: 12, color: std.color.alpha("#fff", 0.4 * largeEnter) })}">_large.jpg</span>
              </div>
            </div>
          </div>
        ` : ""}

        <!-- Phase 4: Platforms -->
        ${phase4Opacity > 0.01 ? `
          <div style="${std.css.stack()};${std.css({ position: "absolute", alignItems: "center" })}">
            <div style="${platformLabelStyle}">Works with Both Platforms</div>
            <div style="${platformsStyle}">
              <div class="platform-badge" style="${ytStyle}">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#ff0000"><path d="M23.5 6.2c-.3-1-1-1.8-2-2C19.8 3.7 12 3.7 12 3.7s-7.8 0-9.5.5c-1 .2-1.7 1-2 2C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2 1.7.5 9.5.5 9.5.5s7.8 0 9.5-.5c1-.2 1.7-1 2-2 .5-1.8.5-5.8.5-5.8s0-4-.5-5.8zM9.5 15.5v-7l6.4 3.5-6.4 3.5z"/></svg>
                <span style="${std.css({ color: "#fff", fontSize: 18, fontWeight: 600 })}">YouTube</span>
              </div>
              <div class="platform-badge" style="${vimeoStyle}">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#1ab7ea"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/></svg>
                <span style="${std.css({ color: "#fff", fontSize: 18, fontWeight: 600 })}">Vimeo</span>
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  },
});
