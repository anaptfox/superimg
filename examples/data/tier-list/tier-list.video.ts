import { defineScene, type RenderContext } from "superimg";

export type Tier = "S" | "A" | "B" | "C" | "D" | "F";
export type TierTheme = "dark" | "light" | "neon";

export interface TierItem {
  id: string;
  name: string;
  tier: Tier;
}

export interface TierListVideoData extends Record<string, unknown> {
  title: string;
  items: TierItem[];
  theme: TierTheme;
  showTierLabels: boolean;
}

const DEFAULT_TIER_COLORS: Record<Tier, string> = {
  S: "#ff7f7f",
  A: "#ffbf7f",
  B: "#ffff7f",
  C: "#7fff7f",
  D: "#7fbfff",
  F: "#bf7fbf",
};

const TIERS: Tier[] = ["S", "A", "B", "C", "D", "F"];

export default defineScene<TierListVideoData>({
  data: {
    title: "Programming Languages Tier List",
    items: [
      { id: "1", name: "TypeScript", tier: "S" as Tier },
      { id: "2", name: "Rust", tier: "S" as Tier },
      { id: "3", name: "Python", tier: "A" as Tier },
      { id: "4", name: "Go", tier: "A" as Tier },
      { id: "5", name: "JavaScript", tier: "B" as Tier },
      { id: "6", name: "Java", tier: "C" as Tier },
      { id: "7", name: "PHP", tier: "D" as Tier },
      { id: "8", name: "COBOL", tier: "F" as Tier },
    ],
    theme: "dark",
    showTierLabels: true,
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 7,
  },
  render(ctx: RenderContext<TierListVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const { title, items, theme = "dark", showTierLabels = true } = data;

    const bgColor = theme === "dark" ? "#0a0a0a" : theme === "neon" ? "#0a0014" : "#fafafa";
    const textColor = theme === "dark" || theme === "neon" ? "#ffffff" : "#0a0a0a";
    const rowBgColor = theme === "dark" ? "#18181b" : theme === "neon" ? "#1a0a24" : "#f4f4f5";

    const TIMING = {
      titleSlam: { start: 0, end: 0.08 },
      tiersAppear: { start: 0.08, end: 0.18 },
      itemsReveal: { start: 0.2, end: 0.82 },
      sTierGlow: { start: 0.84, end: 0.92 },
      fadeOut: { start: 0.94, end: 1.0 },
    };

    function getItemAnimation(
      index: number,
      totalItems: number,
      progress: number
    ): { scale: number; opacity: number; translateY: number; isVisible: boolean } {
      const itemDuration = 0.15;
      const staggerDelay = index / (totalItems + 2);
      const itemStart =
        TIMING.itemsReveal.start +
        staggerDelay * (TIMING.itemsReveal.end - TIMING.itemsReveal.start);
      const itemEnd = Math.min(itemStart + itemDuration, TIMING.itemsReveal.end);

      const rawProgress = std.interpolate(progress, [itemStart, itemEnd], [0, 1]);
      const animProgress = std.interpolate(rawProgress, [0, 1], [0, 1], "easeOutBack");

      return {
        scale: 0.3 + animProgress * 0.7,
        opacity: rawProgress,
        translateY: (1 - animProgress) * 30,
        isVisible: rawProgress > 0,
      };
    }

    const titleProgress = std.interpolate(sceneProgress, [TIMING.titleSlam.start, TIMING.titleSlam.end], [0, 1], "easeOutElastic");
    const tiersProgress = std.interpolate(sceneProgress, [TIMING.tiersAppear.start, TIMING.tiersAppear.end], [0, 1], "easeOutCubic");
    const sGlowProgress = std.interpolate(sceneProgress, [TIMING.sTierGlow.start, TIMING.sTierGlow.end], [0, 1]);
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;
    const baseFontSize = Math.min(width, height) * 0.035;
    const headerHeight = height * 0.12;
    const tierLabelWidth = showTierLabels ? width * 0.12 : 0;
    const contentPadding = width * 0.03;

    const availableHeight = height - headerHeight - contentPadding * 2;
    const tierRowHeight = availableHeight / 6;
    const tierRowGap = 2;

    const itemsByTier: Record<Tier, { item: TierItem; globalIndex: number }[]> = {
      S: [], A: [], B: [], C: [], D: [], F: [],
    };
    items.forEach((item: TierItem, idx: number) => {
      itemsByTier[item.tier].push({ item, globalIndex: idx });
    });

    const itemWidth = Math.min(
      tierRowHeight * 0.8,
      (width - tierLabelWidth - contentPadding * 3) / 8
    );
    const itemHeight = tierRowHeight * 0.75;

    const tierRowsHtml = TIERS.map((tier, tierIdx) => {
      const tierColor = DEFAULT_TIER_COLORS[tier];
      const rowY = headerHeight + contentPadding + tierIdx * (tierRowHeight + tierRowGap);
      const tierItems = itemsByTier[tier];

      const isSTier = tier === "S";
      const glowIntensity = isSTier && sGlowProgress > 0 ? Math.sin(sGlowProgress * Math.PI) : 0;
      const rowGlow = isSTier ? `0 0 ${30 * glowIntensity}px ${tierColor}80` : "none";

      const itemsHtml = tierItems
        .map(({ item, globalIndex }, itemIdx) => {
          const anim = getItemAnimation(globalIndex, items.length, sceneProgress);
          if (!anim.isVisible) return "";

          const itemX = tierLabelWidth + contentPadding + itemIdx * (itemWidth + 4);

          return `
        <div style="
          position:absolute;
          left:${itemX}px;
          top:50%;
          transform:translateY(-50%) translateY(${anim.translateY}px) scale(${anim.scale});
          opacity:${anim.opacity};
          width:${itemWidth}px;
          height:${itemHeight}px;
          background:${tierColor};
          border-radius:${baseFontSize * 0.3}px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:${baseFontSize * 0.3}px;
          box-shadow:${isSTier && sGlowProgress > 0 ? `0 0 ${15 * glowIntensity}px ${tierColor}` : "0 2px 8px rgba(0,0,0,0.2)"};
        ">
          <span style="
            font-size:${baseFontSize * 0.75}px;
            font-weight:700;
            color:#000;
            text-align:center;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            width:100%;
          ">${item.name}</span>
        </div>
      `;
        })
        .join("");

      return `
      <div style="
        position:absolute;
        left:${contentPadding}px;
        right:${contentPadding}px;
        top:${rowY}px;
        height:${tierRowHeight}px;
        display:flex;
        align-items:stretch;
        opacity:${tiersProgress};
        box-shadow:${rowGlow};
      ">
        ${showTierLabels ? `
          <div style="
            width:${tierLabelWidth}px;
            background:${tierColor};
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:${baseFontSize * 1.5}px;
            font-weight:900;
            color:#000;
            border-radius:${baseFontSize * 0.2}px 0 0 ${baseFontSize * 0.2}px;
          ">${tier}</div>
        ` : ""}

        <div style="
          flex:1;
          background:${rowBgColor};
          position:relative;
          border-radius:${showTierLabels ? `0 ${baseFontSize * 0.2}px ${baseFontSize * 0.2}px 0` : `${baseFontSize * 0.2}px`};
          min-height:${tierRowHeight}px;
        ">
          ${itemsHtml}
        </div>
      </div>
    `;
    }).join("");

    const neonBg = theme === "neon" ? `
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%, #ff00ff15 0%, transparent 40%);pointer-events:none;"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 70% 80%, #00ffff10 0%, transparent 40%);pointer-events:none;"></div>
  ` : "";

    return `
    <div style="width:${width}px;height:${height}px;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;opacity:${globalOpacity};">

      ${neonBg}

      <div style="
        position:absolute;
        top:0;
        left:0;
        right:0;
        height:${headerHeight}px;
        display:flex;
        align-items:center;
        justify-content:center;
        transform:scale(${titleProgress}) translateY(${(1 - titleProgress) * -20}px);
        opacity:${titleProgress > 0.5 ? 1 : titleProgress * 2};
      ">
        <h1 style="
          font-size:${baseFontSize * 1.8}px;
          font-weight:900;
          color:${textColor};
          text-align:center;
          margin:0;
          letter-spacing:-0.02em;
          text-transform:uppercase;
        ">${title}</h1>
      </div>

      ${tierRowsHtml}

    </div>
  `;
  },
});
