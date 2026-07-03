// Feature Launch — mobile app announcement spot
// Demonstrates: std.layers(), ctx.director(), std.reveal.*, SVG iPhone + in-app UI, responsive outputs

import { define } from "superimg";
import { lowerThirdOverlay } from "../../basics/layer-shots/shots";
import { buildAppScreen, buildIphoneSvg, type AppScreen } from "./device";

const PHONE_ASPECT = 390 / 844;

interface Feature {
  icon: string;
  title: string;
  desc: string;
}

const STEADY_MOTION = "opacity:1;transform:translateY(0px)";
const INTRO_WIPE_SEC = "1s";
const TEXT_SHADOW = "0 2px 16px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)";
const ACCENT_LIGHT = "#a5f3fc";
const SCRIM_LEFT = "linear-gradient(90deg, rgba(6,8,20,0.88) 0%, rgba(6,8,20,0.62) 38%, rgba(6,8,20,0.18) 62%, transparent 100%)";
const SCRIM_CENTER = "radial-gradient(ellipse 90% 80% at 50% 45%, rgba(6,8,20,0.82) 0%, rgba(6,8,20,0.48) 55%, rgba(6,8,20,0.2) 100%)";
const APP_BG = "radial-gradient(ellipse 120% 90% at 70% 20%, rgba(34,211,238,0.18) 0%, transparent 55%), radial-gradient(ellipse 80% 70% at 20% 80%, rgba(168,85,247,0.14) 0%, transparent 50%), linear-gradient(160deg, #06080f 0%, #0c1222 45%, #111827 100%)";

export default define({
  sample: {
    productName: "Pulse",
    tagline: "Habits that actually stick",
    hook: "Your goals, one tap away.",
    hookSub: "Track routines, streaks, and wins — without the guilt trip.",
    features: [
      { icon: "S", title: "Daily streaks", desc: "Momentum you can see" },
      { icon: "R", title: "Smart reminders", desc: "Nudges at the right time" },
      { icon: "I", title: "Weekly insights", desc: "Patterns at a glance" },
    ] as Feature[],
    metric: { label: "Downloads this week", value: 128, suffix: "K+" },
    cta: { text: "Download free", url: "pulse.app" },
    accentColor: "#22d3ee",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: "16s",
    fonts: ["Inter:wght@400;500;600;700;800"],
    audio: {
      id: "bed",
      src: "../../_assets/lofi-bg.mp3",
      role: "music",
      volume: 0.45,
      fadeIn: "0.5s",
      fadeOut: "2s",
      loop: true,
    },
    outputs: {
      landscape: { width: 1920, height: 1080 },
      square: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
    },
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
      .hook-line { font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1.05; text-shadow: ${TEXT_SHADOW}; }
      .hook-sub { font-weight: 500; color: rgba(255,255,255,0.9); line-height: 1.4; text-shadow: 0 1px 10px rgba(0,0,0,0.5); }
      .feature-card {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        background: rgba(8,10,22,0.78);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 16px;
        backdrop-filter: blur(14px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      }
      .feature-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        font-size: 22px;
      }
      .feature-title { font-weight: 700; color: #fff; }
      .feature-desc { font-weight: 400; color: rgba(255,255,255,0.84); margin-top: 4px; }
      .metric-label { font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.72); }
      .metric-value { font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; text-shadow: ${TEXT_SHADOW}; }
      .product-badge { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .cta-panel {
        backdrop-filter: blur(24px);
        background: rgba(8,10,24,0.82);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 28px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
      }
      .cta-kicker {
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: ${ACCENT_LIGHT};
      }
      .cta-headline { font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1.05; text-shadow: ${TEXT_SHADOW}; }
      .cta-tagline { font-weight: 500; color: rgba(255,255,255,0.88); line-height: 1.45; }
      .cta-btn { font-weight: 700; color: #fff; border-radius: 14px; display: inline-block; }
      .cta-url { font-weight: 600; color: rgba(255,255,255,0.92); font-family: 'Inter', monospace; }
      .url-pill {
        background: rgba(8,10,22,0.88);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px 18px;
        backdrop-filter: blur(10px);
      }
      .store-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 14px;
        padding: 10px 18px;
        margin-top: 20px;
      }
    `],
  },

  render(ctx) {
    const { std, width, height, data, isPortrait } = ctx;
    const {
      productName,
      tagline,
      hook,
      hookSub,
      features,
      metric,
      cta,
      accentColor,
    } = data;

    const r = std.createResponsive(ctx);
    const t = ctx.director({ hook: "3.5s", features: "7s", cta: "5.5s" });
    const L = std.layers({ width, height, mode: "opaque" });

    const brand = { productName, tagline, accentColor, accentLight: ACCENT_LIGHT };

    const featuresLocalLive = t.in("features");

    /** Size phone from frame height so it scales across outputs */
    function phoneWidth() {
      const maxH = r({
        portrait: height * 0.34,
        square: height * 0.54,
        default: height * 0.76,
      });
      return Math.round(maxH * PHONE_ASPECT);
    }

    function featureStaggerInput(featuresLocal: number) {
      return std.interpolate(featuresLocal, [0.06, 0.88], [0, 1], "linear");
    }

    function featureHighlight(featuresLocal: number) {
      return std.stagger.lead(features, featureStaggerInput(featuresLocal), { duration: "48%"});
    }

    function buildPhone(
      screen: AppScreen,
      motionStyle: string,
      opts: { highlight?: number; streak?: number } = {},
    ) {
      const screenHtml = buildAppScreen(screen, brand, features, opts);
      const svg = buildIphoneSvg(screenHtml, phoneWidth(), `clip-${screen}`);
      return `<div style="${motionStyle}">${svg}</div>`;
    }

    function phoneOverlayOpts() {
      if (isPortrait) {
        return {
          anchor: { x: "50%", y: "66%", origin: "center" as const },
          offset: { x: 0, y: 0 },
        };
      }
      return {
        anchor: { x: "73%", y: "50%", origin: "center" as const },
        offset: { x: 0, y: 0 },
      };
    }

    function textInset() {
      return isPortrait
        ? { top: "11%", left: 48, right: 48, bottom: "56%" }
        : { top: "20%", left: "7%", right: "48%", bottom: "16%" };
    }

    function buildHookContent() {
      const headlineStyle = t.motion({ during: "hook", at: "8%", for: "38%", y: 32 }).style;
      const subStyle = t.motion({ during: "hook", at: "18%", for: "36%", y: 22 }).style;

      return `
        <div style="${std.css({ textAlign: isPortrait ? "center" : "left", maxWidth: r({ portrait: "100%", default: "100%" }) })}">
          <div class="hook-line" style="${std.css({ fontSize: r({ portrait: 52, square: 40, default: 58 }) })}; ${headlineStyle}">${hook}</div>
          <div class="hook-sub" style="${std.css({ fontSize: r({ portrait: 24, square: 20, default: 26 }), marginTop: 20 })}; ${subStyle}">${hookSub}</div>
        </div>
      `;
    }

    function buildHookShot(introWipe?: ReturnType<typeof std.reveal.wipe>) {
      const phoneMotion = t.motion({ during: "hook", at: "12%", for: "48%", scale: 0.94 }).style;
      const layers = [
        L.bg(APP_BG),
        L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT),
        L.content(buildHookContent(), { safe: "broadcast", inset: textInset() }),
        L.overlay(buildPhone("splash", phoneMotion), phoneOverlayOpts()),
      ];

      if (introWipe?.active) {
        layers.push(L.fx(introWipe.html, { visible: () => introWipe.active }));
      }

      return L.render(...layers);
    }

    function buildFeaturesContent(featuresLocal: number) {
      const featureEnterP = std.stagger(features.length, featureStaggerInput(featuresLocal), {
        duration: "50%",
        easing: "easeOutCubic",
      });

      const metricCount = Math.floor(
        t.tween(0, metric.value, { during: "features", at: "48%", for: "38%", easing: "easeOutCubic" }),
      );
      const metricStyle = t.motion({ during: "features", at: "48%", for: "38%", scale: 0.92 }).style;
      const badgeStyle = t.motion({ during: "features", at: "6%", for: "32%", y: -16 }).style;

      const featureCards = features
        .map((f: Feature, i: number) => {
          const p = featureEnterP[i];
          const slideY = std.interpolate(p, [0, 1], [28, 0], "easeOutCubic");
          const opacity = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
          const cardPad = r({ portrait: "18px 20px", default: "20px 24px" });
          return `
            <div class="feature-card" style="${std.css({
              padding: cardPad,
              marginBottom: r({ portrait: 14, default: 16 }),
              opacity,
              transform: `translateY(${slideY}px)`,
            })}">
              <div class="feature-icon" style="${std.css({
                width: r({ portrait: 44, default: 48 }),
                height: r({ portrait: 44, default: 48 }),
                background: std.color.alpha(accentColor, 0.42),
                color: ACCENT_LIGHT,
                border: `1px solid ${std.color.alpha(accentColor, 0.55)}`,
              })}">${f.icon}</div>
              <div>
                <div class="feature-title" style="${std.css({ fontSize: r({ portrait: 22, default: 26 }) })}">${f.title}</div>
                <div class="feature-desc" style="${std.css({ fontSize: r({ portrait: 16, default: 18 }) })}">${f.desc}</div>
              </div>
            </div>
          `;
        })
        .join("");

      const featuresHtml = `
        <div style="${std.css({ width: "100%" })}">
          ${featureCards}
          <div style="${std.css({ marginTop: r({ portrait: 28, default: 36 }) })}; ${metricStyle}">
            <div class="metric-label" style="${std.css({ fontSize: r({ portrait: 12, default: 13 }) })}">${metric.label}</div>
            <div class="metric-value" style="${std.css({ fontSize: r({ portrait: 52, square: 44, default: 64 }), marginTop: 6 })}">
              ${metricCount}<span style="${std.css({ fontSize: r({ portrait: 28, default: 36 }), color: ACCENT_LIGHT })}">${metric.suffix}</span>
            </div>
          </div>
        </div>
      `;

      const badgeHtml = `
        <div class="product-badge" style="${std.css({
          fontSize: r({ portrait: 13, default: 14 }),
          color: "#fff",
          background: "rgba(8,10,22,0.9)",
          padding: "8px 16px",
          borderRadius: 999,
          border: `1px solid ${std.color.alpha(accentColor, 0.65)}`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
        })}; ${badgeStyle}">${productName}</div>
      `;

      return { featuresHtml, badgeHtml };
    }

    function buildFeaturesShot(featuresLocal: number) {
      const { featuresHtml, badgeHtml } = buildFeaturesContent(featuresLocal);
      const highlight = featureHighlight(featuresLocal);

      return L.render(
        L.bg(APP_BG),
        L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT),
        L.tint(std.color.alpha(accentColor, 0.05)),
        L.content(featuresHtml, { safe: "broadcast", inset: textInset() }),
        L.overlay(buildPhone("features", STEADY_MOTION, { highlight }), phoneOverlayOpts()),
        L.overlay(badgeHtml, {
          anchor: "top-left",
          offset: { x: r({ portrait: 40, default: 64 }), y: r({ portrait: 56, default: 48 }) },
          safe: true,
        }),
      );
    }

    function buildFeaturesPanel(featuresLocal: number) {
      const { featuresHtml, badgeHtml } = buildFeaturesContent(featuresLocal);

      return L.render(
        L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT),
        L.tint(std.color.alpha(accentColor, 0.05)),
        L.content(featuresHtml, { safe: "broadcast", inset: textInset() }),
        L.overlay(badgeHtml, {
          anchor: "top-left",
          offset: { x: r({ portrait: 40, default: 64 }), y: r({ portrait: 56, default: 48 }) },
          safe: true,
        }),
      );
    }

    function buildHookPanel() {
      return L.render(
        L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT),
        L.content(buildHookContent(), { safe: "broadcast", inset: textInset() }),
      );
    }

    function buildCtaContent(d: typeof t) {
      const kickerStyle = d.motion({ at: "4%", for: "40%", y: 14 }).style;
      const headlineStyle = d.motion({ at: "10%", for: "55%", y: 28 }).style;
      const tagStyle = d.motion({ at: "18%", for: "45%", y: 18 }).style;
      const btnStyle = d.motion({ at: "28%", for: "50%", scale: 0.9 }).style;

      const storeBadge = `
        <div class="store-badge" style="${btnStyle}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#fff"/>
          </svg>
          <div style="${std.css({ textAlign: "left" })}">
            <div style="${std.css({ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 })}">Download on the</div>
            <div style="${std.css({ fontSize: 16, color: "#fff", fontWeight: 700, marginTop: 1 })}">App Store</div>
          </div>
        </div>
      `;

      const ctaCenterHtml = isPortrait
        ? `
          <div style="${std.css({ textAlign: "center", width: "100%" })}">
            <div class="cta-panel" style="${std.css({
              padding: r({ portrait: "32px 28px", default: "40px 36px" }),
              maxWidth: 560,
              margin: "0 auto",
            })}">
              <div class="cta-kicker" style="${std.css({ fontSize: 11, marginBottom: 14 })}; ${kickerStyle}">Now on iOS</div>
              <div class="cta-headline" style="${std.css({ fontSize: r({ portrait: 48, default: 52 }) })}; ${headlineStyle}">${productName}</div>
              <div class="cta-tagline" style="${std.css({ fontSize: r({ portrait: 20, default: 22 }), marginTop: 12 })}; ${tagStyle}">${tagline}</div>
              <div class="cta-btn" style="${std.css({
                marginTop: 28,
                fontSize: 20,
                padding: "14px 32px",
                background: `linear-gradient(135deg, ${accentColor}, ${std.color.mix(accentColor, "#a855f7", 0.35)})`,
                boxShadow: `0 12px 40px ${std.color.alpha(accentColor, 0.4)}`,
              })}; ${btnStyle}">${cta.text}</div>
              ${storeBadge}
            </div>
          </div>
        `
        : `
          <div class="cta-panel" style="${std.css({
            textAlign: "left",
            padding: "44px 48px",
            maxWidth: 520,
          })}">
            <div class="cta-kicker" style="${std.css({ fontSize: 12, marginBottom: 18 })}; ${kickerStyle}">Now on iOS</div>
            <div class="cta-headline" style="${std.css({ fontSize: 56 })}; ${headlineStyle}">${productName}</div>
            <div class="cta-tagline" style="${std.css({ fontSize: 24, marginTop: 14, maxWidth: 400 })}; ${tagStyle}">${tagline}</div>
            <div class="cta-btn" style="${std.css({
              marginTop: 32,
              fontSize: 22,
              padding: "16px 36px",
              background: `linear-gradient(135deg, ${accentColor}, ${std.color.mix(accentColor, "#a855f7", 0.35)})`,
              boxShadow: `0 12px 40px ${std.color.alpha(accentColor, 0.4)}`,
            })}; ${btnStyle}">${cta.text}</div>
            ${storeBadge}
          </div>
        `;

      const lowerMotion = d.motion({ at: "42%", for: "45%", y: 32 });

      const ctaLowerThird = `
        <div class="url-pill" style="${std.css({ display: "flex", alignItems: "center", gap: 12 })}">
          <div style="${std.css({ width: 4, height: 28, background: accentColor, borderRadius: 2, flexShrink: 0 })}"></div>
          <div class="cta-url" style="${std.css({ fontSize: r({ portrait: 18, default: 20 }) })}">${cta.url}</div>
        </div>
      `;

      return { ctaCenterHtml, ctaLowerThird, lowerMotion };
    }

    function buildCtaShot(d: typeof t) {
      const { ctaCenterHtml, ctaLowerThird, lowerMotion } = buildCtaContent(d);
      const streak = Math.floor(
        d.tween(0, 12, { at: "20%", for: "32%", easing: "easeOutCubic" }),
      );
      const phoneMotion = d.motion({ at: "8%", for: "55%", scale: 0.94 }).style;
      const accentGlow = `radial-gradient(ellipse 80% 60% at 50% 30%, ${std.color.alpha(accentColor, 0.2)} 0%, transparent 70%)`;

      const layers = [
        L.bg(APP_BG),
        L.tint(SCRIM_CENTER),
        L.tint(accentGlow),
        L.content(ctaCenterHtml, {
          safe: "broadcast",
          inset: isPortrait
            ? undefined
            : { top: "20%", left: "8%", right: "46%", bottom: "16%" },
        }),
        lowerThirdOverlay(L, ctaLowerThird, {
          motion: lowerMotion,
          offset: { y: r({ portrait: 48, default: 72 }) },
        }),
      ];

      layers.splice(4, 0,
        L.overlay(buildPhone("home", phoneMotion, { streak }), phoneOverlayOpts()),
      );

      return L.render(...layers);
    }

    // --- Render routing ---

    if (t.inSpan("3.0s", "4.0s")) {
      const hookToFeaturesP = t.transition("3.0s", "4.0s", "easeInOutCubic");
      const handoffFeaturesLocal = std.reveal.handoffLocal(hookToFeaturesP);
      const screen: AppScreen = hookToFeaturesP < 0.55 ? "splash" : "features";
      const highlight = hookToFeaturesP < 0.55 ? 0 : featureHighlight(handoffFeaturesLocal);
      const handoff = std.reveal.split({
        from: buildHookPanel(),
        to: buildFeaturesPanel(handoffFeaturesLocal),
        progress: hookToFeaturesP,
        style: "wipe",
        accentColor,
      });

      return L.handoff({
        shared: [L.bg(APP_BG)],
        transition: handoff,
        pinned: [L.overlay(buildPhone(screen, STEADY_MOTION, { highlight }), phoneOverlayOpts())],
      });
    }

    if (t.inSpan("9.8s", "10.8s")) {
      const featuresToCtaP = t.transition("9.8s", "10.8s", "easeInOutCubic");
      const handoffDir = t.clip({ from: "9.8s", duration: "1s" }).director({ enter: "100%" });
      return std.reveal.crossfade({
        from: buildFeaturesShot(1),
        to: buildCtaShot(handoffDir),
        progress: featuresToCtaP,
      }).html;
    }

    if (t.active === "hook") {
      const introP = t.span("0s", INTRO_WIPE_SEC);
      const introWipe = std.reveal.wipe({
        progress: introP,
        direction: "diagonal",
        color: accentColor,
      });
      return buildHookShot(introWipe);
    }

    if (t.active === "features") {
      return buildFeaturesShot(featuresLocalLive);
    }

    return buildCtaShot(t.clip({ during: "cta" }).director({ enter: "100%" }));
  },
});