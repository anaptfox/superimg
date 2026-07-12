import { define } from "superimg";

export default define({
  sample: {
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
    duration: "4s",
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
    const { std, timeline, width, height, data } = ctx;
    const {
      symbol, companyName, price, change, changePercent,
      high, low, sparkline, upColor, downColor
    } = data;

    // director phases: enter (0.6s) → hold (2.2s) → exit (1.2s)
    const t = ctx.director({ enter: "0.6s", hold: "2.2s", exit: "1.2s" });

    // === MOTIONS ===
    const identityAnim = t.motion({
      during: "enter", at: "0.08s", for: "0.5s", easing: "easeOutQuart",
      exit: { during: "exit", at: "0.3s", for: "0.4s", easing: "easeInQuad" }
    });

    const heroAnim = t.motion({
      during: "enter", at: "0.28s", for: "0.5s", easing: "easeOutBack",
      exit: { during: "exit", at: "0.2s", for: "0.4s", easing: "easeInBack" }
    });

    const chartAnim = t.motion({
      during: "enter", at: "0.5s", for: "0.5s",
      exit: { during: "exit", at: "0.1s", for: "0.4s" }
    });

    const detailAnim = t.motion({
      during: "enter", at: "1.0s", for: "0.4s",
      exit: { during: "exit", at: "0%", for: "0.4s" }
    });

    // Determine up/down state
    const isUp = change >= 0;
    const accentColor = isUp ? upColor : downColor;
    const arrow = isUp ? "\u25B2" : "\u25BC";
    const sign = isUp ? "+" : "";

    // === PRICE PULSE ANIMATION ===
    // Subtle pulse after hero appears (0.35s - 0.65s)
    const pulseProgress = std.clamp01((timeline.seconds - 0.35) / 0.3);
    const pulse = Math.sin(pulseProgress * Math.PI) * 0.02;
    const priceScale = heroAnim.scale + pulse;

    // === SPARKLINE ===
    const sparkPaths = std.viz.charts.sparkline(
      { x: 0, y: 0, width: 200, height: 50 },
      sparkline,
      {
        color: accentColor,
        progress: chartAnim.opacity,
        animate: "draw",
        fill: true,
        showDot: true,
      },
    );
    const sparklineSvg = `<svg width="200" height="50" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">${sparkPaths}</svg>`;

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
