import { defineScene, type RenderContext } from "superimg";

export type ListDirection = "up" | "down";
export type NumberStyle = "circle" | "square" | "plain";

export interface ListItem {
  title: string;
  subtitle?: string;
}

export interface ListVideoData extends Record<string, unknown> {
  title: string;
  items: ListItem[];
  direction: ListDirection;
  theme: "light" | "dark";
  numberStyle: NumberStyle;
  accentColor: string;
}

export default defineScene<ListVideoData>({
  data: {
    title: "Top 5 Reasons to Use TypeScript",
    items: [
      { title: "Type Safety", subtitle: "Catch errors at compile time" },
      { title: "Better IDE Support", subtitle: "Autocomplete and refactoring" },
      { title: "Self-Documenting Code", subtitle: "Types serve as documentation" },
      { title: "Easier Refactoring", subtitle: "Confident large-scale changes" },
      { title: "Growing Ecosystem", subtitle: "First-class library support" },
    ],
    direction: "down",
    theme: "dark",
    numberStyle: "circle",
    accentColor: "#f97316",
  },
  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 8,
  },
  render(ctx: RenderContext<ListVideoData>) {
    const { std, width, height, sceneProgress, data } = ctx;
    const {
      title,
      items,
      direction = "down",
      theme = "dark",
      numberStyle = "circle",
      accentColor = "#f97316",
    } = data;

    const orderedItems = direction === "down" ? [...items].reverse() : items;
    const itemCount = orderedItems.length;

    const bgColor = theme === "dark" ? "#0a0a0a" : "#fafafa";
    const textColor = theme === "dark" ? "#ffffff" : "#0a0a0a";
    const mutedColor = theme === "dark" ? "#a1a1aa" : "#71717a";

    const TIMING = {
      titleFadeIn: { start: 0, end: 0.1 },
      itemsReveal: { start: 0.12, end: 0.85 },
      finalHold: { start: 0.85, end: 0.92 },
      fadeOut: { start: 0.92, end: 1.0 },
    };

    function getItemAnimation(index: number, totalItems: number, progress: number) {
      const itemDuration = 0.35;
      const staggerDelay = index / totalItems;
      const itemStart =
        TIMING.itemsReveal.start +
        staggerDelay * (TIMING.itemsReveal.end - TIMING.itemsReveal.start - itemDuration);
      const itemEnd = itemStart + itemDuration;

      const rawProgress = std.interpolate(progress, [itemStart, itemEnd], [0, 1]);

      const numberProgress = std.interpolate(Math.min(1, rawProgress * 1.5), [0, 1], [0, 1], "easeOutElastic");
      const textProgress = std.interpolate(rawProgress, [0, 1], [0, 1], "easeOutCubic");

      return {
        numberScale: numberProgress,
        numberOpacity: Math.min(1, rawProgress * 2),
        textTranslateX: (1 - textProgress) * 50,
        textOpacity: textProgress,
        isVisible: rawProgress > 0,
      };
    }

    function getDisplayNumber(index: number): number {
      if (direction === "down") return itemCount - index;
      return index + 1;
    }

    const titleProgress = std.interpolate(sceneProgress, [TIMING.titleFadeIn.start, TIMING.titleFadeIn.end], [0, 1], "easeOutCubic");
    const finalHoldProgress = std.interpolate(sceneProgress, [TIMING.finalHold.start, TIMING.finalHold.end], [0, 1]);
    const fadeOutProgress = std.interpolate(sceneProgress, [TIMING.fadeOut.start, TIMING.fadeOut.end], [0, 1], "easeOutCubic");

    const globalOpacity = 1 - fadeOutProgress;

    const baseFontSize = Math.min(width, height) * 0.045;
    const titleFontSize = baseFontSize * 1.4;
    const numberSize = baseFontSize * 2.2;
    const itemPadding = baseFontSize * 0.6;
    const itemGap = baseFontSize * 0.5;

    const headerHeight = height * 0.15;
    const contentHeight = height - headerHeight - height * 0.08;
    const itemHeight = Math.min(
      (contentHeight - itemGap * (itemCount - 1)) / itemCount,
      height * 0.14
    );
    const startY =
      headerHeight + (contentHeight - (itemHeight * itemCount + itemGap * (itemCount - 1))) / 2;

    const itemsHtml = orderedItems
      .map((item: ListItem, i: number) => {
        const anim = getItemAnimation(i, itemCount, sceneProgress);
        if (!anim.isVisible) return "";

        const displayNum = getDisplayNumber(i);
        const y = startY + i * (itemHeight + itemGap);
        const numSize = numberSize * 0.9;

        let numberBadge = "";
        if (numberStyle === "circle") {
          numberBadge = `
        <div style="
          width: ${numSize}px;
          height: ${numSize}px;
          border-radius: 50%;
          background: ${accentColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${numSize * 0.5}px;
          font-weight: 800;
          color: white;
          transform: scale(${anim.numberScale});
          opacity: ${anim.numberOpacity};
          box-shadow: 0 0 20px ${accentColor}40;
        ">${displayNum}</div>
      `;
        } else if (numberStyle === "square") {
          numberBadge = `
        <div style="
          width: ${numSize}px;
          height: ${numSize}px;
          border-radius: ${numSize * 0.15}px;
          background: ${accentColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${numSize * 0.5}px;
          font-weight: 800;
          color: white;
          transform: scale(${anim.numberScale}) rotate(${(1 - anim.numberScale) * -15}deg);
          opacity: ${anim.numberOpacity};
        ">${displayNum}</div>
      `;
        } else {
          numberBadge = `
        <div style="
          font-size: ${numSize * 0.7}px;
          font-weight: 900;
          color: ${accentColor};
          transform: scale(${anim.numberScale});
          opacity: ${anim.numberOpacity};
          min-width: ${numSize}px;
          text-align: center;
        ">${displayNum}</div>
      `;
        }

        return `
      <div style="
        position: absolute;
        left: ${width * 0.06}px;
        right: ${width * 0.06}px;
        top: ${y}px;
        height: ${itemHeight}px;
        display: flex;
        align-items: center;
        gap: ${itemPadding}px;
      ">
        ${numberBadge}
        <div style="
          flex: 1;
          transform: translateX(${anim.textTranslateX}px);
          opacity: ${anim.textOpacity};
        ">
          <div style="
            font-size: ${baseFontSize * 1.1}px;
            font-weight: 700;
            color: ${textColor};
            line-height: 1.2;
            margin-bottom: 2px;
          ">${item.title}</div>
          ${item.subtitle ? `
            <div style="
              font-size: ${baseFontSize * 0.75}px;
              color: ${mutedColor};
              line-height: 1.3;
            ">${item.subtitle}</div>
          ` : ""}
        </div>
      </div>
    `;
      })
      .join("");

    const celebrationOpacity = finalHoldProgress > 0 ? Math.sin(finalHoldProgress * Math.PI) * 0.3 : 0;

    return `
    <div style="width:${width}px;height:${height}px;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;position:relative;overflow:hidden;opacity:${globalOpacity};">

      <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%, ${accentColor}10 0%, transparent 50%);pointer-events:none;"></div>

      <div style="position:absolute;inset:0;background:${accentColor};opacity:${celebrationOpacity};pointer-events:none;"></div>

      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: ${headerHeight}px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 ${width * 0.06}px;
        opacity: ${titleProgress};
        transform: translateY(${(1 - titleProgress) * -20}px);
      ">
        <h1 style="
          font-size: ${titleFontSize}px;
          font-weight: 800;
          color: ${textColor};
          text-align: center;
          line-height: 1.2;
          letter-spacing: -0.02em;
        ">${title}</h1>
      </div>

      ${itemsHtml}

    </div>
  `;
  },
});
