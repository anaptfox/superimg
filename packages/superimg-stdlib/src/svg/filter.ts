/**
 * Composable SVG filter builder.
 *
 * Returns a complete <filter> element string and CSS reference.
 *
 * @example
 * ```ts
 * const f = std.svg.filter([
 *   { type: "grain", frequency: 0.7, seed: frame },
 *   { type: "colorMatrix", preset: "cinematic" },
 * ]);
 * return `
 *   <svg style="position:absolute;width:0;height:0">${f.svg}</svg>
 *   <div style="filter: ${f.css}">content</div>
 * `;
 * ```
 */

export type FilterEffect =
  | { type: "blur"; radius: number }
  | { type: "grain"; frequency?: number; octaves?: number; seed?: number; opacity?: number }
  | { type: "colorMatrix"; preset?: "cinematic" | "sepia" | "noir" | "desaturate"; values?: number[] }
  | { type: "glow"; radius: number; color?: string; opacity?: number }
  | { type: "displace"; scale: number; frequency?: number; seed?: number };

export interface FilterResult {
  /** Deterministic filter ID */
  id: string;
  /** Complete <filter> element string */
  svg: string;
  /** CSS filter value: url(#id) */
  css: string;
}

// Preset 5x4 color matrices (last column is offset/255)
const COLOR_PRESETS: Record<string, string> = {
  cinematic:
    "1.1 0.1 -0.1 0 0.02  " +
    "-0.05 1.05 0.05 0 0  " +
    "-0.1 0.05 1.2 0 0.05  " +
    "0 0 0 1 0",
  sepia:
    "0.393 0.769 0.189 0 0  " +
    "0.349 0.686 0.168 0 0  " +
    "0.272 0.534 0.131 0 0  " +
    "0 0 0 1 0",
  noir:
    "0.5 0.5 0.5 0 -0.1  " +
    "0.5 0.5 0.5 0 -0.1  " +
    "0.5 0.5 0.5 0 -0.1  " +
    "0 0 0 1 0",
  desaturate:
    "0.2126 0.7152 0.0722 0 0  " +
    "0.2126 0.7152 0.0722 0 0  " +
    "0.2126 0.7152 0.0722 0 0  " +
    "0 0 0 1 0",
};

/** Simple djb2 hash for deterministic IDs */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return "f" + Math.abs(hash).toString(36);
}

function buildEffect(effect: FilterEffect, idx: number): string {
  const inName = idx === 0 ? "SourceGraphic" : `e${idx - 1}`;
  const outName = `e${idx}`;

  switch (effect.type) {
    case "blur":
      return `<feGaussianBlur in="${inName}" stdDeviation="${effect.radius}" result="${outName}"/>`;

    case "grain": {
      const freq = effect.frequency ?? 0.65;
      const oct = effect.octaves ?? 3;
      const seed = effect.seed ?? 0;
      const opacity = effect.opacity ?? 0.3;
      return [
        `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" result="${outName}_noise"/>`,
        `<feColorMatrix in="${outName}_noise" type="saturate" values="0" result="${outName}_gray"/>`,
        `<feBlend in="${inName}" in2="${outName}_gray" mode="multiply" result="${outName}_blend"/>`,
        `<feComponentTransfer in="${outName}_blend" result="${outName}">`,
        `  <feFuncA type="linear" slope="${opacity}" intercept="${1 - opacity}"/>`,
        `</feComponentTransfer>`,
      ].join("\n    ");
    }

    case "colorMatrix": {
      const values = effect.values
        ? effect.values.join(" ")
        : COLOR_PRESETS[effect.preset ?? "cinematic"] ?? COLOR_PRESETS.cinematic;
      return `<feColorMatrix in="${inName}" type="matrix" values="${values}" result="${outName}"/>`;
    }

    case "glow": {
      const color = effect.color ?? "white";
      const opacity = effect.opacity ?? 0.6;
      return [
        `<feGaussianBlur in="${inName}" stdDeviation="${effect.radius}" result="${outName}_blur"/>`,
        `<feFlood flood-color="${color}" flood-opacity="${opacity}" result="${outName}_color"/>`,
        `<feComposite in="${outName}_color" in2="${outName}_blur" operator="in" result="${outName}_glow"/>`,
        `<feMerge result="${outName}">`,
        `  <feMergeNode in="${outName}_glow"/>`,
        `  <feMergeNode in="${inName}"/>`,
        `</feMerge>`,
      ].join("\n    ");
    }

    case "displace": {
      const freq = effect.frequency ?? 0.05;
      const seed = effect.seed ?? 0;
      return [
        `<feTurbulence type="turbulence" baseFrequency="${freq}" numOctaves="2" seed="${seed}" result="${outName}_turb"/>`,
        `<feDisplacementMap in="${inName}" in2="${outName}_turb" scale="${effect.scale}" xChannelSelector="R" yChannelSelector="G" result="${outName}"/>`,
      ].join("\n    ");
    }
  }
}

export function filter(effects: FilterEffect[]): FilterResult {
  const id = djb2(JSON.stringify(effects));
  const lastOut = effects.length > 0 ? `e${effects.length - 1}` : "SourceGraphic";

  const body = effects.map((e, i) => `    ${buildEffect(e, i)}`).join("\n");

  const svg = `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">\n${body}\n  </filter>`;

  return {
    id,
    svg,
    css: `url(#${id})`,
  };
}
