import { defineScene } from "superimg";

export default defineScene({
  data: {
    symbol: "AAPL",
    companyName: "Apple Inc.",
    price: 230.50,
    change: 2.50,
    changePercent: 1.09,
    high: 231.50,
    low: 229.20,
    sparkline: [228, 229.5, 230, 229.8, 230.5],
    upColor: "#10b981",
    downColor: "#ef4444",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
    fonts: ["JetBrains+Mono:wght@400;600", "Inter:wght@400;600"],
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f172a; font-family: 'Inter', sans-serif; overflow: hidden; }
      .card {
        width: 480px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        text-align: left;
        padding: 48px;
      }
      .symbol {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
        font-size: 32px;
        letter-spacing: 2px;
        margin-bottom: 4px;
      }
      .company {
        font-size: 18px;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 24px;
      }
      .price {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
        font-size: 72px;
        font-variant-numeric: tabular-nums;
        margin-bottom: 8px;
      }
      .change-row {
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 24px;
        margin-bottom: 32px;
      }
      .arrow { font-size: 20px; }
      .sparkline-container {
        margin-bottom: 24px;
      }
      .high-low {
        font-family: 'JetBrains Mono', monospace;
        font-size: 18px;
        color: rgba(255, 255, 255, 0.6);
        display: flex;
        gap: 24px;
      }
    `],
  },

  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const {
      symbol, companyName, price, change, changePercent,
      high, low, sparkline, upColor, downColor
    } = data;

    // score: enter (0.6s) -> hold (2.2s) -> exit (1.2s)
    const t = std.score({ enter: 0.15, hold: 0.55, exit: 0.3 });

    // === MOTIONS ===
    const identityAnim = t.motion({
      during: "enter", at: 0.08/0.6, duration: 0.5/0.6, easing: "easeOutQuart",
      exit: { during: "exit", at: 0.3/1.2, duration: 0.4/1.2, easing: "easeInQuad" }
    });

    const heroAnim = t.motion({
      during: "enter", at: 0.28/0.6, duration: 0.5/0.6, easing: "easeOutBack",
      exit: { during: "exit", at: 0.2/1.2, duration: 0.4/1.2, easing: "easeInBack" }
    });

    const chartAnim = t.motion({
      during: "enter", at: 0.50/0.6, duration: 0.5/0.6,
      exit: { during: "exit", at: 0.1/1.2, duration: 0.4/1.2 }
    });

    const detailAnim = t.motion({
      during: "enter", at: 1.00/0.6, duration: 0.4/0.6,
      exit: { during: "exit", at: 0, duration: 0.4/1.2 }
    });

    // Determine up/down state
    const isUp = change >= 0;
    const accentColor = isUp ? upColor : downColor;
    const arrow = isUp ? "\u25B2" : "\u25BC";
    const sign = isUp ? "+" : "";

    // === PRICE PULSE ANIMATION ===
    // Subtle pulse after hero appears (0.35s - 0.65s)
    const pulseProgress = std.clamp01((time - 0.35) / 0.3);
    const pulse = Math.sin(pulseProgress * Math.PI) * 0.02;
    const priceScale = heroAnim.scale + pulse;

    // === SPARKLINE ===
    const sparklineSvg = generateSparkline(sparkline, chartAnim.opacity, accentColor);

    // === STYLES ===
    const bodyStyle = std.css({ width, height }, std.css.center());

    return `
      <div style="${bodyStyle}">
        <div class="card">
          <div class="symbol" style="${std.css({ color: accentColor })}; ${identityAnim.style}">${symbol}</div>
          <div class="company" style="${identityAnim.style}">${companyName}</div>
          <div class="price" style="${std.css({ color: "#ffffff", transform: `scale(${priceScale})` })}; ${heroAnim.style}">$${price.toFixed(2)}</div>
          <div class="change-row" style="${std.css({ color: accentColor })}; ${heroAnim.style}">
            <span>${sign}$${Math.abs(change).toFixed(2)}</span>
            <span>(${sign}${changePercent.toFixed(2)}%)</span>
            <span class="arrow">${arrow}</span>
          </div>
          <div class="sparkline-container" style="${chartAnim.style}">
            ${sparklineSvg}
          </div>
          <div class="high-low" style="${detailAnim.style}">
            <span>H: $${high.toFixed(2)}</span>
            <span>L: $${low.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  },
});

function generateSparkline(
  points: number[],
  progress: number,
  color: string
): string {
  const width = 200;
  const height = 50;
  const padding = 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: padding + (1 - (p - min) / range) * (height - padding * 2)
  }));

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  // Path length approximation for stroke-dashoffset animation
  const pathLength = width * 1.5;

  // Draw-in animation: line reveals left to right
  const strokeOffset = pathLength * (1 - progress);

  // Fill fades in during last 40% of animation
  const fillOpacity = Math.max(0, (progress - 0.6) / 0.4);

  // End dot appears in last 10%
  const dotProgress = Math.max(0, (progress - 0.9) / 0.1);
  const lastCoord = coords[coords.length - 1];

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="${0.3 * fillOpacity}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="sparkClip">
          <rect x="0" y="0" width="${width * progress}" height="${height}"/>
        </clipPath>
      </defs>

      <!-- Gradient fill - clipped to match line progress -->
      <path
        d="${areaPath}"
        fill="url(#sparkGradient)"
        clip-path="url(#sparkClip)"
        opacity="${fillOpacity}"
      />

      <!-- Animated line using stroke-dashoffset -->
      <path
        d="${linePath}"
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="${pathLength}"
        stroke-dashoffset="${strokeOffset}"
      />

      <!-- End point dot -->
      ${dotProgress > 0 ? `
        <circle
          cx="${lastCoord.x}"
          cy="${lastCoord.y}"
          r="${3 * dotProgress}"
          fill="${color}"
        />
      ` : ""}
    </svg>
  `;
}
