import { clamp } from "./math.js";
import type { BubblePlacement, PlaceBubbleOptions, Rect } from "./types.js";

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function verticalOverflow(y: number, height: number, safeBox: Rect): number {
  const topOver = Math.max(0, safeBox.y - y);
  const bottomOver = Math.max(0, y + height - (safeBox.y + safeBox.height));
  return topOver + bottomOver;
}

/**
 * Pure speech-bubble placement helper that respects safe-area bounds, flips
 * below the speaker's head when placing above would clip the top safe margin,
 * and avoids colliding with already-placed bubbles on the same frame.
 */
export function placeBubble(options: PlaceBubbleOptions): BubblePlacement {
  const {
    head,
    size,
    safeBox,
    gap = 12,
    tailHeight = 14,
    tailMargin = 18,
    occupied = [],
    prefer = "above",
  } = options;

  const maxX = Math.max(safeBox.x, safeBox.x + safeBox.width - size.width);
  const x = clamp(head.x - size.width / 2, safeBox.x, maxX);

  const aboveY = head.y - gap - tailHeight - size.height;
  const belowY = head.y + gap + tailHeight;

  const aboveOverflow = verticalOverflow(aboveY, size.height, safeBox);
  const belowOverflow = verticalOverflow(belowY, size.height, safeBox);

  let tailSide: "bottom" | "top";
  let y: number;

  if (prefer === "below") {
    if (belowOverflow > 0 && aboveOverflow < belowOverflow) {
      tailSide = "bottom";
      y = aboveY;
    } else {
      tailSide = "top";
      y = belowY;
    }
  } else {
    if (aboveOverflow > 0 && belowOverflow < aboveOverflow) {
      tailSide = "top";
      y = belowY;
    } else {
      tailSide = "bottom";
      y = aboveY;
    }
  }

  const maxY = Math.max(safeBox.y, safeBox.y + safeBox.height - size.height);
  y = clamp(y, safeBox.y, maxY);

  // Dodge any already-placed bubbles on this frame.
  if (occupied.length > 0) {
    const pad = Math.max(4, gap / 2);
    const fitsAt = (candY: number) => {
      const box: Rect = { x, y: candY, width: size.width, height: size.height };
      return !occupied.some((other) => overlaps(box, other));
    };

    if (!fitsAt(y)) {
      let resolved = false;
      // First try nudging away from head along the current side.
      let candY = y;
      for (let i = 0; i < occupied.length; i++) {
        const hit = occupied.find((other) =>
          overlaps({ x, y: candY, width: size.width, height: size.height }, other),
        );
        if (!hit) break;
        candY = tailSide === "bottom"
          ? hit.y - size.height - pad
          : hit.y + hit.height + pad;
      }
      if (candY >= safeBox.y && candY <= maxY && fitsAt(candY)) {
        y = candY;
        resolved = true;
      }

      // If nudging clipped out of safeBox, try the opposite side of the head.
      if (!resolved) {
        const altSide: "bottom" | "top" = tailSide === "bottom" ? "top" : "bottom";
        let altY = clamp(altSide === "bottom" ? aboveY : belowY, safeBox.y, maxY);
        for (let i = 0; i < occupied.length; i++) {
          const hit = occupied.find((other) =>
            overlaps({ x, y: altY, width: size.width, height: size.height }, other),
          );
          if (!hit) break;
          altY = altSide === "bottom"
            ? hit.y - size.height - pad
            : hit.y + hit.height + pad;
        }
        if (altY >= safeBox.y && altY <= maxY && fitsAt(altY)) {
          y = altY;
          tailSide = altSide;
        } else {
          // Best-effort clamp inside safeBox even when crowded.
          y = clamp(candY, safeBox.y, maxY);
        }
      }
    }
  }

  const effectiveMargin = Math.min(tailMargin, size.width / 2);
  const tailX = clamp(head.x, x + effectiveMargin, x + size.width - effectiveMargin);

  return {
    x,
    y,
    tailX,
    tailSide,
    box: { x, y, width: size.width, height: size.height },
  };
}
