import type { Box } from "../../layout.js";
import type { ChartSeries } from "./shared.js";
import { chartColors } from "./shared.js";

export interface LegendOpts {
  fontSize?: number;
  swatchSize?: number;
  gap?: number;
  colors?: string[];
  fontFamily?: string;
  layout?: "vertical" | "horizontal";
}

export function legend(box: Box, series: ChartSeries[], opts: LegendOpts = {}): string {
  const fontSize = opts.fontSize ?? 16;
  const sw = opts.swatchSize ?? 14;
  const gap = opts.gap ?? 12;
  const colors = opts.colors ?? chartColors(opts);
  const fontFamily = opts.fontFamily ?? "Inter,sans-serif";
  const items: string[] = [];

  if (opts.layout === "horizontal") {
    let x = box.x;
    const y = box.y + fontSize;
    series.forEach((s, i) => {
      const color = s.color ?? colors[i % colors.length]!;
      items.push(
        `<rect x="${x}" y="${y - sw + 4}" width="${sw}" height="${sw}" rx="3" fill="${color}"/>` +
          `<text x="${x + sw + gap}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" fill="#e2e8f0">${s.id}</text>`,
      );
      const labelW = s.id.length * fontSize * 0.55 + sw + gap * 2;
      x += labelW;
    });
  } else {
    let y = box.y + fontSize;
    series.forEach((s, i) => {
      const color = s.color ?? colors[i % colors.length]!;
      items.push(
        `<rect x="${box.x}" y="${y - sw + 4}" width="${sw}" height="${sw}" rx="3" fill="${color}"/>` +
          `<text x="${box.x + sw + gap}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" fill="#e2e8f0">${s.id}</text>`,
      );
      y += fontSize + gap;
    });
  }

  return items.join("\n");
}