/** SVG iPhone frame + in-screen app UI for feature-launch */

export interface AppBrand {
  productName: string;
  tagline: string;
  accentColor: string;
  accentLight: string;
}

export interface AppFeature {
  icon: string;
  title: string;
  desc: string;
}

const FRAME_W = 390;
const FRAME_H = 844;
/** Content sits below dynamic island */
const SAFE_TOP = 68;

function screenGradient(accent: string) {
  return `
    <linearGradient id="appBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.35"/>
    </linearGradient>
  `;
}

function iconGradDef(brand: AppBrand) {
  return `
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${brand.accentColor}"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  `;
}

function appIcon(brand: AppBrand, size: number, x: number, y: number) {
  const r = Math.round(size * 0.25);
  const fontSize = Math.round(size * 0.38);
  return `
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="url(#iconGrad)"/>
    <text x="${x + size / 2}" y="${y + size / 2 + fontSize * 0.32}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="800" fill="#fff">
      ${brand.productName.charAt(0)}
    </text>
  `;
}

function splashScreen(brand: AppBrand) {
  const cx = FRAME_W / 2;
  const iconSize = 96;
  const ix = cx - iconSize / 2;
  const iy = SAFE_TOP + 200;
  return `
    ${screenGradient(brand.accentColor)}
    ${iconGradDef(brand)}
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="url(#appBg)"/>
    ${appIcon(brand, iconSize, ix, iy)}
    <text x="${cx}" y="${iy + iconSize + 48}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="800" fill="#fff" letter-spacing="-0.02em">
      ${brand.productName}
    </text>
    <text x="${cx}" y="${iy + iconSize + 82}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="500" fill="rgba(255,255,255,0.78)">
      ${brand.tagline}
    </text>
    <rect x="${cx - 50}" y="${iy + iconSize + 108}" width="100" height="5" rx="2.5" fill="rgba(255,255,255,0.2)"/>
    <rect x="${cx - 50}" y="${iy + iconSize + 108}" width="68" height="5" rx="2.5" fill="${brand.accentLight}"/>
  `;
}

function featuresScreen(brand: AppBrand, features: AppFeature[], highlight: number) {
  const pad = 22;
  const rowH = 88;
  const rowGap = 12;
  let rows = "";
  features.forEach((f, i) => {
    const y = SAFE_TOP + 96 + i * (rowH + rowGap);
    const active = i === highlight;
    const rowFill = active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
    const stroke = active ? brand.accentColor : "rgba(255,255,255,0.1)";
    const strokeW = active ? 2 : 1;
    const iconBox = 46;
    rows += `
      <rect x="${pad}" y="${y}" width="${FRAME_W - pad * 2}" height="${rowH}" rx="16"
        fill="${rowFill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <rect x="${pad + 14}" y="${y + 21}" width="${iconBox}" height="${iconBox}" rx="12"
        fill="${brand.accentColor}" fill-opacity="${active ? 0.5 : 0.28}"/>
      <text x="${pad + 14 + iconBox / 2}" y="${y + 21 + iconBox / 2 + 7}" text-anchor="middle"
        font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="800" fill="${brand.accentLight}">${f.icon}</text>
      <text x="${pad + 76}" y="${y + 34}" font-family="Inter, system-ui, sans-serif"
        font-size="17" font-weight="700" fill="#fff">${f.title}</text>
      <text x="${pad + 76}" y="${y + 56}" font-family="Inter, system-ui, sans-serif"
        font-size="12" font-weight="500" fill="rgba(255,255,255,0.7)">${f.desc}</text>
    `;
    if (active) {
      rows += `
        <circle cx="${FRAME_W - pad - 24}" cy="${y + rowH / 2}" r="12" fill="${brand.accentColor}"/>
        <path d="M ${FRAME_W - pad - 29} ${y + rowH / 2} l 5 5 10 -12" stroke="#fff" stroke-width="2.2"
          fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    }
  });

  return `
    ${screenGradient(brand.accentColor)}
    ${iconGradDef(brand)}
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="url(#appBg)"/>
    <text x="${pad}" y="${SAFE_TOP + 28}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700"
      fill="rgba(255,255,255,0.5)" letter-spacing="0.14em">TODAY</text>
    <text x="${pad}" y="${SAFE_TOP + 58}" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="800" fill="#fff">
      Your habits
    </text>
    ${rows}
    <rect x="${pad}" y="${FRAME_H - 96}" width="${FRAME_W - pad * 2}" height="56" rx="18"
      fill="${brand.accentColor}" fill-opacity="0.22" stroke="${brand.accentColor}" stroke-width="1"/>
    <text x="${FRAME_W / 2}" y="${FRAME_H - 62}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700" fill="#fff">
      + Add habit
    </text>
  `;
}

function weeklyBars(brand: AppBrand) {
  let bars = "";
  const baseY = 560;
  for (let d = 0; d < 7; d++) {
    const bx = 64 + d * 40;
    const h = 22 + (d % 3) * 16;
    const active = d < 5;
    const fill = active ? brand.accentColor : "rgba(255,255,255,0.15)";
    const opacity = active ? 0.9 : 1;
    bars += `<rect x="${bx}" y="${baseY - h}" width="24" height="${h}" rx="5" fill="${fill}" fill-opacity="${opacity}"/>`;
  }
  return bars;
}

function homeScreen(brand: AppBrand, streak: number) {
  const cx = FRAME_W / 2;
  const iconY = SAFE_TOP + 56;
  return `
    ${screenGradient(brand.accentColor)}
    ${iconGradDef(brand)}
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="url(#appBg)"/>
    ${appIcon(brand, 56, cx - 28, iconY)}
    <text x="${cx}" y="${iconY + 100}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700"
      fill="rgba(255,255,255,0.55)" letter-spacing="0.12em">CURRENT STREAK</text>
    <text x="${cx}" y="${iconY + 168}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="80" font-weight="800" fill="#fff">${streak}</text>
    <text x="${cx}" y="${iconY + 200}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600" fill="${brand.accentLight}">days</text>
    <rect x="44" y="${iconY + 228}" width="${FRAME_W - 88}" height="50" rx="25" fill="${brand.accentColor}"/>
    <text x="${cx}" y="${iconY + 260}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="700" fill="#fff">
      Continue streak
    </text>
    <rect x="44" y="${iconY + 298}" width="${FRAME_W - 88}" height="108" rx="20" fill="rgba(255,255,255,0.06)"
      stroke="rgba(255,255,255,0.1)"/>
    <text x="64" y="${iconY + 330}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="#fff">
      Weekly progress
    </text>
    ${weeklyBars(brand)}
  `;
}

export type AppScreen = "splash" | "features" | "home";

export function buildAppScreen(
  screen: AppScreen,
  brand: AppBrand,
  features: AppFeature[],
  opts: { highlight?: number; streak?: number } = {},
) {
  if (screen === "splash") return splashScreen(brand);
  if (screen === "home") return homeScreen(brand, opts.streak ?? 12);
  return featuresScreen(brand, features, opts.highlight ?? 0);
}

export function buildIphoneSvg(
  screenHtml: string,
  width: number,
  clipId: string,
) {
  const height = Math.round(width * (FRAME_H / FRAME_W));

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${FRAME_W} ${FRAME_H}"
      xmlns="http://www.w3.org/2000/svg" style="display:block">
      <defs>
        <clipPath id="${clipId}">
          <rect x="18" y="18" width="354" height="808" rx="44"/>
        </clipPath>
        <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3f3f46"/>
          <stop offset="50%" stop-color="#27272a"/>
          <stop offset="100%" stop-color="#18181b"/>
        </linearGradient>
        <filter id="phoneShadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <g filter="url(#phoneShadow)">
        <rect x="4" y="4" width="382" height="836" rx="58" fill="url(#frameGrad)" stroke="#52525b" stroke-width="2"/>
        <rect x="10" y="10" width="370" height="824" rx="52" fill="#09090b" stroke="#3f3f46" stroke-width="1"/>
        <g clip-path="url(#${clipId})">${screenHtml}</g>
        <rect x="128" y="24" width="134" height="36" rx="18" fill="#000"/>
        <rect x="372" y="200" width="4" height="52" rx="2" fill="#3f3f46"/>
        <rect x="372" y="278" width="4" height="80" rx="2" fill="#3f3f46"/>
        <rect x="14" y="268" width="4" height="44" rx="2" fill="#3f3f46"/>
      </g>
    </svg>
  `;
}

export function phoneHeightForWidth(width: number) {
  return Math.round(width * (FRAME_H / FRAME_W));
}