/**
 * SVG line-art builders for "The Weight of a Choice".
 *
 * Every stroke and fill is class-driven (`lc-*`, styled in `styles.ts`) and
 * resolves to `--art-*` variables so the three surface profiles restyle one
 * drawing. Node roots receive state-owned inline transforms at runtime, so
 * static transforms live on inner wrappers only.
 */

export const walletShellArt = `<div class="art-wallet-shell">
  <svg class="lc" viewBox="0 0 480 300" aria-hidden="true">
    <g transform="translate(118 4) rotate(-5 63 22)">
      <rect class="lc-note-peek" x="0" y="0" width="126" height="46" rx="5"/>
      <rect class="lc-note-peek-frame" x="8" y="8" width="110" height="30" rx="3"/>
    </g>
    <rect class="lc-leather lc-wallet-body" x="18" y="40" width="444" height="226" rx="30"/>
    <path class="lc-wallet-fold" d="M240 48 V258"/>
    <rect class="lc-stitch" x="34" y="56" width="412" height="194" rx="20"/>
    <rect class="lc-leather lc-wallet-body" x="372" y="120" width="100" height="62" rx="16"/>
    <circle class="lc-snap" cx="422" cy="151" r="10"/>
    <path class="lc-sheen" d="M64 248 L212 58"/>
  </svg>
</div>`;

export const banknoteArt = `<div class="art-object art-banknote">
  <svg class="lc" viewBox="0 0 250 118" aria-hidden="true">
    <rect class="lc-note-bg" x="2" y="2" width="246" height="114" rx="9"/>
    <rect class="lc-note-frame" x="11" y="11" width="228" height="96" rx="5"/>
    <ellipse class="lc-guilloche" cx="125" cy="59" rx="66" ry="34"/>
    <ellipse class="lc-guilloche" cx="125" cy="59" rx="52" ry="42"/>
    <g class="lc-rosette">
      <circle cx="26" cy="26" r="8"/><circle cx="224" cy="26" r="8"/>
      <circle cx="26" cy="92" r="8"/><circle cx="224" cy="92" r="8"/>
    </g>
    <ellipse class="lc-note-frame" cx="62" cy="59" rx="23" ry="31"/>
    <path class="lc-note-hatch" d="M48 47 h28 M46 55 h32 M46 63 h32 M48 71 h28"/>
    <text class="lc-note-num" x="168" y="75">20</text>
  </svg>
</div>`;

export const familyPhotoArt = `<div class="art-object art-photo">
  <svg class="lc" viewBox="0 0 190 154" aria-hidden="true">
    <defs>
      <linearGradient id="lcPhotoSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style="stop-color: var(--art-accent-3)"/>
        <stop offset=".62" style="stop-color: var(--art-accent)"/>
        <stop offset="1" style="stop-color: color-mix(in srgb, var(--art-accent) 55%, var(--art-bg-2))"/>
      </linearGradient>
      <clipPath id="lcPhotoWin"><rect x="12" y="12" width="166" height="102" rx="2"/></clipPath>
    </defs>
    <rect class="lc-photo-frame" x="0" y="0" width="190" height="154" rx="6"/>
    <g clip-path="url(#lcPhotoWin)">
      <rect class="lc-photo-sky" x="12" y="12" width="166" height="102" fill="url(#lcPhotoSky)"/>
      <circle class="lc-photo-sun" cx="140" cy="70" r="16"/>
      <rect class="lc-photo-ground" x="12" y="96" width="166" height="18"/>
      <g class="lc-photo-figures">
        <circle cx="66" cy="52" r="9"/>
        <path d="M66 60 C57 62 54 72 53 84 L53 98 H79 L79 84 C78 72 75 62 66 60 Z"/>
        <circle cx="97" cy="56" r="8"/>
        <path d="M97 63 C89 65 87 74 86 84 L86 98 H108 L108 84 C107 74 105 65 97 63 Z"/>
        <circle cx="122" cy="72" r="5.5"/>
        <path d="M122 77 C117 79 116 84 115.5 90 L115.5 98 H128.5 L128.5 90 C128 84 127 79 122 77 Z"/>
        <path class="lc-photo-arm" d="M106 80 L116 87 M78 79 L87 81"/>
      </g>
      <path class="lc-photo-birds" d="M34 32 q4 -4 8 0 M48 26 q3.5 -3.5 7 0"/>
    </g>
    <path class="lc-photo-scrawl" d="M28 136 q8 -7 14 0 t14 0 t14 0 t14 0 q7 -6 12 -1"/>
  </svg>
</div>`;

export const addressCardArt = `<div class="art-object art-address-card">
  <span class="art-address-stamp" aria-hidden="true"></span>
  <strong>Mara Bell</strong><br/>17 North Ash<br/>Apartment 4B
</div>`;

export const ownerArt = `<div class="art-owner-silhouette">
  <svg class="lc" viewBox="0 0 150 320" aria-hidden="true">
    <ellipse class="lc-owner-shadow" cx="72" cy="302" rx="48" ry="8"/>
    <g class="lc-owner-fill">
      <path d="M75 2 L75 12 M15 60 Q75 -8 135 60"/>
      <path class="lc-owner-canopy" d="M15 60 Q75 -8 135 60 Q115 48 95 60 Q75 48 55 60 Q35 48 15 60 Z"/>
      <path class="lc-owner-pole" d="M77 58 C79 92 81 122 82 150"/>
      <circle cx="72" cy="92" r="17"/>
      <path d="M72 108 C50 112 44 130 42 160 L36 268 Q36 282 50 282 L64 282 L66 226 L72 224 L78 226 L82 282 L96 282 Q110 282 109 268 L104 160 C102 130 94 112 72 108 Z"/>
      <path class="lc-owner-arm" d="M86 118 C92 128 88 141 84 151"/>
    </g>
  </svg>
</div>`;

export const doorwayArt = `<div class="art-doorway-wrap">
  <div class="art-door-spill"></div>
  <svg class="lc" viewBox="0 0 280 570" aria-hidden="true">
    <rect class="lc-door-light" x="20" y="14" width="240" height="104"/>
    <path class="lc-door-frame" d="M6 570 V34 Q6 6 34 6 H246 Q274 6 274 34 V570"/>
    <path class="lc-door-molding" d="M20 570 V40 Q20 20 40 20 H240 Q260 20 260 40 V570"/>
    <path class="lc-door-mullions" d="M20 120 H260 M96 16 V118 M184 16 V118"/>
    <rect class="lc-door-panel" x="30" y="132" width="196" height="438"/>
    <rect class="lc-door-gap" x="228" y="132" width="32" height="438"/>
    <circle class="lc-door-handle" cx="212" cy="350" r="5"/>
    <path class="lc-door-step" d="M-6 570 H286"/>
  </svg>
</div>`;

/** Dashed walk-line leaving the wallet toward the dark left edge. */
export const keepTrailArt = `<div class="art-trail-node art-trail-keep">
  <div class="art-trail-plane">
    <svg class="lc art-trail-reveal art-trail-reveal-rtl" viewBox="0 0 640 300" aria-hidden="true">
      <path class="lc-trail-line" d="M604 22 C450 44 250 118 46 252"/>
      <path class="lc-trail-chevron" d="M84 232 L44 254 L88 268"/>
    </svg>
  </div>
  <span class="art-trail-label art-trail-label-keep">Keep</span>
</div>`;

/** Dashed walk-line following the light toward the doorway. */
export const returnTrailArt = `<div class="art-trail-node art-trail-return">
  <div class="art-trail-plane">
    <svg class="lc art-trail-reveal art-trail-reveal-ltr" viewBox="0 0 640 300" aria-hidden="true">
      <path class="lc-trail-line" d="M40 22 C210 50 420 128 600 240"/>
      <path class="lc-trail-chevron" d="M558 224 L602 242 L562 260"/>
    </svg>
  </div>
  <span class="art-trail-label art-trail-label-return">Return</span>
</div>`;
