// A drawn duotone portrait — woodcut shapes, no photograph, no network.

export interface PortraitInk {
  paper: string;
  ink: string;
  accent: string;
}

const S = 400;

/** Diagonal hatching used as the shadow side of the face. */
function hatch(id: string, color: string): string {
  return `<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
    <rect width="9" height="3.1" fill="${color}"/>
  </pattern>`;
}

export function portrait(ink: PortraitInk): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    ${hatch("shade", `${ink.ink}`)}
    <clipPath id="disc"><circle cx="200" cy="200" r="200"/></clipPath>
    <clipPath id="faceRight"><path d="M200,84 L296,84 L296,300 L200,300 Z"/></clipPath>
  </defs>
  <g clip-path="url(#disc)">
    <rect width="${S}" height="${S}" fill="${ink.paper}"/>

    <path d="M40,400 C48,318 104,282 152,266 L248,266 C296,282 352,318 360,400 Z" fill="${ink.ink}"/>
    <path d="M168,232 h64 v52 c0,16 -64,16 -64,0 Z" fill="${ink.ink}" opacity="0.82"/>

    <ellipse cx="200" cy="182" rx="86" ry="104" fill="${ink.ink}"/>
    <g clip-path="url(#faceRight)" opacity="0.35">
      <ellipse cx="200" cy="182" rx="86" ry="104" fill="url(#shade)"/>
    </g>

    <path d="M112,178 C104,96 152,58 200,58 C252,58 300,96 290,182 C286,146 268,124 236,116 C214,152 158,150 130,134 C120,146 114,160 112,178 Z" fill="${ink.ink}"/>
    <path d="M288,176 C312,196 316,244 296,262 C292,232 288,206 288,176 Z" fill="${ink.ink}"/>

    <g stroke="${ink.paper}" stroke-linecap="round" fill="none">
      <path d="M152,166 C162,158 178,158 188,164" stroke-width="6"/>
      <path d="M214,164 C224,158 240,158 250,166" stroke-width="6"/>
      <path d="M156,190 h28" stroke-width="7"/>
      <path d="M218,190 h28" stroke-width="7"/>
      <path d="M200,192 v28 h-14" stroke-width="5" opacity="0.85"/>
      <path d="M174,244 C188,256 214,256 228,244" stroke-width="6"/>
    </g>

    <path d="M152,266 C168,292 232,292 248,266 L248,282 C230,306 170,306 152,282 Z" fill="${ink.accent}"/>
    <circle cx="286" cy="214" r="9" fill="${ink.accent}"/>
  </g>
  <circle cx="200" cy="200" r="196" fill="none" stroke="${ink.accent}" stroke-width="8"/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
