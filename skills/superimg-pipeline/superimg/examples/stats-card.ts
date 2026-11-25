// Advanced template demonstrating director + motion, staggered entrance, and responsive sizing
import { define, Frame, Stack, Text, googleFont } from "@foxworth/superimg";

export default define({
  sample: {
    label: "Conversion Rate",
    value: 94,
    unit: "%",
    target: 100,
    accentColor: "#10b981",
    secondaryColor: "#6ee7b7",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
    fonts: [googleFont("JetBrains+Mono:wght@400;600"), googleFont("Inter:wght@400;600")],
    inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; } body { overflow: hidden; }"],
  },

  render(ctx) {
    const { std, width, height, data } = ctx;
    const { label, value, unit, target, accentColor, secondaryColor } = data;

    // Responsive sizing — bind ctx once, use for all values
    const r = std.createResponsive(ctx);
    const valueSize = r({ portrait: 72, default: 96 });
    const labelSize = r({ portrait: 18, default: 24 });
    const barHeight = r({ portrait: 8, default: 12 });
    const barMaxWidth = r({ portrait: 280, default: 400 });
    const cardPadding = r({ portrait: 32, default: 48 });

    // Phase timing — 4s scene: enter 1.2s / hold 1.8s / exit 1.0s
    const t = ctx.director({ enter: "1.2s", hold: "1.8s", exit: "1.0s" });

    // Card fades in first, elements stagger behind it
    const cardAnim  = t.motion({ y: 20 });
    const labelAnim = t.motion({ at: "0s",  y: 10 });
    const valueAnim = t.motion({ at: "15%", y: 15, scale: 0.8, easing: "easeOutBack" });
    const barAnim   = t.motion({ at: "30%",  y: 10 });

    // Animated counter — phase-scoped tween that runs during the hold phase
    const displayValue = Math.floor(t.tween(0, value, { during: "hold", easing: "easeOutCubic" }));

    // Progress bar fill — clamped ratio, faded by barAnim's opacity
    const barFill = std.clamp01(value / target) * barAnim.opacity;

    // Colors
    const barGradient = std.color.mix(accentColor, secondaryColor, 0.3);
    const barBg = std.color.alpha("#ffffff", 0.1);

    return Frame(
      { width, height, fill: "#0f172a" },
      Stack(
        { width: "fill", height: "fill", align: "center", justify: "center" },
        Frame(
          {
            radius: 16,
            pad: cardPadding,
            fill: "rgba(255,255,255,0.03)",
            motion: cardAnim,
            style: { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" },
          },
          Stack(
            { gap: 20 },
            Text(
              {
                variant: "label",
                size: labelSize,
                weight: 600,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: 2,
                motion: labelAnim,
              },
              label.toUpperCase(),
            ),
            Stack(
              { direction: "row", align: "end", gap: 8 },
              Text(
                {
                  variant: "display",
                  size: valueSize,
                  weight: 600,
                  color: accentColor,
                  fontFamily: "'JetBrains Mono', monospace",
                  motion: valueAnim,
                },
                displayValue,
              ),
              Text(
                {
                  variant: "title",
                  size: valueSize * 0.4,
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "'JetBrains Mono', monospace",
                  motion: valueAnim,
                },
                unit,
              ),
            ),
            Frame(
              {
                width: barMaxWidth,
                height: barHeight,
                radius: barHeight / 2,
                fill: barBg,
                overflow: "hidden",
                motion: barAnim,
              },
              Frame({
                width: barMaxWidth * barFill,
                height: barHeight,
                radius: barHeight / 2,
                fill: `linear-gradient(90deg, ${accentColor}, ${barGradient})`,
              }),
            ),
          ),
        ),
      ),
    );
  },
});
