import type { FontDeclaration } from '@foxworth/superimg';
import { FONT_DATA } from './font-data';

/** The browser and encoder receive the same bytes; no network font service. */
export const MATERIAL_FONTS: readonly FontDeclaration[] = FONT_DATA.map(({ weight, base64 }) => ({
  family: 'Inter', weight, style: 'normal',
  src: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
}));
export const MATERIAL_FONT_CSS = FONT_DATA.map(({ weight, base64 }) =>
  `@font-face{font-family:Inter;font-weight:${weight};font-style:normal;font-display:block;src:url(data:font/ttf;base64,${base64}) format('truetype');}`,
).join('\n');
export const MATERIAL_FONT_HASHES = FONT_DATA.map(({ weight, sha256 }) => ({ weight, sha256 }));
