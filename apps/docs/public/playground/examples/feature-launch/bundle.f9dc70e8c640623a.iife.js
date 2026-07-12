var __template = (function(exports) {
	Object.defineProperties(exports, {
		__esModule: { value: true },
		[Symbol.toStringTag]: { value: "Module" }
	});
	//#region packages/superimg-types/dist/index.js
	//! Serializable JSON-shaped values for template data defaults and CLI loaders.
	//! SuperImg Types - Core type definitions
	//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback
	//! The unified `define()` template factory.
	//!
	//! Unified template factory — one `define()` for all output kinds.
	//! Three orthogonal axes select behaviour:
	//!  - medium:   "html" (Chromium) | "svg" (resvg-wasm, browser-free, edge).
	//!  - animated: inferred from the config — true iff it declares fps AND
	//!              (duration OR a `resolve` hook that will supply duration).
	//!  - sink:     chosen later (config.outputs / CLI / `as`), not at authoring time.
	//!
	//! TypeScript narrows `ctx` to the right variant at the call site via overloads:
	//! medium picks the stdlib flavour, animated adds the temporal fields + helpers.
	function define(input) {
		const medium = input.medium ?? "html";
		const c = input.config;
		const hasResolve = typeof input.resolve === "function";
		return {
			medium,
			animated: !!c && typeof c.fps === "number" && (c.duration != null || hasResolve),
			render: input.render,
			...input.config !== void 0 ? { config: input.config } : {},
			...input.sample !== void 0 ? { sample: input.sample } : {},
			...hasResolve ? { resolve: input.resolve } : {}
		};
	}
	//! Result types and structured errors
	//! Discriminated unions for async operations with actionable error messages
	//! Player types - User-facing options, events, and input types for the browser player
	//! Implementation types (PlayerState, PlayerStore, etc.) live in @superimg/player
	//! Typed, versioned event contract for superimg build integrations.
	//! Both JS consumers (render wrappers) and Rust deserializers (e.g. gumbo)
	//! should key on the `v` field before reading event-specific fields.
	//! Bump `v` on any breaking field rename or removal; additive fields are non-breaking.
	//! SuperImg Batch Types
	//! Co-located `export const batch` convention for build-time fan-out.
	//! A template module optionally exports `batch` (built with `defineBatch`) to
	//! generate many outputs from one template — no separate loader file.
	//! SuperImg Types - Pure TypeScript type definitions
	//! Core types, interfaces, and error classes for templates, rendering, and playback
	//#endregion
	//#region examples/basics/layer-shots/shots.ts
	/**
	* Reusable layer "shots" — designer-authored building blocks.
	*/
	/** Lower-third overlay anchored bottom-left with broadcast safe area. */
	function lowerThirdOverlay(L, html, opts = {}) {
		return L.overlay(html, {
			anchor: "bottom-left",
			offset: opts.offset ?? {
				x: 0,
				y: 80
			},
			motion: opts.motion,
			safe: true
		});
	}
	//#endregion
	//#region examples/marketing/feature-launch/device.ts
	const FRAME_W = 390;
	const FRAME_H = 844;
	function screenGradient(accent) {
		return `
    <linearGradient id="appBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.35"/>
    </linearGradient>
  `;
	}
	function iconGradDef(brand) {
		return `
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${brand.accentColor}"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  `;
	}
	function appIcon(brand, size, x, y) {
		const r = Math.round(size * .25);
		const fontSize = Math.round(size * .38);
		return `
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="url(#iconGrad)"/>
    <text x="${x + size / 2}" y="${y + size / 2 + fontSize * .32}" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="800" fill="#fff">
      ${brand.productName.charAt(0)}
    </text>
  `;
	}
	function splashScreen(brand) {
		const cx = FRAME_W / 2;
		const iconSize = 96;
		const ix = cx - iconSize / 2;
		return `
    ${screenGradient(brand.accentColor)}
    ${iconGradDef(brand)}
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="url(#appBg)"/>
    ${appIcon(brand, iconSize, ix, 268)}
    <text x="${cx}" y="412" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="800" fill="#fff" letter-spacing="-0.02em">
      ${brand.productName}
    </text>
    <text x="${cx}" y="446" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="500" fill="rgba(255,255,255,0.78)">
      ${brand.tagline}
    </text>
    <rect x="${cx - 50}" y="472" width="100" height="5" rx="2.5" fill="rgba(255,255,255,0.2)"/>
    <rect x="${cx - 50}" y="472" width="68" height="5" rx="2.5" fill="${brand.accentLight}"/>
  `;
	}
	function featuresScreen(brand, features, highlight) {
		const pad = 22;
		const rowH = 88;
		let rows = "";
		features.forEach((f, i) => {
			const y = 164 + i * 100;
			const active = i === highlight;
			const rowFill = active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)";
			const stroke = active ? brand.accentColor : "rgba(255,255,255,0.1)";
			const strokeW = active ? 2 : 1;
			const iconBox = 46;
			rows += `
      <rect x="${pad}" y="${y}" width="${FRAME_W - pad * 2}" height="${rowH}" rx="16"
        fill="${rowFill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <rect x="36" y="${y + 21}" width="${iconBox}" height="${iconBox}" rx="12"
        fill="${brand.accentColor}" fill-opacity="${active ? .5 : .28}"/>
      <text x="59" y="${y + 21 + iconBox / 2 + 7}" text-anchor="middle"
        font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="800" fill="${brand.accentLight}">${f.icon}</text>
      <text x="98" y="${y + 34}" font-family="Inter, system-ui, sans-serif"
        font-size="17" font-weight="700" fill="#fff">${f.title}</text>
      <text x="98" y="${y + 56}" font-family="Inter, system-ui, sans-serif"
        font-size="12" font-weight="500" fill="rgba(255,255,255,0.7)">${f.desc}</text>
    `;
			if (active) rows += `
        <circle cx="${FRAME_W - pad - 24}" cy="${y + rowH / 2}" r="12" fill="${brand.accentColor}"/>
        <path d="M ${FRAME_W - pad - 29} ${y + rowH / 2} l 5 5 10 -12" stroke="#fff" stroke-width="2.2"
          fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      `;
		});
		return `
    ${screenGradient(brand.accentColor)}
    ${iconGradDef(brand)}
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="url(#appBg)"/>
    <text x="${pad}" y="96" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700"
      fill="rgba(255,255,255,0.5)" letter-spacing="0.14em">TODAY</text>
    <text x="${pad}" y="126" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="800" fill="#fff">
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
	function weeklyBars(brand) {
		let bars = "";
		const baseY = 560;
		for (let d = 0; d < 7; d++) {
			const bx = 64 + d * 40;
			const h = 22 + d % 3 * 16;
			const active = d < 5;
			const fill = active ? brand.accentColor : "rgba(255,255,255,0.15)";
			const opacity = active ? .9 : 1;
			bars += `<rect x="${bx}" y="${baseY - h}" width="24" height="${h}" rx="5" fill="${fill}" fill-opacity="${opacity}"/>`;
		}
		return bars;
	}
	function homeScreen(brand, streak) {
		const cx = FRAME_W / 2;
		return `
    ${screenGradient(brand.accentColor)}
    ${iconGradDef(brand)}
    <rect width="${FRAME_W}" height="${FRAME_H}" fill="url(#appBg)"/>
    ${appIcon(brand, 56, cx - 28, 124)}
    <text x="${cx}" y="224" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700"
      fill="rgba(255,255,255,0.55)" letter-spacing="0.12em">CURRENT STREAK</text>
    <text x="${cx}" y="292" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="80" font-weight="800" fill="#fff">${streak}</text>
    <text x="${cx}" y="324" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600" fill="${brand.accentLight}">days</text>
    <rect x="44" y="352" width="${FRAME_W - 88}" height="50" rx="25" fill="${brand.accentColor}"/>
    <text x="${cx}" y="384" text-anchor="middle"
      font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="700" fill="#fff">
      Continue streak
    </text>
    <rect x="44" y="422" width="${FRAME_W - 88}" height="108" rx="20" fill="rgba(255,255,255,0.06)"
      stroke="rgba(255,255,255,0.1)"/>
    <text x="64" y="454" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="#fff">
      Weekly progress
    </text>
    ${weeklyBars(brand)}
  `;
	}
	function buildAppScreen(screen, brand, features, opts = {}) {
		if (screen === "splash") return splashScreen(brand);
		if (screen === "home") return homeScreen(brand, opts.streak ?? 12);
		return featuresScreen(brand, features, opts.highlight ?? 0);
	}
	function buildIphoneSvg(screenHtml, width, clipId) {
		return `
    <svg width="${width}" height="${Math.round(width * (FRAME_H / FRAME_W))}" viewBox="0 0 ${FRAME_W} ${FRAME_H}"
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
	//#endregion
	//#region examples/marketing/feature-launch/feature-launch.media.ts
	const PHONE_ASPECT = 390 / 844;
	const STEADY_MOTION = "opacity:1;transform:translateY(0px)";
	const INTRO_WIPE_SEC = "1s";
	const TEXT_SHADOW = "0 2px 16px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)";
	const ACCENT_LIGHT = "#a5f3fc";
	const SCRIM_LEFT = "linear-gradient(90deg, rgba(6,8,20,0.88) 0%, rgba(6,8,20,0.62) 38%, rgba(6,8,20,0.18) 62%, transparent 100%)";
	const SCRIM_CENTER = "radial-gradient(ellipse 90% 80% at 50% 45%, rgba(6,8,20,0.82) 0%, rgba(6,8,20,0.48) 55%, rgba(6,8,20,0.2) 100%)";
	const APP_BG = "radial-gradient(ellipse 120% 90% at 70% 20%, rgba(34,211,238,0.18) 0%, transparent 55%), radial-gradient(ellipse 80% 70% at 20% 80%, rgba(168,85,247,0.14) 0%, transparent 50%), linear-gradient(160deg, #06080f 0%, #0c1222 45%, #111827 100%)";
	//#endregion
	exports.default = define({
		sample: {
			productName: "Pulse",
			tagline: "Habits that actually stick",
			hook: "Your goals, one tap away.",
			hookSub: "Track routines, streaks, and wins — without the guilt trip.",
			features: [
				{
					icon: "S",
					title: "Daily streaks",
					desc: "Momentum you can see"
				},
				{
					icon: "R",
					title: "Smart reminders",
					desc: "Nudges at the right time"
				},
				{
					icon: "I",
					title: "Weekly insights",
					desc: "Patterns at a glance"
				}
			],
			metric: {
				label: "Downloads this week",
				value: 128,
				suffix: "K+"
			},
			cta: {
				text: "Download free",
				url: "pulse.app"
			},
			accentColor: "#22d3ee"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "16s",
			fonts: ["Inter:wght@400;500;600;700;800"],
			audio: {
				id: "bed",
				src: "../../_assets/lofi-bg.mp3",
				role: "music",
				volume: .45,
				fadeIn: "0.5s",
				fadeOut: "2s",
				loop: true
			},
			outputs: {
				landscape: {
					width: 1920,
					height: 1080
				},
				square: {
					width: 1080,
					height: 1080
				},
				story: {
					width: 1080,
					height: 1920
				}
			},
			inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; overflow: hidden; }
      .hook-line { font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1.05; text-shadow: ${TEXT_SHADOW}; }
      .hook-sub { font-weight: 500; color: rgba(255,255,255,0.9); line-height: 1.4; text-shadow: 0 1px 10px rgba(0,0,0,0.5); }
      .feature-card {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        background: rgba(8,10,22,0.78);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 16px;
        backdrop-filter: blur(14px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      }
      .feature-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        font-size: 22px;
      }
      .feature-title { font-weight: 700; color: #fff; }
      .feature-desc { font-weight: 400; color: rgba(255,255,255,0.84); margin-top: 4px; }
      .metric-label { font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.72); }
      .metric-value { font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; text-shadow: ${TEXT_SHADOW}; }
      .product-badge { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
      .cta-panel {
        backdrop-filter: blur(24px);
        background: rgba(8,10,24,0.82);
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 28px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.55);
      }
      .cta-kicker {
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: ${ACCENT_LIGHT};
      }
      .cta-headline { font-weight: 800; color: #fff; letter-spacing: -0.03em; line-height: 1.05; text-shadow: ${TEXT_SHADOW}; }
      .cta-tagline { font-weight: 500; color: rgba(255,255,255,0.88); line-height: 1.45; }
      .cta-btn { font-weight: 700; color: #fff; border-radius: 14px; display: inline-block; }
      .cta-url { font-weight: 600; color: rgba(255,255,255,0.92); font-family: 'Inter', monospace; }
      .url-pill {
        background: rgba(8,10,22,0.88);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 12px 18px;
        backdrop-filter: blur(10px);
      }
      .store-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 14px;
        padding: 10px 18px;
        margin-top: 20px;
      }
    `]
		},
		render(ctx) {
			const { std, width, height, data, isPortrait } = ctx;
			const { productName, tagline, hook, hookSub, features, metric, cta, accentColor } = data;
			const r = std.createResponsive(ctx);
			const t = ctx.director({
				hook: "3.5s",
				features: "7s",
				cta: "5.5s"
			});
			const L = std.layers({
				width,
				height,
				mode: "opaque"
			});
			const brand = {
				productName,
				tagline,
				accentColor,
				accentLight: ACCENT_LIGHT
			};
			const featuresLocalLive = t.in("features");
			/** Size phone from frame height so it scales across outputs */
			function phoneWidth() {
				const maxH = r({
					portrait: height * .34,
					square: height * .54,
					default: height * .76
				});
				return Math.round(maxH * PHONE_ASPECT);
			}
			function featureStaggerInput(featuresLocal) {
				return std.interpolate(featuresLocal, [.06, .18], [0, 1], "linear");
			}
			function featureHighlight(featuresLocal) {
				return std.stagger.lead(features, featureStaggerInput(featuresLocal), { duration: .48 });
			}
			function buildPhone(screen, motionStyle, opts = {}) {
				return `<div style="${motionStyle}">${buildIphoneSvg(buildAppScreen(screen, brand, features, opts), phoneWidth(), `clip-${screen}`)}</div>`;
			}
			function phoneOverlayOpts() {
				if (isPortrait) return {
					anchor: {
						x: "50%",
						y: "66%",
						origin: "center"
					},
					offset: {
						x: 0,
						y: 0
					}
				};
				return {
					anchor: {
						x: "73%",
						y: "50%",
						origin: "center"
					},
					offset: {
						x: 0,
						y: 0
					}
				};
			}
			function textInset() {
				return isPortrait ? {
					top: "14%",
					left: 48,
					right: 48,
					bottom: "56%"
				} : {
					top: "20%",
					left: "7%",
					right: "48%",
					bottom: "16%"
				};
			}
			function buildHookContent() {
				const headlineStyle = t.motion({
					during: "hook",
					at: "0.2s",
					for: "0.5s",
					y: 32,
					easing: "easeOutCubic"
				}).style;
				const subStyle = t.motion({
					during: "hook",
					at: "0.3s",
					for: "0.5s",
					y: 22,
					easing: "easeOutCubic"
				}).style;
				return `
        <div style="${std.css({
					textAlign: isPortrait ? "center" : "left",
					maxWidth: r({
						portrait: "100%",
						default: "100%"
					})
				})}">
          <div class="hook-line" style="${std.css({ fontSize: r({
					portrait: 52,
					square: 40,
					default: 58
				}) })}; ${headlineStyle}">${hook}</div>
          <div class="hook-sub" style="${std.css({
					fontSize: r({
						portrait: 24,
						square: 20,
						default: 26
					}),
					marginTop: 20
				})}; ${subStyle}">${hookSub}</div>
        </div>
      `;
			}
			function buildHookShot(introWipe) {
				const phoneMotion = t.motion({
					during: "hook",
					at: "0s",
					for: "0.6s",
					scale: .94,
					easing: "easeOutExpo"
				}).style;
				const layers = [
					L.bg(APP_BG),
					L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT),
					L.content(buildHookContent(), {
						safe: "broadcast",
						inset: textInset()
					}),
					L.overlay(buildPhone("splash", phoneMotion), phoneOverlayOpts())
				];
				if (introWipe?.active) layers.push(L.fx(introWipe.html, { visible: () => introWipe.active }));
				return L.render(...layers);
			}
			function buildFeaturesContent(featuresLocal) {
				const featureEnterP = std.stagger.ms(features.length, featureStaggerInput(featuresLocal), {
					windowSeconds: 4,
					eachMs: 70,
					capMs: 500
				});
				const metricCount = Math.floor(t.tween(0, metric.value, {
					during: "features",
					at: "1.5s",
					for: "1.0s",
					easing: "easeOutQuart"
				}));
				const metricStyle = t.motion({
					during: "features",
					at: "1.5s",
					for: "0.6s",
					scale: .92,
					easing: "easeOutCubic"
				}).style;
				const badgeStyle = t.motion({
					during: "features",
					at: "0.4s",
					for: "0.5s",
					y: -16,
					easing: "easeOutCubic"
				}).style;
				const featureCards = features.map((f, i) => {
					const p = featureEnterP[i];
					const slideY = std.interpolate(p, [0, 1], [28, 0], "easeOutCubic");
					const opacity = std.interpolate(p, [0, 1], [0, 1], "easeOutCubic");
					const cardPad = r({
						portrait: "18px 20px",
						default: "20px 24px"
					});
					return `
            <div class="feature-card" style="${std.css({
						padding: cardPad,
						marginBottom: r({
							portrait: 14,
							default: 16
						}),
						opacity,
						transform: `translateY(${slideY}px)`
					})}">
              <div class="feature-icon" style="${std.css({
						width: r({
							portrait: 44,
							default: 48
						}),
						height: r({
							portrait: 44,
							default: 48
						}),
						background: std.color.alpha(accentColor, .42),
						color: ACCENT_LIGHT,
						border: `1px solid ${std.color.alpha(accentColor, .55)}`
					})}">${f.icon}</div>
              <div>
                <div class="feature-title" style="${std.css({ fontSize: r({
						portrait: 22,
						default: 26
					}) })}">${f.title}</div>
                <div class="feature-desc" style="${std.css({ fontSize: r({
						portrait: 16,
						default: 18
					}) })}">${f.desc}</div>
              </div>
            </div>
          `;
				}).join("");
				return {
					featuresHtml: `
        <div style="${std.css({ width: "100%" })}">
          ${featureCards}
          <div style="${std.css({ marginTop: r({
						portrait: 28,
						default: 36
					}) })}; ${metricStyle}">
            <div class="metric-label" style="${std.css({ fontSize: r({
						portrait: 12,
						default: 13
					}) })}">${metric.label}</div>
            <div class="metric-value" style="${std.css({
						fontSize: r({
							portrait: 52,
							square: 44,
							default: 64
						}),
						marginTop: 6
					})}">
              ${metricCount}<span style="${std.css({
						fontSize: r({
							portrait: 28,
							default: 36
						}),
						color: ACCENT_LIGHT
					})}">${metric.suffix}</span>
            </div>
          </div>
        </div>
      `,
					badgeHtml: `
        <div class="product-badge" style="${std.css({
						fontSize: r({
							portrait: 13,
							default: 14
						}),
						color: "#fff",
						background: "rgba(8,10,22,0.9)",
						padding: "8px 16px",
						borderRadius: 999,
						border: `1px solid ${std.color.alpha(accentColor, .65)}`,
						boxShadow: `0 4px 20px rgba(0,0,0,0.4)`
					})}; ${badgeStyle}">${productName}</div>
      `
				};
			}
			function buildFeaturesShot(featuresLocal) {
				const { featuresHtml, badgeHtml } = buildFeaturesContent(featuresLocal);
				const highlight = featureHighlight(featuresLocal);
				return L.render(L.bg(APP_BG), L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT), L.tint(std.color.alpha(accentColor, .05)), L.content(featuresHtml, {
					safe: "broadcast",
					inset: textInset()
				}), L.overlay(buildPhone("features", STEADY_MOTION, { highlight }), phoneOverlayOpts()), L.overlay(badgeHtml, {
					anchor: "top-left",
					offset: {
						x: r({
							portrait: 40,
							default: 64
						}),
						y: r({
							portrait: 56,
							default: 48
						})
					},
					safe: true
				}));
			}
			function buildFeaturesPanel(featuresLocal) {
				const { featuresHtml, badgeHtml } = buildFeaturesContent(featuresLocal);
				return L.render(L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT), L.tint(std.color.alpha(accentColor, .05)), L.content(featuresHtml, {
					safe: "broadcast",
					inset: textInset()
				}), L.overlay(badgeHtml, {
					anchor: "top-left",
					offset: {
						x: r({
							portrait: 40,
							default: 64
						}),
						y: r({
							portrait: 56,
							default: 48
						})
					},
					safe: true
				}));
			}
			function buildHookPanel() {
				return L.render(L.tint(isPortrait ? SCRIM_CENTER : SCRIM_LEFT), L.content(buildHookContent(), {
					safe: "broadcast",
					inset: textInset()
				}));
			}
			function buildCtaContent(d) {
				const kickerStyle = d.motion({
					at: "0.1s",
					for: "0.5s",
					y: 14,
					easing: "easeOutCubic"
				}).style;
				const headlineStyle = d.motion({
					at: "0.2s",
					for: "0.6s",
					y: 28,
					easing: "easeOutCubic"
				}).style;
				const tagStyle = d.motion({
					at: "0.3s",
					for: "0.5s",
					y: 18,
					easing: "easeOutCubic"
				}).style;
				const btnStyle = d.motion({
					at: "0.5s",
					for: "0.5s",
					scale: .9,
					easing: "easeOutBack"
				}).style;
				const storeBadge = `
        <div class="store-badge" style="${btnStyle}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#fff"/>
          </svg>
          <div style="${std.css({ textAlign: "left" })}">
            <div style="${std.css({
					fontSize: 10,
					color: "rgba(255,255,255,0.6)",
					fontWeight: 600
				})}">Download on the</div>
            <div style="${std.css({
					fontSize: 16,
					color: "#fff",
					fontWeight: 700,
					marginTop: 1
				})}">App Store</div>
          </div>
        </div>
      `;
				const ctaCenterHtml = isPortrait ? `
          <div style="${std.css({
					textAlign: "center",
					width: "100%"
				})}">
            <div class="cta-panel" style="${std.css({
					padding: r({
						portrait: "32px 28px",
						default: "40px 36px"
					}),
					maxWidth: 560,
					margin: "0 auto"
				})}">
              <div class="cta-kicker" style="${std.css({
					fontSize: 11,
					marginBottom: 14
				})}; ${kickerStyle}">Now on iOS</div>
              <div class="cta-headline" style="${std.css({ fontSize: r({
					portrait: 48,
					default: 52
				}) })}; ${headlineStyle}">${productName}</div>
              <div class="cta-tagline" style="${std.css({
					fontSize: r({
						portrait: 20,
						default: 22
					}),
					marginTop: 12
				})}; ${tagStyle}">${tagline}</div>
              <div class="cta-btn" style="${std.css({
					marginTop: 28,
					fontSize: 20,
					padding: "14px 32px",
					background: `linear-gradient(135deg, ${accentColor}, ${std.color.mix(accentColor, "#a855f7", .35)})`,
					boxShadow: `0 12px 40px ${std.color.alpha(accentColor, .4)}`
				})}; ${btnStyle}">${cta.text}</div>
              ${storeBadge}
            </div>
          </div>
        ` : `
          <div class="cta-panel" style="${std.css({
					textAlign: "left",
					padding: "44px 48px",
					maxWidth: 520
				})}">
            <div class="cta-kicker" style="${std.css({
					fontSize: 12,
					marginBottom: 18
				})}; ${kickerStyle}">Now on iOS</div>
            <div class="cta-headline" style="${std.css({ fontSize: 56 })}; ${headlineStyle}">${productName}</div>
            <div class="cta-tagline" style="${std.css({
					fontSize: 24,
					marginTop: 14,
					maxWidth: 400
				})}; ${tagStyle}">${tagline}</div>
            <div class="cta-btn" style="${std.css({
					marginTop: 32,
					fontSize: 22,
					padding: "16px 36px",
					background: `linear-gradient(135deg, ${accentColor}, ${std.color.mix(accentColor, "#a855f7", .35)})`,
					boxShadow: `0 12px 40px ${std.color.alpha(accentColor, .4)}`
				})}; ${btnStyle}">${cta.text}</div>
            ${storeBadge}
          </div>
        `;
				const lowerMotion = d.motion({
					at: "0.6s",
					for: "0.5s",
					y: 32,
					easing: "easeOutCubic"
				});
				return {
					ctaCenterHtml,
					ctaLowerThird: `
        <div class="url-pill" style="${std.css({
						display: "flex",
						alignItems: "center",
						gap: 12
					})}">
          <div style="${std.css({
						width: 4,
						height: 28,
						background: accentColor,
						borderRadius: 2,
						flexShrink: 0
					})}"></div>
          <div class="cta-url" style="${std.css({ fontSize: r({
						portrait: 18,
						default: 20
					}) })}">${cta.url}</div>
        </div>
      `,
					lowerMotion
				};
			}
			function buildCtaShot(d) {
				const { ctaCenterHtml, ctaLowerThird, lowerMotion } = buildCtaContent(d);
				const streak = Math.floor(d.tween(0, 12, {
					at: "0.8s",
					for: "0.8s",
					easing: "easeOutQuart"
				}));
				const phoneMotion = d.motion({
					at: "0s",
					for: "0.6s",
					scale: .94,
					easing: "easeOutCubic"
				}).style;
				const accentGlow = `radial-gradient(ellipse 80% 60% at 50% 30%, ${std.color.alpha(accentColor, .2)} 0%, transparent 70%)`;
				const layers = [
					L.bg(APP_BG),
					L.tint(SCRIM_CENTER),
					L.tint(accentGlow),
					L.content(ctaCenterHtml, {
						safe: "broadcast",
						inset: isPortrait ? void 0 : {
							top: "20%",
							left: "8%",
							right: "46%",
							bottom: "16%"
						}
					}),
					lowerThirdOverlay(L, ctaLowerThird, {
						motion: lowerMotion,
						offset: { y: r({
							portrait: 360,
							default: 72
						}) }
					})
				];
				layers.splice(4, 0, L.overlay(buildPhone("home", phoneMotion, { streak }), phoneOverlayOpts()));
				return L.render(...layers);
			}
			if (t.inSpan("3.4s", "4.0s")) {
				const hookToFeaturesP = t.transition("3.4s", "4.0s", "easeInOutCubic");
				const handoffFeaturesLocal = std.reveal.handoffLocal(hookToFeaturesP);
				const screen = hookToFeaturesP < .55 ? "splash" : "features";
				const highlight = hookToFeaturesP < .55 ? 0 : featureHighlight(handoffFeaturesLocal);
				const handoff = std.reveal.split({
					from: buildHookPanel(),
					to: buildFeaturesPanel(handoffFeaturesLocal),
					progress: hookToFeaturesP,
					style: "wipe",
					accentColor
				});
				return L.handoff({
					shared: [L.bg(APP_BG)],
					transition: handoff,
					pinned: [L.overlay(buildPhone(screen, STEADY_MOTION, { highlight }), phoneOverlayOpts())]
				});
			}
			if (t.inSpan("10.2s", "10.8s")) {
				const featuresToCtaP = t.transition("10.2s", "10.8s", "easeInOutCubic");
				const handoffDir = t.clip({
					from: "9.8s",
					duration: "1s"
				}).director({ enter: "100%" });
				return std.reveal.crossfade({
					from: buildFeaturesShot(1),
					to: buildCtaShot(handoffDir),
					progress: featuresToCtaP
				}).html;
			}
			if (t.active === "hook") {
				const introP = t.span("0s", INTRO_WIPE_SEC);
				return buildHookShot(std.reveal.wipe({
					progress: introP,
					direction: "diagonal",
					color: accentColor
				}));
			}
			if (t.active === "features") return buildFeaturesShot(featuresLocalLive);
			return buildCtaShot(t.clip({ during: "cta" }).director({ enter: "100%" }));
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmVhdHVyZS1sYXVuY2gubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2Jhc2ljcy9sYXllci1zaG90cy9zaG90cy50cyIsIi4uL2V4YW1wbGVzL21hcmtldGluZy9mZWF0dXJlLWxhdW5jaC9kZXZpY2UudHMiLCIuLi9leGFtcGxlcy9tYXJrZXRpbmcvZmVhdHVyZS1sYXVuY2gvZmVhdHVyZS1sYXVuY2gubWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy9qc29uLnRzXG4vLyEgU2VyaWFsaXphYmxlIEpTT04tc2hhcGVkIHZhbHVlcyBmb3IgdGVtcGxhdGUgZGF0YSBkZWZhdWx0cyBhbmQgQ0xJIGxvYWRlcnMuXG5mdW5jdGlvbiBpc0pzb25PYmplY3QodmFsdWUpIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbCAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSk7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvdHlwZXMudHNcbi8vISBTdXBlckltZyBUeXBlcyAtIENvcmUgdHlwZSBkZWZpbml0aW9uc1xuLy8hIEV4cGxpY2l0LCB0eXBlZCwgc2VsZi1kb2N1bWVudGluZyBpbnRlcmZhY2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vKipcbiogRGVmaW5lIGEgcHJvamVjdC9mb2xkZXIgY29uZmlnIGZvciBfY29uZmlnLnRzIGZpbGVzLlxuKiBQcm92aWRlcyB0eXBlIGluZmVyZW5jZSBhbmQgdmFsaWRhdGlvbi5cbiovXG5mdW5jdGlvbiBkZWZpbmVDb25maWcoY29uZmlnKSB7XG5cdHJldHVybiBjb25maWc7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvZGVmaW5lLnRzXG4vLyEgVGhlIHVuaWZpZWQgYGRlZmluZSgpYCB0ZW1wbGF0ZSBmYWN0b3J5LlxuLy8hXG4vLyEgVW5pZmllZCB0ZW1wbGF0ZSBmYWN0b3J5IOKAlCBvbmUgYGRlZmluZSgpYCBmb3IgYWxsIG91dHB1dCBraW5kcy5cbi8vISBUaHJlZSBvcnRob2dvbmFsIGF4ZXMgc2VsZWN0IGJlaGF2aW91cjpcbi8vISAgLSBtZWRpdW06ICAgXCJodG1sXCIgKENocm9taXVtKSB8IFwic3ZnXCIgKHJlc3ZnLXdhc20sIGJyb3dzZXItZnJlZSwgZWRnZSkuXG4vLyEgIC0gYW5pbWF0ZWQ6IGluZmVycmVkIGZyb20gdGhlIGNvbmZpZyDigJQgdHJ1ZSBpZmYgaXQgZGVjbGFyZXMgZnBzIEFORFxuLy8hICAgICAgICAgICAgICAoZHVyYXRpb24gT1IgYSBgcmVzb2x2ZWAgaG9vayB0aGF0IHdpbGwgc3VwcGx5IGR1cmF0aW9uKS5cbi8vISAgLSBzaW5rOiAgICAgY2hvc2VuIGxhdGVyIChjb25maWcub3V0cHV0cyAvIENMSSAvIGBhc2ApLCBub3QgYXQgYXV0aG9yaW5nIHRpbWUuXG4vLyFcbi8vISBUeXBlU2NyaXB0IG5hcnJvd3MgYGN0eGAgdG8gdGhlIHJpZ2h0IHZhcmlhbnQgYXQgdGhlIGNhbGwgc2l0ZSB2aWEgb3ZlcmxvYWRzOlxuLy8hIG1lZGl1bSBwaWNrcyB0aGUgc3RkbGliIGZsYXZvdXIsIGFuaW1hdGVkIGFkZHMgdGhlIHRlbXBvcmFsIGZpZWxkcyArIGhlbHBlcnMuXG5mdW5jdGlvbiBkZWZpbmUoaW5wdXQpIHtcblx0Y29uc3QgbWVkaXVtID0gaW5wdXQubWVkaXVtID8/IFwiaHRtbFwiO1xuXHRjb25zdCBjID0gaW5wdXQuY29uZmlnO1xuXHRjb25zdCBoYXNSZXNvbHZlID0gdHlwZW9mIGlucHV0LnJlc29sdmUgPT09IFwiZnVuY3Rpb25cIjtcblx0cmV0dXJuIHtcblx0XHRtZWRpdW0sXG5cdFx0YW5pbWF0ZWQ6ICEhYyAmJiB0eXBlb2YgYy5mcHMgPT09IFwibnVtYmVyXCIgJiYgKGMuZHVyYXRpb24gIT0gbnVsbCB8fCBoYXNSZXNvbHZlKSxcblx0XHRyZW5kZXI6IGlucHV0LnJlbmRlcixcblx0XHQuLi5pbnB1dC5jb25maWcgIT09IHZvaWQgMCA/IHsgY29uZmlnOiBpbnB1dC5jb25maWcgfSA6IHt9LFxuXHRcdC4uLmlucHV0LnNhbXBsZSAhPT0gdm9pZCAwID8geyBzYW1wbGU6IGlucHV0LnNhbXBsZSB9IDoge30sXG5cdFx0Li4uaGFzUmVzb2x2ZSA/IHsgcmVzb2x2ZTogaW5wdXQucmVzb2x2ZSB9IDoge31cblx0fTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gYW5pbWF0ZWQgKGZwcyArIGR1cmF0aW9uIGF0IGF1dGhvcmluZyB0aW1lKS4gKi9cbmZ1bmN0aW9uIGlzQW5pbWF0ZWRUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IHRydWU7XG59XG4vKiogTmFycm93IGEgdGVtcGxhdGUgbW9kdWxlIHRvIHN0YXRpYyAoc3RpbGwgLyBzaW5nbGUtZnJhbWUpLiAqL1xuZnVuY3Rpb24gaXNTdGF0aWNUZW1wbGF0ZSh0ZW1wbGF0ZSkge1xuXHRyZXR1cm4gdGVtcGxhdGUuYW5pbWF0ZWQgPT09IGZhbHNlO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3Jlc3VsdHMudHNcbi8vISBSZXN1bHQgdHlwZXMgYW5kIHN0cnVjdHVyZWQgZXJyb3JzXG4vLyEgRGlzY3JpbWluYXRlZCB1bmlvbnMgZm9yIGFzeW5jIG9wZXJhdGlvbnMgd2l0aCBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2VzXG4vKipcbiogQmFzZSBlcnJvciBjbGFzcyBmb3IgYWxsIFN1cGVySW1nIGVycm9yc1xuKi9cbnZhciBTdXBlckltZ0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG5cdGNvZGU7XG5cdGRldGFpbHM7XG5cdHN1Z2dlc3Rpb247XG5cdGRvY3NVcmw7XG5cdC8qKiBNYXBwZWQgc291cmNlIGxvY2F0aW9uIChwb3B1bGF0ZWQgYnkgZW5yaWNoRXJyb3Igd2hlbiBzb3VyY2VtYXAgYXZhaWxhYmxlKSAqL1xuXHRsb2NhdGlvbjtcblx0LyoqIFZpdGUtc3R5bGUgY29kZSBmcmFtZSBzdHJpbmcgKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZSBjb250ZW50IGF2YWlsYWJsZSkgKi9cblx0Y29kZUZyYW1lO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlLCBjb2RlLCBkZXRhaWxzLCBzdWdnZXN0aW9uLCBkb2NzVXJsKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5jb2RlID0gY29kZTtcblx0XHR0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuXHRcdHRoaXMuc3VnZ2VzdGlvbiA9IHN1Z2dlc3Rpb247XG5cdFx0dGhpcy5kb2NzVXJsID0gZG9jc1VybDtcblx0XHR0aGlzLm5hbWUgPSBcIlN1cGVySW1nRXJyb3JcIjtcblx0XHRjb25zdCBjYXB0dXJlU3RhY2tUcmFjZSA9IEVycm9yLmNhcHR1cmVTdGFja1RyYWNlO1xuXHRcdGlmIChjYXB0dXJlU3RhY2tUcmFjZSkgY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdH1cblx0LyoqIENvbnZlcnQgdG8gYSBwbGFpbiBvYmplY3QgZm9yIGxvZ2dpbmcvc2VyaWFsaXphdGlvbiAqL1xuXHR0b0pTT04oKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdGNvZGU6IHRoaXMuY29kZSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMubWVzc2FnZSxcblx0XHRcdGRldGFpbHM6IHRoaXMuZGV0YWlscyxcblx0XHRcdHN1Z2dlc3Rpb246IHRoaXMuc3VnZ2VzdGlvbixcblx0XHRcdC4uLnRoaXMuZG9jc1VybCAhPT0gdm9pZCAwID8geyBkb2NzVXJsOiB0aGlzLmRvY3NVcmwgfSA6IHt9LFxuXHRcdFx0Li4udGhpcy5sb2NhdGlvbiAhPT0gdm9pZCAwID8geyBsb2NhdGlvbjogdGhpcy5sb2NhdGlvbiB9IDoge30sXG5cdFx0XHQuLi50aGlzLmNvZGVGcmFtZSAhPT0gdm9pZCAwID8geyBjb2RlRnJhbWU6IHRoaXMuY29kZUZyYW1lIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkXG4qL1xudmFyIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBsb2NhdGlvbiA9IGRldGFpbHMubGluZSA/IGAgYXQgbGluZSAke2RldGFpbHMubGluZX1gIDogXCJcIjtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBDaGVjayB0aGUgdGVtcGxhdGUgc3ludGF4JHtsb2NhdGlvbn0uIEVuc3VyZSB0aGUgcmVuZGVyIGZ1bmN0aW9uIHJldHVybnMgYSBzdHJpbmcuYDtcblx0XHRzdXBlcihgVGVtcGxhdGUgY29tcGlsYXRpb24gZmFpbGVkJHtsb2NhdGlvbn06ICR7ZGV0YWlscy5zeW50YXhFcnJvcn1gLCBcIlRFTVBMQVRFX0NPTVBJTEFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlQ29tcGlsYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogVGVtcGxhdGUgdGhyZXcgYW4gZXJyb3IgZHVyaW5nIHJlbmRlclxuKi9cbnZhciBUZW1wbGF0ZVJ1bnRpbWVFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCB0aW1lSW5mbyA9IGRldGFpbHMudGltZUNvbnRleHQgPyBgICgke2RldGFpbHMudGltZUNvbnRleHQudGltZWxpbmVTZWNvbmRzLnRvRml4ZWQoMyl9cywgJHsoZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVByb2dyZXNzICogMTAwKS50b0ZpeGVkKDEpfSUgcHJvZ3Jlc3MpYCA6IFwiXCI7XG5cdFx0c3VwZXIoYFRlbXBsYXRlIGVycm9yIGF0IGZyYW1lICR7ZGV0YWlscy5mcmFtZX0ke3RpbWVJbmZvfTogJHtkZXRhaWxzLm9yaWdpbmFsRXJyb3J9YCwgXCJURU1QTEFURV9SVU5USU1FX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBgVGhlIHJlbmRlciBmdW5jdGlvbiB0aHJldyBhbiBlcnJvci4gQ2hlY2sgdGhhdCBhbGwgZGF0YSBwcm9wZXJ0aWVzIGV4aXN0IGFuZCB2YWx1ZXMgYXJlbid0IE5hTi91bmRlZmluZWQgYXQgdGhpcyBwb2ludCBpbiB0aGUgdGltZWxpbmUuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlcyNkZWJ1Z2dpbmdcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJUZW1wbGF0ZVJ1bnRpbWVFcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogRGF0YSB2YWxpZGF0aW9uIGZhaWxlZFxuKi9cbnZhciBWYWxpZGF0aW9uRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBgRXhwZWN0ZWQgJHtkZXRhaWxzLmV4cGVjdGVkVHlwZX0gYnV0IHJlY2VpdmVkICR7dHlwZW9mIGRldGFpbHMucmVjZWl2ZWRWYWx1ZX0uIENoZWNrIHlvdXIgZGF0YSBvYmplY3QuYDtcblx0XHRzdXBlcihgVmFsaWRhdGlvbiBmYWlsZWQgZm9yIGZpZWxkIFwiJHtkZXRhaWxzLmZpZWxkfVwiYCwgXCJWQUxJREFUSU9OX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3RlbXBsYXRlc1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlZhbGlkYXRpb25FcnJvclwiO1xuXHRcdGlmIChkZXRhaWxzLmZpbGUgJiYgZGV0YWlscy5saW5lICE9PSB2b2lkIDApIHRoaXMubG9jYXRpb24gPSB7XG5cdFx0XHRmaWxlOiBkZXRhaWxzLmZpbGUsXG5cdFx0XHRsaW5lOiBkZXRhaWxzLmxpbmUsXG5cdFx0XHQuLi5kZXRhaWxzLmNvbHVtbiAhPT0gdm9pZCAwID8geyBjb2x1bW46IGRldGFpbHMuY29sdW1uIH0gOiB7fVxuXHRcdH07XG5cdH1cbn07XG4vKipcbiogUmVuZGVyIGZhaWxlZCAoZW5jb2RpbmcsIGJyb3dzZXIsIGV0Yy4pXG4qL1xudmFyIFJlbmRlckVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gZGV0YWlscy5odG1sRXJyb3IgPyBgVGhlIHRlbXBsYXRlIHJldHVybmVkIGludmFsaWQgSFRNTC4gQ2hlY2sgeW91ciByZW5kZXIgZnVuY3Rpb24gb3V0cHV0LmAgOiBkZXRhaWxzLmVuY29kZXJFcnJvciA/IGBFbmNvZGVyIGVycm9yLiBUcnkgcmVkdWNpbmcgcmVzb2x1dGlvbiBvciBjaGFuZ2luZyBjb2RlYy5gIDogYEJyb3dzZXIgZXJyb3IuIENoZWNrIGZvciBicm93c2VyIGNvbXBhdGliaWxpdHkgaXNzdWVzLmA7XG5cdFx0c3VwZXIoYFJlbmRlciBmYWlsZWQgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfWAsIFwiUkVOREVSX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMuc3VnZ2VzdGlvbiA/PyBkZWZhdWx0U3VnZ2VzdGlvbiwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlJlbmRlckVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBGaWxlIEkvTyBlcnJvclxuKi9cbnZhciBJT0Vycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdHN1cGVyKGBGYWlsZWQgdG8gJHtkZXRhaWxzLm9wZXJhdGlvbn0gZmlsZTogJHtkZXRhaWxzLnBhdGh9YCwgXCJJT19FUlJPUlwiLCBkZXRhaWxzLCBkZXRhaWxzLm9wZXJhdGlvbiA9PT0gXCJ3cml0ZVwiID8gYENoZWNrIHRoYXQgdGhlIGRpcmVjdG9yeSBleGlzdHMgYW5kIHlvdSBoYXZlIHdyaXRlIHBlcm1pc3Npb25zLmAgOiBgQ2hlY2sgdGhhdCB0aGUgZmlsZSBleGlzdHMgYW5kIHlvdSBoYXZlIHJlYWQgcGVybWlzc2lvbnMuYCwgXCJodHRwczovL3N1cGVyaW1nLmRldi9kb2NzL3Ryb3VibGVzaG9vdGluZyNpb1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIklPRXJyb3JcIjtcblx0fVxufTtcbi8qKlxuKiBQbGF5ZXIgbm90IHJlYWR5IGVycm9yXG4qL1xudmFyIFBsYXllck5vdFJlYWR5RXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihvcGVyYXRpb24pIHtcblx0XHRzdXBlcihgUGxheWVyIG5vdCByZWFkeSBmb3Igb3BlcmF0aW9uOiAke29wZXJhdGlvbn1gLCBcIlBMQVlFUl9OT1RfUkVBRFlcIiwgeyBvcGVyYXRpb24gfSwgYENhbGwgbG9hZCgpIGFuZCB3YWl0IGZvciBpdCB0byBjb21wbGV0ZSBiZWZvcmUgY2FsbGluZyAke29wZXJhdGlvbn0oKS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvcGxheWVyXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUGxheWVyTm90UmVhZHlFcnJvclwiO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3BsYXllci50c1xuLy8hIFBsYXllciB0eXBlcyAtIFVzZXItZmFjaW5nIG9wdGlvbnMsIGV2ZW50cywgYW5kIGlucHV0IHR5cGVzIGZvciB0aGUgYnJvd3NlciBwbGF5ZXJcbi8vISBJbXBsZW1lbnRhdGlvbiB0eXBlcyAoUGxheWVyU3RhdGUsIFBsYXllclN0b3JlLCBldGMuKSBsaXZlIGluIEBzdXBlcmltZy9wbGF5ZXJcbi8qKiBUeXBlIGd1YXJkIGZvciBDb21wb3NlZFRlbXBsYXRlICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIiAmJiBpbnB1dCAhPT0gbnVsbCAmJiBcInR5cGVcIiBpbiBpbnB1dCAmJiBpbnB1dC50eXBlID09PSBcImNvbXBvc2VkXCI7XG59XG4vKiogQGRlcHJlY2F0ZWQgVXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSAqL1xuY29uc3QgaXNBbnlDb21wb3NlZFRlbXBsYXRlID0gaXNDb21wb3NlZFRlbXBsYXRlO1xuLyoqIEBkZXByZWNhdGVkIFJlbW92ZWQg4oCUIHVzZSBpc0NvbXBvc2VkVGVtcGxhdGUgYW5kIGNoZWNrIG1lZGl1bSA9PT0gXCJzdmdcIiAqL1xuZnVuY3Rpb24gaXNDb21wb3NlZFN2Z1RlbXBsYXRlKGlucHV0KSB7XG5cdHJldHVybiBpc0NvbXBvc2VkVGVtcGxhdGUoaW5wdXQpICYmIGlucHV0Lm1lZGl1bSA9PT0gXCJzdmdcIjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9ldmVudHMudHNcbi8vISBUeXBlZCwgdmVyc2lvbmVkIGV2ZW50IGNvbnRyYWN0IGZvciBzdXBlcmltZyBidWlsZCBpbnRlZ3JhdGlvbnMuXG4vLyEgQm90aCBKUyBjb25zdW1lcnMgKHJlbmRlciB3cmFwcGVycykgYW5kIFJ1c3QgZGVzZXJpYWxpemVycyAoZS5nLiBndW1ibylcbi8vISBzaG91bGQga2V5IG9uIHRoZSBgdmAgZmllbGQgYmVmb3JlIHJlYWRpbmcgZXZlbnQtc3BlY2lmaWMgZmllbGRzLlxuLy8hIEJ1bXAgYHZgIG9uIGFueSBicmVha2luZyBmaWVsZCByZW5hbWUgb3IgcmVtb3ZhbDsgYWRkaXRpdmUgZmllbGRzIGFyZSBub24tYnJlYWtpbmcuXG5jb25zdCBSRU5ERVJfRVZFTlRfVkVSU0lPTiA9IDE7XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvYmF0Y2gtdHlwZXMudHNcbi8vISBTdXBlckltZyBCYXRjaCBUeXBlc1xuLy8hIENvLWxvY2F0ZWQgYGV4cG9ydCBjb25zdCBiYXRjaGAgY29udmVudGlvbiBmb3IgYnVpbGQtdGltZSBmYW4tb3V0LlxuLy8hIEEgdGVtcGxhdGUgbW9kdWxlIG9wdGlvbmFsbHkgZXhwb3J0cyBgYmF0Y2hgIChidWlsdCB3aXRoIGBkZWZpbmVCYXRjaGApIHRvXG4vLyEgZ2VuZXJhdGUgbWFueSBvdXRwdXRzIGZyb20gb25lIHRlbXBsYXRlIOKAlCBubyBzZXBhcmF0ZSBsb2FkZXIgZmlsZS5cbi8qKlxuKiBUeXBlIGEgY28tbG9jYXRlZCBgYmF0Y2hgIGV4cG9ydCBhZ2FpbnN0IGl0cyB0ZW1wbGF0ZS5cbipcbiogYFREYXRhYCBmbG93cyBmcm9tIHRoZSB0ZW1wbGF0ZSB2YWx1ZSDigJQgY2hhbmdlIHRoZSB0ZW1wbGF0ZSdzIGBzYW1wbGVgXG4qIHNoYXBlIGFuZCB0aGUgYGRhdGE6YCBzaXRlcyBiZWxvdyB0eXBlLWVycm9yLiBUaGUgdGVtcGxhdGUgYXJndW1lbnQgaXNcbiogaW5mZXJlbmNlLW9ubHk7IGF0IHJ1bnRpbWUgdGhlIHByb3ZpZGVyIGlzIHJldHVybmVkIHVuY2hhbmdlZC5cbipcbiogUHV0IGFueSBzZXJ2ZXIvZGF0YSBpbXBvcnRzICppbnNpZGUqIHRoZSBwcm92aWRlciB3aXRoIGBhd2FpdCBpbXBvcnQoLi4uKWBcbiogc28gdGhlIGNsaWVudCBwbGF5ZXIgYnVuZGxlICh3aGljaCBpbXBvcnRzIHRoZSB0ZW1wbGF0ZSkgdHJlZS1zaGFrZXMgdGhlbSBvdXQuXG4qXG4qIEBleGFtcGxlXG4qIGBgYHR5cGVzY3JpcHRcbiogLy8gb2cubWVkaWEudHNcbiogaW1wb3J0IHsgZGVmaW5lLCBkZWZpbmVCYXRjaCB9IGZyb20gXCJzdXBlcmltZ1wiO1xuKlxuKiBjb25zdCB0ZW1wbGF0ZSA9IGRlZmluZSh7IHNhbXBsZTogeyB0aXRsZTogXCJIaVwiIH0sIGNvbmZpZzogeyB3aWR0aDogMTIwMCwgaGVpZ2h0OiA2MzAgfSwgcmVuZGVyIH0pO1xuKiBleHBvcnQgZGVmYXVsdCB0ZW1wbGF0ZTtcbipcbiogZXhwb3J0IGNvbnN0IGJhdGNoID0gZGVmaW5lQmF0Y2godGVtcGxhdGUsIGFzeW5jICgpID0+IHtcbiogICBjb25zdCB7IGdldFBvc3RzIH0gPSBhd2FpdCBpbXBvcnQoXCIuLi9jb250ZW50XCIpO1xuKiAgIHJldHVybiAoYXdhaXQgZ2V0UG9zdHMoKSkubWFwKHAgPT4gKHsgc2x1ZzogcC5zbHVnLCBzYW1wbGU6IHsgdGl0bGU6IHAudGl0bGUgfSB9KSk7XG4qIH0pO1xuKiBgYGBcbiovXG5mdW5jdGlvbiBkZWZpbmVCYXRjaChfdGVtcGxhdGUsIHByb3ZpZGVyKSB7XG5cdHJldHVybiBwcm92aWRlcjtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9pbmRleC50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gUHVyZSBUeXBlU2NyaXB0IHR5cGUgZGVmaW5pdGlvbnNcbi8vISBDb3JlIHR5cGVzLCBpbnRlcmZhY2VzLCBhbmQgZXJyb3IgY2xhc3NlcyBmb3IgdGVtcGxhdGVzLCByZW5kZXJpbmcsIGFuZCBwbGF5YmFja1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBJT0Vycm9yLCBQbGF5ZXJOb3RSZWFkeUVycm9yLCBSRU5ERVJfRVZFTlRfVkVSU0lPTiwgUmVuZGVyRXJyb3IsIFN1cGVySW1nRXJyb3IsIFRlbXBsYXRlQ29tcGlsYXRpb25FcnJvciwgVGVtcGxhdGVSdW50aW1lRXJyb3IsIFZhbGlkYXRpb25FcnJvciwgZGVmaW5lLCBkZWZpbmVCYXRjaCwgZGVmaW5lQ29uZmlnLCBpc0FuaW1hdGVkVGVtcGxhdGUsIGlzQW55Q29tcG9zZWRUZW1wbGF0ZSwgaXNDb21wb3NlZFN2Z1RlbXBsYXRlLCBpc0NvbXBvc2VkVGVtcGxhdGUsIGlzSnNvbk9iamVjdCwgaXNTdGF0aWNUZW1wbGF0ZSB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCIvKipcbiAqIFJldXNhYmxlIGxheWVyIFwic2hvdHNcIiDigJQgZGVzaWduZXItYXV0aG9yZWQgYnVpbGRpbmcgYmxvY2tzLlxuICovXG5cbi8qKiBMb3dlci10aGlyZCBvdmVybGF5IGFuY2hvcmVkIGJvdHRvbS1sZWZ0IHdpdGggYnJvYWRjYXN0IHNhZmUgYXJlYS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb3dlclRoaXJkT3ZlcmxheShMLCBodG1sLCBvcHRzID0ge30pIHtcbiAgcmV0dXJuIEwub3ZlcmxheShodG1sLCB7XG4gICAgYW5jaG9yOiBcImJvdHRvbS1sZWZ0XCIsXG4gICAgb2Zmc2V0OiBvcHRzLm9mZnNldCA/PyB7IHg6IDAsIHk6IDgwIH0sXG4gICAgbW90aW9uOiBvcHRzLm1vdGlvbixcbiAgICBzYWZlOiB0cnVlLFxuICB9KTtcbn1cblxuLyoqIEZ1bGwtYmxlZWQgaGVybzogS2VuIEJ1cm5zIGJhY2tncm91bmQgKyB0aW50ZWQgaGVhZGxpbmUuICovXG5leHBvcnQgZnVuY3Rpb24gaGVyb1Nob3QoTCwgc3RkLCBkYXRhKSB7XG4gIGNvbnN0IHQgPSBjdHguZGlyZWN0b3IoKTtcbiAgY29uc3QgYmcgPSBzdGQuYmFja2dyb3VuZHMua2VuQnVybnMoe1xuICAgIHNyYzogZGF0YS5iYWNrZ3JvdW5kSW1hZ2UsXG4gICAgcHJvZ3Jlc3M6IHQucHJvZ3Jlc3MsXG4gICAgb3ZlcmxheTogZGF0YS5vdmVybGF5ID8/IFwicmdiYSgwLDAsMCwwLjU1KVwiLFxuICB9KTtcbiAgY29uc3QgaGVhZGxpbmUgPSB0Lm1vdGlvbih7IHk6IDI0IH0pO1xuXG4gIHJldHVybiBMLnJlbmRlcihcbiAgICBMLmJnKGJnLmh0bWwpLFxuICAgIEwuY29udGVudChgPGgxIHN0eWxlPVwiJHtoZWFkbGluZS5zdHlsZX1cIj4ke2RhdGEuaGVhZGxpbmV9PC9oMT5gLCB7IHNhZmU6IFwiYnJvYWRjYXN0XCIgfSksXG4gICk7XG59IiwiLyoqIFNWRyBpUGhvbmUgZnJhbWUgKyBpbi1zY3JlZW4gYXBwIFVJIGZvciBmZWF0dXJlLWxhdW5jaCAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEFwcEJyYW5kIHtcbiAgcHJvZHVjdE5hbWU6IHN0cmluZztcbiAgdGFnbGluZTogc3RyaW5nO1xuICBhY2NlbnRDb2xvcjogc3RyaW5nO1xuICBhY2NlbnRMaWdodDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwcEZlYXR1cmUge1xuICBpY29uOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGRlc2M6IHN0cmluZztcbn1cblxuY29uc3QgRlJBTUVfVyA9IDM5MDtcbmNvbnN0IEZSQU1FX0ggPSA4NDQ7XG4vKiogQ29udGVudCBzaXRzIGJlbG93IGR5bmFtaWMgaXNsYW5kICovXG5jb25zdCBTQUZFX1RPUCA9IDY4O1xuXG5mdW5jdGlvbiBzY3JlZW5HcmFkaWVudChhY2NlbnQ6IHN0cmluZykge1xuICByZXR1cm4gYFxuICAgIDxsaW5lYXJHcmFkaWVudCBpZD1cImFwcEJnXCIgeDE9XCIwJVwiIHkxPVwiMCVcIiB4Mj1cIjEwMCVcIiB5Mj1cIjEwMCVcIj5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiMwZjE3MmFcIi8+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCI1NSVcIiBzdG9wLWNvbG9yPVwiIzExMTgyN1wiLz5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiJHthY2NlbnR9XCIgc3RvcC1vcGFjaXR5PVwiMC4zNVwiLz5cbiAgICA8L2xpbmVhckdyYWRpZW50PlxuICBgO1xufVxuXG5mdW5jdGlvbiBpY29uR3JhZERlZihicmFuZDogQXBwQnJhbmQpIHtcbiAgcmV0dXJuIGBcbiAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJpY29uR3JhZFwiIHgxPVwiMCVcIiB5MT1cIjAlXCIgeDI9XCIxMDAlXCIgeTI9XCIxMDAlXCI+XG4gICAgICA8c3RvcCBvZmZzZXQ9XCIwJVwiIHN0b3AtY29sb3I9XCIke2JyYW5kLmFjY2VudENvbG9yfVwiLz5cbiAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiI2E4NTVmN1wiLz5cbiAgICA8L2xpbmVhckdyYWRpZW50PlxuICBgO1xufVxuXG5mdW5jdGlvbiBhcHBJY29uKGJyYW5kOiBBcHBCcmFuZCwgc2l6ZTogbnVtYmVyLCB4OiBudW1iZXIsIHk6IG51bWJlcikge1xuICBjb25zdCByID0gTWF0aC5yb3VuZChzaXplICogMC4yNSk7XG4gIGNvbnN0IGZvbnRTaXplID0gTWF0aC5yb3VuZChzaXplICogMC4zOCk7XG4gIHJldHVybiBgXG4gICAgPHJlY3QgeD1cIiR7eH1cIiB5PVwiJHt5fVwiIHdpZHRoPVwiJHtzaXplfVwiIGhlaWdodD1cIiR7c2l6ZX1cIiByeD1cIiR7cn1cIiBmaWxsPVwidXJsKCNpY29uR3JhZClcIi8+XG4gICAgPHRleHQgeD1cIiR7eCArIHNpemUgLyAyfVwiIHk9XCIke3kgKyBzaXplIC8gMiArIGZvbnRTaXplICogMC4zMn1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiXG4gICAgICBmb250LWZhbWlseT1cIkludGVyLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIiBmb250LXNpemU9XCIke2ZvbnRTaXplfVwiIGZvbnQtd2VpZ2h0PVwiODAwXCIgZmlsbD1cIiNmZmZcIj5cbiAgICAgICR7YnJhbmQucHJvZHVjdE5hbWUuY2hhckF0KDApfVxuICAgIDwvdGV4dD5cbiAgYDtcbn1cblxuZnVuY3Rpb24gc3BsYXNoU2NyZWVuKGJyYW5kOiBBcHBCcmFuZCkge1xuICBjb25zdCBjeCA9IEZSQU1FX1cgLyAyO1xuICBjb25zdCBpY29uU2l6ZSA9IDk2O1xuICBjb25zdCBpeCA9IGN4IC0gaWNvblNpemUgLyAyO1xuICBjb25zdCBpeSA9IFNBRkVfVE9QICsgMjAwO1xuICByZXR1cm4gYFxuICAgICR7c2NyZWVuR3JhZGllbnQoYnJhbmQuYWNjZW50Q29sb3IpfVxuICAgICR7aWNvbkdyYWREZWYoYnJhbmQpfVxuICAgIDxyZWN0IHdpZHRoPVwiJHtGUkFNRV9XfVwiIGhlaWdodD1cIiR7RlJBTUVfSH1cIiBmaWxsPVwidXJsKCNhcHBCZylcIi8+XG4gICAgJHthcHBJY29uKGJyYW5kLCBpY29uU2l6ZSwgaXgsIGl5KX1cbiAgICA8dGV4dCB4PVwiJHtjeH1cIiB5PVwiJHtpeSArIGljb25TaXplICsgNDh9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIlxuICAgICAgZm9udC1mYW1pbHk9XCJJbnRlciwgc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCIgZm9udC1zaXplPVwiMzRcIiBmb250LXdlaWdodD1cIjgwMFwiIGZpbGw9XCIjZmZmXCIgbGV0dGVyLXNwYWNpbmc9XCItMC4wMmVtXCI+XG4gICAgICAke2JyYW5kLnByb2R1Y3ROYW1lfVxuICAgIDwvdGV4dD5cbiAgICA8dGV4dCB4PVwiJHtjeH1cIiB5PVwiJHtpeSArIGljb25TaXplICsgODJ9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIlxuICAgICAgZm9udC1mYW1pbHk9XCJJbnRlciwgc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCIgZm9udC1zaXplPVwiMTZcIiBmb250LXdlaWdodD1cIjUwMFwiIGZpbGw9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuNzgpXCI+XG4gICAgICAke2JyYW5kLnRhZ2xpbmV9XG4gICAgPC90ZXh0PlxuICAgIDxyZWN0IHg9XCIke2N4IC0gNTB9XCIgeT1cIiR7aXkgKyBpY29uU2l6ZSArIDEwOH1cIiB3aWR0aD1cIjEwMFwiIGhlaWdodD1cIjVcIiByeD1cIjIuNVwiIGZpbGw9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuMilcIi8+XG4gICAgPHJlY3QgeD1cIiR7Y3ggLSA1MH1cIiB5PVwiJHtpeSArIGljb25TaXplICsgMTA4fVwiIHdpZHRoPVwiNjhcIiBoZWlnaHQ9XCI1XCIgcng9XCIyLjVcIiBmaWxsPVwiJHticmFuZC5hY2NlbnRMaWdodH1cIi8+XG4gIGA7XG59XG5cbmZ1bmN0aW9uIGZlYXR1cmVzU2NyZWVuKGJyYW5kOiBBcHBCcmFuZCwgZmVhdHVyZXM6IEFwcEZlYXR1cmVbXSwgaGlnaGxpZ2h0OiBudW1iZXIpIHtcbiAgY29uc3QgcGFkID0gMjI7XG4gIGNvbnN0IHJvd0ggPSA4ODtcbiAgY29uc3Qgcm93R2FwID0gMTI7XG4gIGxldCByb3dzID0gXCJcIjtcbiAgZmVhdHVyZXMuZm9yRWFjaCgoZiwgaSkgPT4ge1xuICAgIGNvbnN0IHkgPSBTQUZFX1RPUCArIDk2ICsgaSAqIChyb3dIICsgcm93R2FwKTtcbiAgICBjb25zdCBhY3RpdmUgPSBpID09PSBoaWdobGlnaHQ7XG4gICAgY29uc3Qgcm93RmlsbCA9IGFjdGl2ZSA/IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEyKVwiIDogXCJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpXCI7XG4gICAgY29uc3Qgc3Ryb2tlID0gYWN0aXZlID8gYnJhbmQuYWNjZW50Q29sb3IgOiBcInJnYmEoMjU1LDI1NSwyNTUsMC4xKVwiO1xuICAgIGNvbnN0IHN0cm9rZVcgPSBhY3RpdmUgPyAyIDogMTtcbiAgICBjb25zdCBpY29uQm94ID0gNDY7XG4gICAgcm93cyArPSBgXG4gICAgICA8cmVjdCB4PVwiJHtwYWR9XCIgeT1cIiR7eX1cIiB3aWR0aD1cIiR7RlJBTUVfVyAtIHBhZCAqIDJ9XCIgaGVpZ2h0PVwiJHtyb3dIfVwiIHJ4PVwiMTZcIlxuICAgICAgICBmaWxsPVwiJHtyb3dGaWxsfVwiIHN0cm9rZT1cIiR7c3Ryb2tlfVwiIHN0cm9rZS13aWR0aD1cIiR7c3Ryb2tlV31cIi8+XG4gICAgICA8cmVjdCB4PVwiJHtwYWQgKyAxNH1cIiB5PVwiJHt5ICsgMjF9XCIgd2lkdGg9XCIke2ljb25Cb3h9XCIgaGVpZ2h0PVwiJHtpY29uQm94fVwiIHJ4PVwiMTJcIlxuICAgICAgICBmaWxsPVwiJHticmFuZC5hY2NlbnRDb2xvcn1cIiBmaWxsLW9wYWNpdHk9XCIke2FjdGl2ZSA/IDAuNSA6IDAuMjh9XCIvPlxuICAgICAgPHRleHQgeD1cIiR7cGFkICsgMTQgKyBpY29uQm94IC8gMn1cIiB5PVwiJHt5ICsgMjEgKyBpY29uQm94IC8gMiArIDd9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIlxuICAgICAgICBmb250LWZhbWlseT1cIkludGVyLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIiBmb250LXNpemU9XCIxOFwiIGZvbnQtd2VpZ2h0PVwiODAwXCIgZmlsbD1cIiR7YnJhbmQuYWNjZW50TGlnaHR9XCI+JHtmLmljb259PC90ZXh0PlxuICAgICAgPHRleHQgeD1cIiR7cGFkICsgNzZ9XCIgeT1cIiR7eSArIDM0fVwiIGZvbnQtZmFtaWx5PVwiSW50ZXIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiXG4gICAgICAgIGZvbnQtc2l6ZT1cIjE3XCIgZm9udC13ZWlnaHQ9XCI3MDBcIiBmaWxsPVwiI2ZmZlwiPiR7Zi50aXRsZX08L3RleHQ+XG4gICAgICA8dGV4dCB4PVwiJHtwYWQgKyA3Nn1cIiB5PVwiJHt5ICsgNTZ9XCIgZm9udC1mYW1pbHk9XCJJbnRlciwgc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCJcbiAgICAgICAgZm9udC1zaXplPVwiMTJcIiBmb250LXdlaWdodD1cIjUwMFwiIGZpbGw9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuNylcIj4ke2YuZGVzY308L3RleHQ+XG4gICAgYDtcbiAgICBpZiAoYWN0aXZlKSB7XG4gICAgICByb3dzICs9IGBcbiAgICAgICAgPGNpcmNsZSBjeD1cIiR7RlJBTUVfVyAtIHBhZCAtIDI0fVwiIGN5PVwiJHt5ICsgcm93SCAvIDJ9XCIgcj1cIjEyXCIgZmlsbD1cIiR7YnJhbmQuYWNjZW50Q29sb3J9XCIvPlxuICAgICAgICA8cGF0aCBkPVwiTSAke0ZSQU1FX1cgLSBwYWQgLSAyOX0gJHt5ICsgcm93SCAvIDJ9IGwgNSA1IDEwIC0xMlwiIHN0cm9rZT1cIiNmZmZcIiBzdHJva2Utd2lkdGg9XCIyLjJcIlxuICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCIvPlxuICAgICAgYDtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBgXG4gICAgJHtzY3JlZW5HcmFkaWVudChicmFuZC5hY2NlbnRDb2xvcil9XG4gICAgJHtpY29uR3JhZERlZihicmFuZCl9XG4gICAgPHJlY3Qgd2lkdGg9XCIke0ZSQU1FX1d9XCIgaGVpZ2h0PVwiJHtGUkFNRV9IfVwiIGZpbGw9XCJ1cmwoI2FwcEJnKVwiLz5cbiAgICA8dGV4dCB4PVwiJHtwYWR9XCIgeT1cIiR7U0FGRV9UT1AgKyAyOH1cIiBmb250LWZhbWlseT1cIkludGVyLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIiBmb250LXNpemU9XCIxMVwiIGZvbnQtd2VpZ2h0PVwiNzAwXCJcbiAgICAgIGZpbGw9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuNSlcIiBsZXR0ZXItc3BhY2luZz1cIjAuMTRlbVwiPlRPREFZPC90ZXh0PlxuICAgIDx0ZXh0IHg9XCIke3BhZH1cIiB5PVwiJHtTQUZFX1RPUCArIDU4fVwiIGZvbnQtZmFtaWx5PVwiSW50ZXIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiIGZvbnQtc2l6ZT1cIjI4XCIgZm9udC13ZWlnaHQ9XCI4MDBcIiBmaWxsPVwiI2ZmZlwiPlxuICAgICAgWW91ciBoYWJpdHNcbiAgICA8L3RleHQ+XG4gICAgJHtyb3dzfVxuICAgIDxyZWN0IHg9XCIke3BhZH1cIiB5PVwiJHtGUkFNRV9IIC0gOTZ9XCIgd2lkdGg9XCIke0ZSQU1FX1cgLSBwYWQgKiAyfVwiIGhlaWdodD1cIjU2XCIgcng9XCIxOFwiXG4gICAgICBmaWxsPVwiJHticmFuZC5hY2NlbnRDb2xvcn1cIiBmaWxsLW9wYWNpdHk9XCIwLjIyXCIgc3Ryb2tlPVwiJHticmFuZC5hY2NlbnRDb2xvcn1cIiBzdHJva2Utd2lkdGg9XCIxXCIvPlxuICAgIDx0ZXh0IHg9XCIke0ZSQU1FX1cgLyAyfVwiIHk9XCIke0ZSQU1FX0ggLSA2Mn1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiXG4gICAgICBmb250LWZhbWlseT1cIkludGVyLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIiBmb250LXNpemU9XCIxNlwiIGZvbnQtd2VpZ2h0PVwiNzAwXCIgZmlsbD1cIiNmZmZcIj5cbiAgICAgICsgQWRkIGhhYml0XG4gICAgPC90ZXh0PlxuICBgO1xufVxuXG5mdW5jdGlvbiB3ZWVrbHlCYXJzKGJyYW5kOiBBcHBCcmFuZCkge1xuICBsZXQgYmFycyA9IFwiXCI7XG4gIGNvbnN0IGJhc2VZID0gNTYwO1xuICBmb3IgKGxldCBkID0gMDsgZCA8IDc7IGQrKykge1xuICAgIGNvbnN0IGJ4ID0gNjQgKyBkICogNDA7XG4gICAgY29uc3QgaCA9IDIyICsgKGQgJSAzKSAqIDE2O1xuICAgIGNvbnN0IGFjdGl2ZSA9IGQgPCA1O1xuICAgIGNvbnN0IGZpbGwgPSBhY3RpdmUgPyBicmFuZC5hY2NlbnRDb2xvciA6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjE1KVwiO1xuICAgIGNvbnN0IG9wYWNpdHkgPSBhY3RpdmUgPyAwLjkgOiAxO1xuICAgIGJhcnMgKz0gYDxyZWN0IHg9XCIke2J4fVwiIHk9XCIke2Jhc2VZIC0gaH1cIiB3aWR0aD1cIjI0XCIgaGVpZ2h0PVwiJHtofVwiIHJ4PVwiNVwiIGZpbGw9XCIke2ZpbGx9XCIgZmlsbC1vcGFjaXR5PVwiJHtvcGFjaXR5fVwiLz5gO1xuICB9XG4gIHJldHVybiBiYXJzO1xufVxuXG5mdW5jdGlvbiBob21lU2NyZWVuKGJyYW5kOiBBcHBCcmFuZCwgc3RyZWFrOiBudW1iZXIpIHtcbiAgY29uc3QgY3ggPSBGUkFNRV9XIC8gMjtcbiAgY29uc3QgaWNvblkgPSBTQUZFX1RPUCArIDU2O1xuICByZXR1cm4gYFxuICAgICR7c2NyZWVuR3JhZGllbnQoYnJhbmQuYWNjZW50Q29sb3IpfVxuICAgICR7aWNvbkdyYWREZWYoYnJhbmQpfVxuICAgIDxyZWN0IHdpZHRoPVwiJHtGUkFNRV9XfVwiIGhlaWdodD1cIiR7RlJBTUVfSH1cIiBmaWxsPVwidXJsKCNhcHBCZylcIi8+XG4gICAgJHthcHBJY29uKGJyYW5kLCA1NiwgY3ggLSAyOCwgaWNvblkpfVxuICAgIDx0ZXh0IHg9XCIke2N4fVwiIHk9XCIke2ljb25ZICsgMTAwfVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCJcbiAgICAgIGZvbnQtZmFtaWx5PVwiSW50ZXIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiIGZvbnQtc2l6ZT1cIjEyXCIgZm9udC13ZWlnaHQ9XCI3MDBcIlxuICAgICAgZmlsbD1cInJnYmEoMjU1LDI1NSwyNTUsMC41NSlcIiBsZXR0ZXItc3BhY2luZz1cIjAuMTJlbVwiPkNVUlJFTlQgU1RSRUFLPC90ZXh0PlxuICAgIDx0ZXh0IHg9XCIke2N4fVwiIHk9XCIke2ljb25ZICsgMTY4fVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCJcbiAgICAgIGZvbnQtZmFtaWx5PVwiSW50ZXIsIHN5c3RlbS11aSwgc2Fucy1zZXJpZlwiIGZvbnQtc2l6ZT1cIjgwXCIgZm9udC13ZWlnaHQ9XCI4MDBcIiBmaWxsPVwiI2ZmZlwiPiR7c3RyZWFrfTwvdGV4dD5cbiAgICA8dGV4dCB4PVwiJHtjeH1cIiB5PVwiJHtpY29uWSArIDIwMH1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiXG4gICAgICBmb250LWZhbWlseT1cIkludGVyLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIiBmb250LXNpemU9XCIxOFwiIGZvbnQtd2VpZ2h0PVwiNjAwXCIgZmlsbD1cIiR7YnJhbmQuYWNjZW50TGlnaHR9XCI+ZGF5czwvdGV4dD5cbiAgICA8cmVjdCB4PVwiNDRcIiB5PVwiJHtpY29uWSArIDIyOH1cIiB3aWR0aD1cIiR7RlJBTUVfVyAtIDg4fVwiIGhlaWdodD1cIjUwXCIgcng9XCIyNVwiIGZpbGw9XCIke2JyYW5kLmFjY2VudENvbG9yfVwiLz5cbiAgICA8dGV4dCB4PVwiJHtjeH1cIiB5PVwiJHtpY29uWSArIDI2MH1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiXG4gICAgICBmb250LWZhbWlseT1cIkludGVyLCBzeXN0ZW0tdWksIHNhbnMtc2VyaWZcIiBmb250LXNpemU9XCIxN1wiIGZvbnQtd2VpZ2h0PVwiNzAwXCIgZmlsbD1cIiNmZmZcIj5cbiAgICAgIENvbnRpbnVlIHN0cmVha1xuICAgIDwvdGV4dD5cbiAgICA8cmVjdCB4PVwiNDRcIiB5PVwiJHtpY29uWSArIDI5OH1cIiB3aWR0aD1cIiR7RlJBTUVfVyAtIDg4fVwiIGhlaWdodD1cIjEwOFwiIHJ4PVwiMjBcIiBmaWxsPVwicmdiYSgyNTUsMjU1LDI1NSwwLjA2KVwiXG4gICAgICBzdHJva2U9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuMSlcIi8+XG4gICAgPHRleHQgeD1cIjY0XCIgeT1cIiR7aWNvblkgKyAzMzB9XCIgZm9udC1mYW1pbHk9XCJJbnRlciwgc3lzdGVtLXVpLCBzYW5zLXNlcmlmXCIgZm9udC1zaXplPVwiMTRcIiBmb250LXdlaWdodD1cIjcwMFwiIGZpbGw9XCIjZmZmXCI+XG4gICAgICBXZWVrbHkgcHJvZ3Jlc3NcbiAgICA8L3RleHQ+XG4gICAgJHt3ZWVrbHlCYXJzKGJyYW5kKX1cbiAgYDtcbn1cblxuZXhwb3J0IHR5cGUgQXBwU2NyZWVuID0gXCJzcGxhc2hcIiB8IFwiZmVhdHVyZXNcIiB8IFwiaG9tZVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRBcHBTY3JlZW4oXG4gIHNjcmVlbjogQXBwU2NyZWVuLFxuICBicmFuZDogQXBwQnJhbmQsXG4gIGZlYXR1cmVzOiBBcHBGZWF0dXJlW10sXG4gIG9wdHM6IHsgaGlnaGxpZ2h0PzogbnVtYmVyOyBzdHJlYWs/OiBudW1iZXIgfSA9IHt9LFxuKSB7XG4gIGlmIChzY3JlZW4gPT09IFwic3BsYXNoXCIpIHJldHVybiBzcGxhc2hTY3JlZW4oYnJhbmQpO1xuICBpZiAoc2NyZWVuID09PSBcImhvbWVcIikgcmV0dXJuIGhvbWVTY3JlZW4oYnJhbmQsIG9wdHMuc3RyZWFrID8/IDEyKTtcbiAgcmV0dXJuIGZlYXR1cmVzU2NyZWVuKGJyYW5kLCBmZWF0dXJlcywgb3B0cy5oaWdobGlnaHQgPz8gMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZElwaG9uZVN2ZyhcbiAgc2NyZWVuSHRtbDogc3RyaW5nLFxuICB3aWR0aDogbnVtYmVyLFxuICBjbGlwSWQ6IHN0cmluZyxcbikge1xuICBjb25zdCBoZWlnaHQgPSBNYXRoLnJvdW5kKHdpZHRoICogKEZSQU1FX0ggLyBGUkFNRV9XKSk7XG5cbiAgcmV0dXJuIGBcbiAgICA8c3ZnIHdpZHRoPVwiJHt3aWR0aH1cIiBoZWlnaHQ9XCIke2hlaWdodH1cIiB2aWV3Qm94PVwiMCAwICR7RlJBTUVfV30gJHtGUkFNRV9IfVwiXG4gICAgICB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3R5bGU9XCJkaXNwbGF5OmJsb2NrXCI+XG4gICAgICA8ZGVmcz5cbiAgICAgICAgPGNsaXBQYXRoIGlkPVwiJHtjbGlwSWR9XCI+XG4gICAgICAgICAgPHJlY3QgeD1cIjE4XCIgeT1cIjE4XCIgd2lkdGg9XCIzNTRcIiBoZWlnaHQ9XCI4MDhcIiByeD1cIjQ0XCIvPlxuICAgICAgICA8L2NsaXBQYXRoPlxuICAgICAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJmcmFtZUdyYWRcIiB4MT1cIjAlXCIgeTE9XCIwJVwiIHgyPVwiMTAwJVwiIHkyPVwiMTAwJVwiPlxuICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiMzZjNmNDZcIi8+XG4gICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiNTAlXCIgc3RvcC1jb2xvcj1cIiMyNzI3MmFcIi8+XG4gICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMTAwJVwiIHN0b3AtY29sb3I9XCIjMTgxODFiXCIvPlxuICAgICAgICA8L2xpbmVhckdyYWRpZW50PlxuICAgICAgICA8ZmlsdGVyIGlkPVwicGhvbmVTaGFkb3dcIiB4PVwiLTIwJVwiIHk9XCItMTAlXCIgd2lkdGg9XCIxNDAlXCIgaGVpZ2h0PVwiMTMwJVwiPlxuICAgICAgICAgIDxmZURyb3BTaGFkb3cgZHg9XCIwXCIgZHk9XCIyMFwiIHN0ZERldmlhdGlvbj1cIjIyXCIgZmxvb2QtY29sb3I9XCIjMDAwXCIgZmxvb2Qtb3BhY2l0eT1cIjAuNVwiLz5cbiAgICAgICAgPC9maWx0ZXI+XG4gICAgICA8L2RlZnM+XG4gICAgICA8ZyBmaWx0ZXI9XCJ1cmwoI3Bob25lU2hhZG93KVwiPlxuICAgICAgICA8cmVjdCB4PVwiNFwiIHk9XCI0XCIgd2lkdGg9XCIzODJcIiBoZWlnaHQ9XCI4MzZcIiByeD1cIjU4XCIgZmlsbD1cInVybCgjZnJhbWVHcmFkKVwiIHN0cm9rZT1cIiM1MjUyNWJcIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICAgICAgICA8cmVjdCB4PVwiMTBcIiB5PVwiMTBcIiB3aWR0aD1cIjM3MFwiIGhlaWdodD1cIjgyNFwiIHJ4PVwiNTJcIiBmaWxsPVwiIzA5MDkwYlwiIHN0cm9rZT1cIiMzZjNmNDZcIiBzdHJva2Utd2lkdGg9XCIxXCIvPlxuICAgICAgICA8ZyBjbGlwLXBhdGg9XCJ1cmwoIyR7Y2xpcElkfSlcIj4ke3NjcmVlbkh0bWx9PC9nPlxuICAgICAgICA8cmVjdCB4PVwiMTI4XCIgeT1cIjI0XCIgd2lkdGg9XCIxMzRcIiBoZWlnaHQ9XCIzNlwiIHJ4PVwiMThcIiBmaWxsPVwiIzAwMFwiLz5cbiAgICAgICAgPHJlY3QgeD1cIjM3MlwiIHk9XCIyMDBcIiB3aWR0aD1cIjRcIiBoZWlnaHQ9XCI1MlwiIHJ4PVwiMlwiIGZpbGw9XCIjM2YzZjQ2XCIvPlxuICAgICAgICA8cmVjdCB4PVwiMzcyXCIgeT1cIjI3OFwiIHdpZHRoPVwiNFwiIGhlaWdodD1cIjgwXCIgcng9XCIyXCIgZmlsbD1cIiMzZjNmNDZcIi8+XG4gICAgICAgIDxyZWN0IHg9XCIxNFwiIHk9XCIyNjhcIiB3aWR0aD1cIjRcIiBoZWlnaHQ9XCI0NFwiIHJ4PVwiMlwiIGZpbGw9XCIjM2YzZjQ2XCIvPlxuICAgICAgPC9nPlxuICAgIDwvc3ZnPlxuICBgO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGhvbmVIZWlnaHRGb3JXaWR0aCh3aWR0aDogbnVtYmVyKSB7XG4gIHJldHVybiBNYXRoLnJvdW5kKHdpZHRoICogKEZSQU1FX0ggLyBGUkFNRV9XKSk7XG59IiwiLy8gRmVhdHVyZSBMYXVuY2gg4oCUIG1vYmlsZSBhcHAgYW5ub3VuY2VtZW50IHNwb3Rcbi8vIERlbW9uc3RyYXRlczogc3RkLmxheWVycygpLCBjdHguZGlyZWN0b3IoKSwgc3RkLnJldmVhbC4qLCBTVkcgaVBob25lICsgaW4tYXBwIFVJLCByZXNwb25zaXZlIG91dHB1dHNcblxuaW1wb3J0IHsgZGVmaW5lIH0gZnJvbSBcInN1cGVyaW1nXCI7XG5pbXBvcnQgeyBsb3dlclRoaXJkT3ZlcmxheSB9IGZyb20gXCIuLi8uLi9iYXNpY3MvbGF5ZXItc2hvdHMvc2hvdHNcIjtcbmltcG9ydCB7IGJ1aWxkQXBwU2NyZWVuLCBidWlsZElwaG9uZVN2ZywgdHlwZSBBcHBTY3JlZW4gfSBmcm9tIFwiLi9kZXZpY2VcIjtcblxuY29uc3QgUEhPTkVfQVNQRUNUID0gMzkwIC8gODQ0O1xuXG5pbnRlcmZhY2UgRmVhdHVyZSB7XG4gIGljb246IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgZGVzYzogc3RyaW5nO1xufVxuXG5jb25zdCBTVEVBRFlfTU9USU9OID0gXCJvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMHB4KVwiO1xuY29uc3QgSU5UUk9fV0lQRV9TRUMgPSBcIjFzXCI7XG5jb25zdCBURVhUX1NIQURPVyA9IFwiMCAycHggMTZweCByZ2JhKDAsMCwwLDAuNTUpLCAwIDFweCAzcHggcmdiYSgwLDAsMCwwLjQ1KVwiO1xuY29uc3QgQUNDRU5UX0xJR0hUID0gXCIjYTVmM2ZjXCI7XG5jb25zdCBTQ1JJTV9MRUZUID0gXCJsaW5lYXItZ3JhZGllbnQoOTBkZWcsIHJnYmEoNiw4LDIwLDAuODgpIDAlLCByZ2JhKDYsOCwyMCwwLjYyKSAzOCUsIHJnYmEoNiw4LDIwLDAuMTgpIDYyJSwgdHJhbnNwYXJlbnQgMTAwJSlcIjtcbmNvbnN0IFNDUklNX0NFTlRFUiA9IFwicmFkaWFsLWdyYWRpZW50KGVsbGlwc2UgOTAlIDgwJSBhdCA1MCUgNDUlLCByZ2JhKDYsOCwyMCwwLjgyKSAwJSwgcmdiYSg2LDgsMjAsMC40OCkgNTUlLCByZ2JhKDYsOCwyMCwwLjIpIDEwMCUpXCI7XG5jb25zdCBBUFBfQkcgPSBcInJhZGlhbC1ncmFkaWVudChlbGxpcHNlIDEyMCUgOTAlIGF0IDcwJSAyMCUsIHJnYmEoMzQsMjExLDIzOCwwLjE4KSAwJSwgdHJhbnNwYXJlbnQgNTUlKSwgcmFkaWFsLWdyYWRpZW50KGVsbGlwc2UgODAlIDcwJSBhdCAyMCUgODAlLCByZ2JhKDE2OCw4NSwyNDcsMC4xNCkgMCUsIHRyYW5zcGFyZW50IDUwJSksIGxpbmVhci1ncmFkaWVudCgxNjBkZWcsICMwNjA4MGYgMCUsICMwYzEyMjIgNDUlLCAjMTExODI3IDEwMCUpXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZSh7XG4gIHNhbXBsZToge1xuICAgIHByb2R1Y3ROYW1lOiBcIlB1bHNlXCIsXG4gICAgdGFnbGluZTogXCJIYWJpdHMgdGhhdCBhY3R1YWxseSBzdGlja1wiLFxuICAgIGhvb2s6IFwiWW91ciBnb2Fscywgb25lIHRhcCBhd2F5LlwiLFxuICAgIGhvb2tTdWI6IFwiVHJhY2sgcm91dGluZXMsIHN0cmVha3MsIGFuZCB3aW5zIOKAlCB3aXRob3V0IHRoZSBndWlsdCB0cmlwLlwiLFxuICAgIGZlYXR1cmVzOiBbXG4gICAgICB7IGljb246IFwiU1wiLCB0aXRsZTogXCJEYWlseSBzdHJlYWtzXCIsIGRlc2M6IFwiTW9tZW50dW0geW91IGNhbiBzZWVcIiB9LFxuICAgICAgeyBpY29uOiBcIlJcIiwgdGl0bGU6IFwiU21hcnQgcmVtaW5kZXJzXCIsIGRlc2M6IFwiTnVkZ2VzIGF0IHRoZSByaWdodCB0aW1lXCIgfSxcbiAgICAgIHsgaWNvbjogXCJJXCIsIHRpdGxlOiBcIldlZWtseSBpbnNpZ2h0c1wiLCBkZXNjOiBcIlBhdHRlcm5zIGF0IGEgZ2xhbmNlXCIgfSxcbiAgICBdIGFzIEZlYXR1cmVbXSxcbiAgICBtZXRyaWM6IHsgbGFiZWw6IFwiRG93bmxvYWRzIHRoaXMgd2Vla1wiLCB2YWx1ZTogMTI4LCBzdWZmaXg6IFwiSytcIiB9LFxuICAgIGN0YTogeyB0ZXh0OiBcIkRvd25sb2FkIGZyZWVcIiwgdXJsOiBcInB1bHNlLmFwcFwiIH0sXG4gICAgYWNjZW50Q29sb3I6IFwiIzIyZDNlZVwiLFxuICB9LFxuXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjE2c1wiLFxuICAgIGZvbnRzOiBbXCJJbnRlcjp3Z2h0QDQwMDs1MDA7NjAwOzcwMDs4MDBcIl0sXG4gICAgYXVkaW86IHtcbiAgICAgIGlkOiBcImJlZFwiLFxuICAgICAgc3JjOiBcIi4uLy4uL19hc3NldHMvbG9maS1iZy5tcDNcIixcbiAgICAgIHJvbGU6IFwibXVzaWNcIixcbiAgICAgIHZvbHVtZTogMC40NSxcbiAgICAgIGZhZGVJbjogXCIwLjVzXCIsXG4gICAgICBmYWRlT3V0OiBcIjJzXCIsXG4gICAgICBsb29wOiB0cnVlLFxuICAgIH0sXG4gICAgb3V0cHV0czoge1xuICAgICAgbGFuZHNjYXBlOiB7IHdpZHRoOiAxOTIwLCBoZWlnaHQ6IDEwODAgfSxcbiAgICAgIHNxdWFyZTogeyB3aWR0aDogMTA4MCwgaGVpZ2h0OiAxMDgwIH0sXG4gICAgICBzdG9yeTogeyB3aWR0aDogMTA4MCwgaGVpZ2h0OiAxOTIwIH0sXG4gICAgfSxcbiAgICBpbmxpbmVDc3M6IFtgXG4gICAgICAqIHsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgICBib2R5IHsgZm9udC1mYW1pbHk6ICdJbnRlcicsIHNhbnMtc2VyaWY7IG92ZXJmbG93OiBoaWRkZW47IH1cbiAgICAgIC5ob29rLWxpbmUgeyBmb250LXdlaWdodDogODAwOyBjb2xvcjogI2ZmZjsgbGV0dGVyLXNwYWNpbmc6IC0wLjAzZW07IGxpbmUtaGVpZ2h0OiAxLjA1OyB0ZXh0LXNoYWRvdzogJHtURVhUX1NIQURPV307IH1cbiAgICAgIC5ob29rLXN1YiB7IGZvbnQtd2VpZ2h0OiA1MDA7IGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuOSk7IGxpbmUtaGVpZ2h0OiAxLjQ7IHRleHQtc2hhZG93OiAwIDFweCAxMHB4IHJnYmEoMCwwLDAsMC41KTsgfVxuICAgICAgLmZlYXR1cmUtY2FyZCB7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0O1xuICAgICAgICBnYXA6IDE2cHg7XG4gICAgICAgIGJhY2tncm91bmQ6IHJnYmEoOCwxMCwyMiwwLjc4KTtcbiAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjE0KTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogMTZweDtcbiAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDE0cHgpO1xuICAgICAgICBib3gtc2hhZG93OiAwIDhweCAzMnB4IHJnYmEoMCwwLDAsMC4zNSk7XG4gICAgICB9XG4gICAgICAuZmVhdHVyZS1pY29uIHtcbiAgICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgICBmb250LXNpemU6IDIycHg7XG4gICAgICB9XG4gICAgICAuZmVhdHVyZS10aXRsZSB7IGZvbnQtd2VpZ2h0OiA3MDA7IGNvbG9yOiAjZmZmOyB9XG4gICAgICAuZmVhdHVyZS1kZXNjIHsgZm9udC13ZWlnaHQ6IDQwMDsgY29sb3I6IHJnYmEoMjU1LDI1NSwyNTUsMC44NCk7IG1hcmdpbi10b3A6IDRweDsgfVxuICAgICAgLm1ldHJpYy1sYWJlbCB7IGZvbnQtd2VpZ2h0OiA2MDA7IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7IGxldHRlci1zcGFjaW5nOiAwLjEyZW07IGNvbG9yOiByZ2JhKDI1NSwyNTUsMjU1LDAuNzIpOyB9XG4gICAgICAubWV0cmljLXZhbHVlIHsgZm9udC13ZWlnaHQ6IDgwMDsgY29sb3I6ICNmZmY7IGZvbnQtdmFyaWFudC1udW1lcmljOiB0YWJ1bGFyLW51bXM7IHRleHQtc2hhZG93OiAke1RFWFRfU0hBRE9XfTsgfVxuICAgICAgLnByb2R1Y3QtYmFkZ2UgeyBmb250LXdlaWdodDogNzAwOyBsZXR0ZXItc3BhY2luZzogMC4wNGVtOyB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlOyB9XG4gICAgICAuY3RhLXBhbmVsIHtcbiAgICAgICAgYmFja2Ryb3AtZmlsdGVyOiBibHVyKDI0cHgpO1xuICAgICAgICBiYWNrZ3JvdW5kOiByZ2JhKDgsMTAsMjQsMC44Mik7XG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xNik7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDI4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMjRweCA4MHB4IHJnYmEoMCwwLDAsMC41NSk7XG4gICAgICB9XG4gICAgICAuY3RhLWtpY2tlciB7XG4gICAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICAgIGxldHRlci1zcGFjaW5nOiAwLjE0ZW07XG4gICAgICAgIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7XG4gICAgICAgIGNvbG9yOiAke0FDQ0VOVF9MSUdIVH07XG4gICAgICB9XG4gICAgICAuY3RhLWhlYWRsaW5lIHsgZm9udC13ZWlnaHQ6IDgwMDsgY29sb3I6ICNmZmY7IGxldHRlci1zcGFjaW5nOiAtMC4wM2VtOyBsaW5lLWhlaWdodDogMS4wNTsgdGV4dC1zaGFkb3c6ICR7VEVYVF9TSEFET1d9OyB9XG4gICAgICAuY3RhLXRhZ2xpbmUgeyBmb250LXdlaWdodDogNTAwOyBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjg4KTsgbGluZS1oZWlnaHQ6IDEuNDU7IH1cbiAgICAgIC5jdGEtYnRuIHsgZm9udC13ZWlnaHQ6IDcwMDsgY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDE0cHg7IGRpc3BsYXk6IGlubGluZS1ibG9jazsgfVxuICAgICAgLmN0YS11cmwgeyBmb250LXdlaWdodDogNjAwOyBjb2xvcjogcmdiYSgyNTUsMjU1LDI1NSwwLjkyKTsgZm9udC1mYW1pbHk6ICdJbnRlcicsIG1vbm9zcGFjZTsgfVxuICAgICAgLnVybC1waWxsIHtcbiAgICAgICAgYmFja2dyb3VuZDogcmdiYSg4LDEwLDIyLDAuODgpO1xuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMTIpO1xuICAgICAgICBib3JkZXItcmFkaXVzOiAxMnB4O1xuICAgICAgICBwYWRkaW5nOiAxMnB4IDE4cHg7XG4gICAgICAgIGJhY2tkcm9wLWZpbHRlcjogYmx1cigxMHB4KTtcbiAgICAgIH1cbiAgICAgIC5zdG9yZS1iYWRnZSB7XG4gICAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgICBnYXA6IDEwcHg7XG4gICAgICAgIGJhY2tncm91bmQ6IHJnYmEoMjU1LDI1NSwyNTUsMC4wOCk7XG4gICAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xNCk7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDE0cHg7XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMThweDtcbiAgICAgICAgbWFyZ2luLXRvcDogMjBweDtcbiAgICAgIH1cbiAgICBgXSxcbiAgfSxcblxuICByZW5kZXIoY3R4KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIGRhdGEsIGlzUG9ydHJhaXQgfSA9IGN0eDtcbiAgICBjb25zdCB7XG4gICAgICBwcm9kdWN0TmFtZSxcbiAgICAgIHRhZ2xpbmUsXG4gICAgICBob29rLFxuICAgICAgaG9va1N1YixcbiAgICAgIGZlYXR1cmVzLFxuICAgICAgbWV0cmljLFxuICAgICAgY3RhLFxuICAgICAgYWNjZW50Q29sb3IsXG4gICAgfSA9IGRhdGE7XG5cbiAgICBjb25zdCByID0gc3RkLmNyZWF0ZVJlc3BvbnNpdmUoY3R4KTtcbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHsgaG9vazogXCIzLjVzXCIsIGZlYXR1cmVzOiBcIjdzXCIsIGN0YTogXCI1LjVzXCIgfSk7XG4gICAgY29uc3QgTCA9IHN0ZC5sYXllcnMoeyB3aWR0aCwgaGVpZ2h0LCBtb2RlOiBcIm9wYXF1ZVwiIH0pO1xuXG4gICAgY29uc3QgYnJhbmQgPSB7IHByb2R1Y3ROYW1lLCB0YWdsaW5lLCBhY2NlbnRDb2xvciwgYWNjZW50TGlnaHQ6IEFDQ0VOVF9MSUdIVCB9O1xuXG4gICAgY29uc3QgZmVhdHVyZXNMb2NhbExpdmUgPSB0LmluKFwiZmVhdHVyZXNcIik7XG5cbiAgICAvKiogU2l6ZSBwaG9uZSBmcm9tIGZyYW1lIGhlaWdodCBzbyBpdCBzY2FsZXMgYWNyb3NzIG91dHB1dHMgKi9cbiAgICBmdW5jdGlvbiBwaG9uZVdpZHRoKCkge1xuICAgICAgY29uc3QgbWF4SCA9IHIoe1xuICAgICAgICBwb3J0cmFpdDogaGVpZ2h0ICogMC4zNCxcbiAgICAgICAgc3F1YXJlOiBoZWlnaHQgKiAwLjU0LFxuICAgICAgICBkZWZhdWx0OiBoZWlnaHQgKiAwLjc2LFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gTWF0aC5yb3VuZChtYXhIICogUEhPTkVfQVNQRUNUKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmZWF0dXJlU3RhZ2dlcklucHV0KGZlYXR1cmVzTG9jYWw6IG51bWJlcikge1xuICAgICAgcmV0dXJuIHN0ZC5pbnRlcnBvbGF0ZShmZWF0dXJlc0xvY2FsLCBbMC4wNiwgMC4xOF0sIFswLCAxXSwgXCJsaW5lYXJcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmVhdHVyZUhpZ2hsaWdodChmZWF0dXJlc0xvY2FsOiBudW1iZXIpIHtcbiAgICAgIHJldHVybiBzdGQuc3RhZ2dlci5sZWFkKGZlYXR1cmVzLCBmZWF0dXJlU3RhZ2dlcklucHV0KGZlYXR1cmVzTG9jYWwpLCB7IGR1cmF0aW9uOiAwLjQ4IH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkUGhvbmUoXG4gICAgICBzY3JlZW46IEFwcFNjcmVlbixcbiAgICAgIG1vdGlvblN0eWxlOiBzdHJpbmcsXG4gICAgICBvcHRzOiB7IGhpZ2hsaWdodD86IG51bWJlcjsgc3RyZWFrPzogbnVtYmVyIH0gPSB7fSxcbiAgICApIHtcbiAgICAgIGNvbnN0IHNjcmVlbkh0bWwgPSBidWlsZEFwcFNjcmVlbihzY3JlZW4sIGJyYW5kLCBmZWF0dXJlcywgb3B0cyk7XG4gICAgICBjb25zdCBzdmcgPSBidWlsZElwaG9uZVN2ZyhzY3JlZW5IdG1sLCBwaG9uZVdpZHRoKCksIGBjbGlwLSR7c2NyZWVufWApO1xuICAgICAgcmV0dXJuIGA8ZGl2IHN0eWxlPVwiJHttb3Rpb25TdHlsZX1cIj4ke3N2Z308L2Rpdj5gO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBob25lT3ZlcmxheU9wdHMoKSB7XG4gICAgICBpZiAoaXNQb3J0cmFpdCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGFuY2hvcjogeyB4OiBcIjUwJVwiLCB5OiBcIjY2JVwiLCBvcmlnaW46IFwiY2VudGVyXCIgYXMgY29uc3QgfSxcbiAgICAgICAgICBvZmZzZXQ6IHsgeDogMCwgeTogMCB9LFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYW5jaG9yOiB7IHg6IFwiNzMlXCIsIHk6IFwiNTAlXCIsIG9yaWdpbjogXCJjZW50ZXJcIiBhcyBjb25zdCB9LFxuICAgICAgICBvZmZzZXQ6IHsgeDogMCwgeTogMCB9LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0ZXh0SW5zZXQoKSB7XG4gICAgICByZXR1cm4gaXNQb3J0cmFpdFxuICAgICAgICA/IHsgdG9wOiBcIjE0JVwiLCBsZWZ0OiA0OCwgcmlnaHQ6IDQ4LCBib3R0b206IFwiNTYlXCIgfSAvLyBSZXNwZWN0IDEyJSB0b3AgZGVhZCB6b25lXG4gICAgICAgIDogeyB0b3A6IFwiMjAlXCIsIGxlZnQ6IFwiNyVcIiwgcmlnaHQ6IFwiNDglXCIsIGJvdHRvbTogXCIxNiVcIiB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkSG9va0NvbnRlbnQoKSB7XG4gICAgICBjb25zdCBoZWFkbGluZVN0eWxlID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwiaG9va1wiLCBhdDogXCIwLjJzXCIsIGZvcjogXCIwLjVzXCIsIHk6IDMyLCBlYXNpbmc6IFwiZWFzZU91dEN1YmljXCIgfSkuc3R5bGU7XG4gICAgICBjb25zdCBzdWJTdHlsZSA9IHQubW90aW9uKHsgZHVyaW5nOiBcImhvb2tcIiwgYXQ6IFwiMC4zc1wiLCBmb3I6IFwiMC41c1wiLCB5OiAyMiwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pLnN0eWxlO1xuXG4gICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgdGV4dEFsaWduOiBpc1BvcnRyYWl0ID8gXCJjZW50ZXJcIiA6IFwibGVmdFwiLCBtYXhXaWR0aDogcih7IHBvcnRyYWl0OiBcIjEwMCVcIiwgZGVmYXVsdDogXCIxMDAlXCIgfSkgfSl9XCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImhvb2stbGluZVwiIHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogNTIsIHNxdWFyZTogNDAsIGRlZmF1bHQ6IDU4IH0pIH0pfTsgJHtoZWFkbGluZVN0eWxlfVwiPiR7aG9va308L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiaG9vay1zdWJcIiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDI0LCBzcXVhcmU6IDIwLCBkZWZhdWx0OiAyNiB9KSwgbWFyZ2luVG9wOiAyMCB9KX07ICR7c3ViU3R5bGV9XCI+JHtob29rU3VifTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIGA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGRIb29rU2hvdChpbnRyb1dpcGU/OiBSZXR1cm5UeXBlPHR5cGVvZiBzdGQucmV2ZWFsLndpcGU+KSB7XG4gICAgICBjb25zdCBwaG9uZU1vdGlvbiA9IHQubW90aW9uKHsgZHVyaW5nOiBcImhvb2tcIiwgYXQ6IFwiMHNcIiwgZm9yOiBcIjAuNnNcIiwgc2NhbGU6IDAuOTQsIGVhc2luZzogXCJlYXNlT3V0RXhwb1wiIH0pLnN0eWxlO1xuICAgICAgY29uc3QgbGF5ZXJzID0gW1xuICAgICAgICBMLmJnKEFQUF9CRyksXG4gICAgICAgIEwudGludChpc1BvcnRyYWl0ID8gU0NSSU1fQ0VOVEVSIDogU0NSSU1fTEVGVCksXG4gICAgICAgIEwuY29udGVudChidWlsZEhvb2tDb250ZW50KCksIHsgc2FmZTogXCJicm9hZGNhc3RcIiwgaW5zZXQ6IHRleHRJbnNldCgpIH0pLFxuICAgICAgICBMLm92ZXJsYXkoYnVpbGRQaG9uZShcInNwbGFzaFwiLCBwaG9uZU1vdGlvbiksIHBob25lT3ZlcmxheU9wdHMoKSksXG4gICAgICBdO1xuXG4gICAgICBpZiAoaW50cm9XaXBlPy5hY3RpdmUpIHtcbiAgICAgICAgbGF5ZXJzLnB1c2goTC5meChpbnRyb1dpcGUuaHRtbCwgeyB2aXNpYmxlOiAoKSA9PiBpbnRyb1dpcGUuYWN0aXZlIH0pKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIEwucmVuZGVyKC4uLmxheWVycyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGRGZWF0dXJlc0NvbnRlbnQoZmVhdHVyZXNMb2NhbDogbnVtYmVyKSB7XG4gICAgICAvLyBGZWF0dXJlcyBwaGFzZSB+c2Vjb25kcyBmcm9tIGRpcmVjdG9yOyBjYXNjYWRlIGNhcHBlZCBhdCA1MDBtc1xuICAgICAgY29uc3QgZmVhdHVyZUVudGVyUCA9IHN0ZC5zdGFnZ2VyLm1zKGZlYXR1cmVzLmxlbmd0aCwgZmVhdHVyZVN0YWdnZXJJbnB1dChmZWF0dXJlc0xvY2FsKSwge1xuICAgICAgICB3aW5kb3dTZWNvbmRzOiA0LFxuICAgICAgICBlYWNoTXM6IDcwLFxuICAgICAgICBjYXBNczogNTAwLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IG1ldHJpY0NvdW50ID0gTWF0aC5mbG9vcihcbiAgICAgICAgdC50d2VlbigwLCBtZXRyaWMudmFsdWUsIHsgZHVyaW5nOiBcImZlYXR1cmVzXCIsIGF0OiBcIjEuNXNcIiwgZm9yOiBcIjEuMHNcIiwgZWFzaW5nOiBcImVhc2VPdXRRdWFydFwiIH0pLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IG1ldHJpY1N0eWxlID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwiZmVhdHVyZXNcIiwgYXQ6IFwiMS41c1wiLCBmb3I6IFwiMC42c1wiLCBzY2FsZTogMC45MiwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pLnN0eWxlO1xuICAgICAgY29uc3QgYmFkZ2VTdHlsZSA9IHQubW90aW9uKHsgZHVyaW5nOiBcImZlYXR1cmVzXCIsIGF0OiBcIjAuNHNcIiwgZm9yOiBcIjAuNXNcIiwgeTogLTE2LCBlYXNpbmc6IFwiZWFzZU91dEN1YmljXCIgfSkuc3R5bGU7XG5cbiAgICAgIGNvbnN0IGZlYXR1cmVDYXJkcyA9IGZlYXR1cmVzXG4gICAgICAgIC5tYXAoKGY6IEZlYXR1cmUsIGk6IG51bWJlcikgPT4ge1xuICAgICAgICAgIGNvbnN0IHAgPSBmZWF0dXJlRW50ZXJQW2ldO1xuICAgICAgICAgIGNvbnN0IHNsaWRlWSA9IHN0ZC5pbnRlcnBvbGF0ZShwLCBbMCwgMV0sIFsyOCwgMF0sIFwiZWFzZU91dEN1YmljXCIpO1xuICAgICAgICAgIGNvbnN0IG9wYWNpdHkgPSBzdGQuaW50ZXJwb2xhdGUocCwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuICAgICAgICAgIGNvbnN0IGNhcmRQYWQgPSByKHsgcG9ydHJhaXQ6IFwiMThweCAyMHB4XCIsIGRlZmF1bHQ6IFwiMjBweCAyNHB4XCIgfSk7XG4gICAgICAgICAgcmV0dXJuIGBcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmZWF0dXJlLWNhcmRcIiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICAgIHBhZGRpbmc6IGNhcmRQYWQsXG4gICAgICAgICAgICAgIG1hcmdpbkJvdHRvbTogcih7IHBvcnRyYWl0OiAxNCwgZGVmYXVsdDogMTYgfSksXG4gICAgICAgICAgICAgIG9wYWNpdHksXG4gICAgICAgICAgICAgIHRyYW5zZm9ybTogYHRyYW5zbGF0ZVkoJHtzbGlkZVl9cHgpYCxcbiAgICAgICAgICAgIH0pfVwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmVhdHVyZS1pY29uXCIgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgICAgIHdpZHRoOiByKHsgcG9ydHJhaXQ6IDQ0LCBkZWZhdWx0OiA0OCB9KSxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHIoeyBwb3J0cmFpdDogNDQsIGRlZmF1bHQ6IDQ4IH0pLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHN0ZC5jb2xvci5hbHBoYShhY2NlbnRDb2xvciwgMC40MiksXG4gICAgICAgICAgICAgICAgY29sb3I6IEFDQ0VOVF9MSUdIVCxcbiAgICAgICAgICAgICAgICBib3JkZXI6IGAxcHggc29saWQgJHtzdGQuY29sb3IuYWxwaGEoYWNjZW50Q29sb3IsIDAuNTUpfWAsXG4gICAgICAgICAgICAgIH0pfVwiPiR7Zi5pY29ufTwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmZWF0dXJlLXRpdGxlXCIgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogcih7IHBvcnRyYWl0OiAyMiwgZGVmYXVsdDogMjYgfSkgfSl9XCI+JHtmLnRpdGxlfTwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJmZWF0dXJlLWRlc2NcIiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDE2LCBkZWZhdWx0OiAxOCB9KSB9KX1cIj4ke2YuZGVzY308L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBgO1xuICAgICAgICB9KVxuICAgICAgICAuam9pbihcIlwiKTtcblxuICAgICAgY29uc3QgZmVhdHVyZXNIdG1sID0gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGg6IFwiMTAwJVwiIH0pfVwiPlxuICAgICAgICAgICR7ZmVhdHVyZUNhcmRzfVxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBtYXJnaW5Ub3A6IHIoeyBwb3J0cmFpdDogMjgsIGRlZmF1bHQ6IDM2IH0pIH0pfTsgJHttZXRyaWNTdHlsZX1cIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRyaWMtbGFiZWxcIiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDEyLCBkZWZhdWx0OiAxMyB9KSB9KX1cIj4ke21ldHJpYy5sYWJlbH08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRyaWMtdmFsdWVcIiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDUyLCBzcXVhcmU6IDQ0LCBkZWZhdWx0OiA2NCB9KSwgbWFyZ2luVG9wOiA2IH0pfVwiPlxuICAgICAgICAgICAgICAke21ldHJpY0NvdW50fTxzcGFuIHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogMjgsIGRlZmF1bHQ6IDM2IH0pLCBjb2xvcjogQUNDRU5UX0xJR0hUIH0pfVwiPiR7bWV0cmljLnN1ZmZpeH08L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICBgO1xuXG4gICAgICBjb25zdCBiYWRnZUh0bWwgPSBgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJwcm9kdWN0LWJhZGdlXCIgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgIGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDEzLCBkZWZhdWx0OiAxNCB9KSxcbiAgICAgICAgICBjb2xvcjogXCIjZmZmXCIsXG4gICAgICAgICAgYmFja2dyb3VuZDogXCJyZ2JhKDgsMTAsMjIsMC45KVwiLFxuICAgICAgICAgIHBhZGRpbmc6IFwiOHB4IDE2cHhcIixcbiAgICAgICAgICBib3JkZXJSYWRpdXM6IDk5OSxcbiAgICAgICAgICBib3JkZXI6IGAxcHggc29saWQgJHtzdGQuY29sb3IuYWxwaGEoYWNjZW50Q29sb3IsIDAuNjUpfWAsXG4gICAgICAgICAgYm94U2hhZG93OiBgMCA0cHggMjBweCByZ2JhKDAsMCwwLDAuNClgLFxuICAgICAgICB9KX07ICR7YmFkZ2VTdHlsZX1cIj4ke3Byb2R1Y3ROYW1lfTwvZGl2PlxuICAgICAgYDtcblxuICAgICAgcmV0dXJuIHsgZmVhdHVyZXNIdG1sLCBiYWRnZUh0bWwgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBidWlsZEZlYXR1cmVzU2hvdChmZWF0dXJlc0xvY2FsOiBudW1iZXIpIHtcbiAgICAgIGNvbnN0IHsgZmVhdHVyZXNIdG1sLCBiYWRnZUh0bWwgfSA9IGJ1aWxkRmVhdHVyZXNDb250ZW50KGZlYXR1cmVzTG9jYWwpO1xuICAgICAgY29uc3QgaGlnaGxpZ2h0ID0gZmVhdHVyZUhpZ2hsaWdodChmZWF0dXJlc0xvY2FsKTtcblxuICAgICAgcmV0dXJuIEwucmVuZGVyKFxuICAgICAgICBMLmJnKEFQUF9CRyksXG4gICAgICAgIEwudGludChpc1BvcnRyYWl0ID8gU0NSSU1fQ0VOVEVSIDogU0NSSU1fTEVGVCksXG4gICAgICAgIEwudGludChzdGQuY29sb3IuYWxwaGEoYWNjZW50Q29sb3IsIDAuMDUpKSxcbiAgICAgICAgTC5jb250ZW50KGZlYXR1cmVzSHRtbCwgeyBzYWZlOiBcImJyb2FkY2FzdFwiLCBpbnNldDogdGV4dEluc2V0KCkgfSksXG4gICAgICAgIEwub3ZlcmxheShidWlsZFBob25lKFwiZmVhdHVyZXNcIiwgU1RFQURZX01PVElPTiwgeyBoaWdobGlnaHQgfSksIHBob25lT3ZlcmxheU9wdHMoKSksXG4gICAgICAgIEwub3ZlcmxheShiYWRnZUh0bWwsIHtcbiAgICAgICAgICBhbmNob3I6IFwidG9wLWxlZnRcIixcbiAgICAgICAgICBvZmZzZXQ6IHsgeDogcih7IHBvcnRyYWl0OiA0MCwgZGVmYXVsdDogNjQgfSksIHk6IHIoeyBwb3J0cmFpdDogNTYsIGRlZmF1bHQ6IDQ4IH0pIH0sXG4gICAgICAgICAgc2FmZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkRmVhdHVyZXNQYW5lbChmZWF0dXJlc0xvY2FsOiBudW1iZXIpIHtcbiAgICAgIGNvbnN0IHsgZmVhdHVyZXNIdG1sLCBiYWRnZUh0bWwgfSA9IGJ1aWxkRmVhdHVyZXNDb250ZW50KGZlYXR1cmVzTG9jYWwpO1xuXG4gICAgICByZXR1cm4gTC5yZW5kZXIoXG4gICAgICAgIEwudGludChpc1BvcnRyYWl0ID8gU0NSSU1fQ0VOVEVSIDogU0NSSU1fTEVGVCksXG4gICAgICAgIEwudGludChzdGQuY29sb3IuYWxwaGEoYWNjZW50Q29sb3IsIDAuMDUpKSxcbiAgICAgICAgTC5jb250ZW50KGZlYXR1cmVzSHRtbCwgeyBzYWZlOiBcImJyb2FkY2FzdFwiLCBpbnNldDogdGV4dEluc2V0KCkgfSksXG4gICAgICAgIEwub3ZlcmxheShiYWRnZUh0bWwsIHtcbiAgICAgICAgICBhbmNob3I6IFwidG9wLWxlZnRcIixcbiAgICAgICAgICBvZmZzZXQ6IHsgeDogcih7IHBvcnRyYWl0OiA0MCwgZGVmYXVsdDogNjQgfSksIHk6IHIoeyBwb3J0cmFpdDogNTYsIGRlZmF1bHQ6IDQ4IH0pIH0sXG4gICAgICAgICAgc2FmZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJ1aWxkSG9va1BhbmVsKCkge1xuICAgICAgcmV0dXJuIEwucmVuZGVyKFxuICAgICAgICBMLnRpbnQoaXNQb3J0cmFpdCA/IFNDUklNX0NFTlRFUiA6IFNDUklNX0xFRlQpLFxuICAgICAgICBMLmNvbnRlbnQoYnVpbGRIb29rQ29udGVudCgpLCB7IHNhZmU6IFwiYnJvYWRjYXN0XCIsIGluc2V0OiB0ZXh0SW5zZXQoKSB9KSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGRDdGFDb250ZW50KGQ6IHR5cGVvZiB0KSB7XG4gICAgICBjb25zdCBraWNrZXJTdHlsZSA9IGQubW90aW9uKHsgYXQ6IFwiMC4xc1wiLCBmb3I6IFwiMC41c1wiLCB5OiAxNCwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pLnN0eWxlO1xuICAgICAgY29uc3QgaGVhZGxpbmVTdHlsZSA9IGQubW90aW9uKHsgYXQ6IFwiMC4yc1wiLCBmb3I6IFwiMC42c1wiLCB5OiAyOCwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pLnN0eWxlO1xuICAgICAgY29uc3QgdGFnU3R5bGUgPSBkLm1vdGlvbih7IGF0OiBcIjAuM3NcIiwgZm9yOiBcIjAuNXNcIiwgeTogMTgsIGVhc2luZzogXCJlYXNlT3V0Q3ViaWNcIiB9KS5zdHlsZTtcbiAgICAgIGNvbnN0IGJ0blN0eWxlID0gZC5tb3Rpb24oeyBhdDogXCIwLjVzXCIsIGZvcjogXCIwLjVzXCIsIHNjYWxlOiAwLjksIGVhc2luZzogXCJlYXNlT3V0QmFja1wiIH0pLnN0eWxlO1xuXG4gICAgICBjb25zdCBzdG9yZUJhZGdlID0gYFxuICAgICAgICA8ZGl2IGNsYXNzPVwic3RvcmUtYmFkZ2VcIiBzdHlsZT1cIiR7YnRuU3R5bGV9XCI+XG4gICAgICAgICAgPHN2ZyB3aWR0aD1cIjIyXCIgaGVpZ2h0PVwiMjJcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTTE4LjcxIDE5LjVjLS44MyAxLjI0LTEuNzEgMi40NS0zLjA1IDIuNDctMS4zNC4wMy0xLjc3LS43OS0zLjI5LS43OS0xLjUzIDAtMiAuNzctMy4yNy44Mi0xLjMxLjA1LTIuMy0xLjMyLTMuMTQtMi41M0M0LjI1IDE3IDIuOTQgMTIuNDUgNC43IDkuMzljLjg3LTEuNTIgMi40My0yLjQ4IDQuMTItMi41MSAxLjI4LS4wMiAyLjUuODcgMy4yOS44Ny43OCAwIDIuMjYtMS4wNyAzLjgtLjkxLjY1LjAzIDIuNDcuMjYgMy42NCAxLjk4LS4wOS4wNi0yLjE3IDEuMjgtMi4xNSAzLjgxLjAzIDMuMDIgMi42NSA0LjAzIDIuNjggNC4wNC0uMDMuMDctLjQyIDEuNDQtMS4zOCAyLjgzek0xMyAzLjVjLjczLS44MyAxLjk0LTEuNDYgMi45NC0xLjUuMTMgMS4xNy0uMzQgMi4zNS0xLjA0IDMuMTktLjY5Ljg1LTEuODMgMS41MS0yLjk1IDEuNDItLjE1LTEuMTUuNDEtMi4zNSAxLjA1LTMuMTF6XCIgZmlsbD1cIiNmZmZcIi8+XG4gICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHRleHRBbGlnbjogXCJsZWZ0XCIgfSl9XCI+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IDEwLCBjb2xvcjogXCJyZ2JhKDI1NSwyNTUsMjU1LDAuNilcIiwgZm9udFdlaWdodDogNjAwIH0pfVwiPkRvd25sb2FkIG9uIHRoZTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiAxNiwgY29sb3I6IFwiI2ZmZlwiLCBmb250V2VpZ2h0OiA3MDAsIG1hcmdpblRvcDogMSB9KX1cIj5BcHAgU3RvcmU8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICBgO1xuXG4gICAgICBjb25zdCBjdGFDZW50ZXJIdG1sID0gaXNQb3J0cmFpdFxuICAgICAgICA/IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgdGV4dEFsaWduOiBcImNlbnRlclwiLCB3aWR0aDogXCIxMDAlXCIgfSl9XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLXBhbmVsXCIgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgICBwYWRkaW5nOiByKHsgcG9ydHJhaXQ6IFwiMzJweCAyOHB4XCIsIGRlZmF1bHQ6IFwiNDBweCAzNnB4XCIgfSksXG4gICAgICAgICAgICAgIG1heFdpZHRoOiA1NjAsXG4gICAgICAgICAgICAgIG1hcmdpbjogXCIwIGF1dG9cIixcbiAgICAgICAgICAgIH0pfVwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLWtpY2tlclwiIHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IDExLCBtYXJnaW5Cb3R0b206IDE0IH0pfTsgJHtraWNrZXJTdHlsZX1cIj5Ob3cgb24gaU9TPC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdGEtaGVhZGxpbmVcIiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDQ4LCBkZWZhdWx0OiA1MiB9KSB9KX07ICR7aGVhZGxpbmVTdHlsZX1cIj4ke3Byb2R1Y3ROYW1lfTwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLXRhZ2xpbmVcIiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDIwLCBkZWZhdWx0OiAyMiB9KSwgbWFyZ2luVG9wOiAxMiB9KX07ICR7dGFnU3R5bGV9XCI+JHt0YWdsaW5lfTwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLWJ0blwiIHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgICAgICBtYXJnaW5Ub3A6IDI4LFxuICAgICAgICAgICAgICAgIGZvbnRTaXplOiAyMCxcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiBcIjE0cHggMzJweFwiLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IGBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAke2FjY2VudENvbG9yfSwgJHtzdGQuY29sb3IubWl4KGFjY2VudENvbG9yLCBcIiNhODU1ZjdcIiwgMC4zNSl9KWAsXG4gICAgICAgICAgICAgICAgYm94U2hhZG93OiBgMCAxMnB4IDQwcHggJHtzdGQuY29sb3IuYWxwaGEoYWNjZW50Q29sb3IsIDAuNCl9YCxcbiAgICAgICAgICAgICAgfSl9OyAke2J0blN0eWxlfVwiPiR7Y3RhLnRleHR9PC9kaXY+XG4gICAgICAgICAgICAgICR7c3RvcmVCYWRnZX1cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgXG4gICAgICAgIDogYFxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdGEtcGFuZWxcIiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICB0ZXh0QWxpZ246IFwibGVmdFwiLFxuICAgICAgICAgICAgcGFkZGluZzogXCI0NHB4IDQ4cHhcIixcbiAgICAgICAgICAgIG1heFdpZHRoOiA1MjAsXG4gICAgICAgICAgfSl9XCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLWtpY2tlclwiIHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IDEyLCBtYXJnaW5Cb3R0b206IDE4IH0pfTsgJHtraWNrZXJTdHlsZX1cIj5Ob3cgb24gaU9TPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLWhlYWRsaW5lXCIgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogNTYgfSl9OyAke2hlYWRsaW5lU3R5bGV9XCI+JHtwcm9kdWN0TmFtZX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdGEtdGFnbGluZVwiIHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IDI0LCBtYXJnaW5Ub3A6IDE0LCBtYXhXaWR0aDogNDAwIH0pfTsgJHt0YWdTdHlsZX1cIj4ke3RhZ2xpbmV9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3RhLWJ0blwiIHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgICAgbWFyZ2luVG9wOiAzMixcbiAgICAgICAgICAgICAgZm9udFNpemU6IDIyLFxuICAgICAgICAgICAgICBwYWRkaW5nOiBcIjE2cHggMzZweFwiLFxuICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBgbGluZWFyLWdyYWRpZW50KDEzNWRlZywgJHthY2NlbnRDb2xvcn0sICR7c3RkLmNvbG9yLm1peChhY2NlbnRDb2xvciwgXCIjYTg1NWY3XCIsIDAuMzUpfSlgLFxuICAgICAgICAgICAgICBib3hTaGFkb3c6IGAwIDEycHggNDBweCAke3N0ZC5jb2xvci5hbHBoYShhY2NlbnRDb2xvciwgMC40KX1gLFxuICAgICAgICAgICAgfSl9OyAke2J0blN0eWxlfVwiPiR7Y3RhLnRleHR9PC9kaXY+XG4gICAgICAgICAgICAke3N0b3JlQmFkZ2V9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG5cbiAgICAgIGNvbnN0IGxvd2VyTW90aW9uID0gZC5tb3Rpb24oeyBhdDogXCIwLjZzXCIsIGZvcjogXCIwLjVzXCIsIHk6IDMyLCBlYXNpbmc6IFwiZWFzZU91dEN1YmljXCIgfSk7XG5cbiAgICAgIGNvbnN0IGN0YUxvd2VyVGhpcmQgPSBgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJ1cmwtcGlsbFwiIHN0eWxlPVwiJHtzdGQuY3NzKHsgZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGdhcDogMTIgfSl9XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoOiA0LCBoZWlnaHQ6IDI4LCBiYWNrZ3JvdW5kOiBhY2NlbnRDb2xvciwgYm9yZGVyUmFkaXVzOiAyLCBmbGV4U2hyaW5rOiAwIH0pfVwiPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdGEtdXJsXCIgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogcih7IHBvcnRyYWl0OiAxOCwgZGVmYXVsdDogMjAgfSkgfSl9XCI+JHtjdGEudXJsfTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIGA7XG5cbiAgICAgIHJldHVybiB7IGN0YUNlbnRlckh0bWwsIGN0YUxvd2VyVGhpcmQsIGxvd2VyTW90aW9uIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYnVpbGRDdGFTaG90KGQ6IHR5cGVvZiB0KSB7XG4gICAgICBjb25zdCB7IGN0YUNlbnRlckh0bWwsIGN0YUxvd2VyVGhpcmQsIGxvd2VyTW90aW9uIH0gPSBidWlsZEN0YUNvbnRlbnQoZCk7XG4gICAgICBjb25zdCBzdHJlYWsgPSBNYXRoLmZsb29yKFxuICAgICAgICBkLnR3ZWVuKDAsIDEyLCB7IGF0OiBcIjAuOHNcIiwgZm9yOiBcIjAuOHNcIiwgZWFzaW5nOiBcImVhc2VPdXRRdWFydFwiIH0pLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHBob25lTW90aW9uID0gZC5tb3Rpb24oeyBhdDogXCIwc1wiLCBmb3I6IFwiMC42c1wiLCBzY2FsZTogMC45NCwgZWFzaW5nOiBcImVhc2VPdXRDdWJpY1wiIH0pLnN0eWxlO1xuICAgICAgY29uc3QgYWNjZW50R2xvdyA9IGByYWRpYWwtZ3JhZGllbnQoZWxsaXBzZSA4MCUgNjAlIGF0IDUwJSAzMCUsICR7c3RkLmNvbG9yLmFscGhhKGFjY2VudENvbG9yLCAwLjIpfSAwJSwgdHJhbnNwYXJlbnQgNzAlKWA7XG5cbiAgICAgIGNvbnN0IGxheWVycyA9IFtcbiAgICAgICAgTC5iZyhBUFBfQkcpLFxuICAgICAgICBMLnRpbnQoU0NSSU1fQ0VOVEVSKSxcbiAgICAgICAgTC50aW50KGFjY2VudEdsb3cpLFxuICAgICAgICBMLmNvbnRlbnQoY3RhQ2VudGVySHRtbCwge1xuICAgICAgICAgIHNhZmU6IFwiYnJvYWRjYXN0XCIsXG4gICAgICAgICAgaW5zZXQ6IGlzUG9ydHJhaXRcbiAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICA6IHsgdG9wOiBcIjIwJVwiLCBsZWZ0OiBcIjglXCIsIHJpZ2h0OiBcIjQ2JVwiLCBib3R0b206IFwiMTYlXCIgfSxcbiAgICAgICAgfSksXG4gICAgICAgIGxvd2VyVGhpcmRPdmVybGF5KEwsIGN0YUxvd2VyVGhpcmQsIHtcbiAgICAgICAgICBtb3Rpb246IGxvd2VyTW90aW9uLFxuICAgICAgICAgIG9mZnNldDogeyB5OiByKHsgcG9ydHJhaXQ6IDM2MCwgZGVmYXVsdDogNzIgfSkgfSwgLy8gMzYwcHggY2xlYXJzIGJvdHRvbSAxOCUgZGVhZCB6b25lXG4gICAgICAgIH0pLFxuICAgICAgXTtcblxuICAgICAgbGF5ZXJzLnNwbGljZSg0LCAwLFxuICAgICAgICBMLm92ZXJsYXkoYnVpbGRQaG9uZShcImhvbWVcIiwgcGhvbmVNb3Rpb24sIHsgc3RyZWFrIH0pLCBwaG9uZU92ZXJsYXlPcHRzKCkpLFxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIEwucmVuZGVyKC4uLmxheWVycyk7XG4gICAgfVxuXG4gICAgLy8gLS0tIFJlbmRlciByb3V0aW5nIC0tLVxuXG4gICAgaWYgKHQuaW5TcGFuKFwiMy40c1wiLCBcIjQuMHNcIikpIHtcbiAgICAgIGNvbnN0IGhvb2tUb0ZlYXR1cmVzUCA9IHQudHJhbnNpdGlvbihcIjMuNHNcIiwgXCI0LjBzXCIsIFwiZWFzZUluT3V0Q3ViaWNcIik7XG4gICAgICBjb25zdCBoYW5kb2ZmRmVhdHVyZXNMb2NhbCA9IHN0ZC5yZXZlYWwuaGFuZG9mZkxvY2FsKGhvb2tUb0ZlYXR1cmVzUCk7XG4gICAgICBjb25zdCBzY3JlZW46IEFwcFNjcmVlbiA9IGhvb2tUb0ZlYXR1cmVzUCA8IDAuNTUgPyBcInNwbGFzaFwiIDogXCJmZWF0dXJlc1wiO1xuICAgICAgY29uc3QgaGlnaGxpZ2h0ID0gaG9va1RvRmVhdHVyZXNQIDwgMC41NSA/IDAgOiBmZWF0dXJlSGlnaGxpZ2h0KGhhbmRvZmZGZWF0dXJlc0xvY2FsKTtcbiAgICAgIGNvbnN0IGhhbmRvZmYgPSBzdGQucmV2ZWFsLnNwbGl0KHtcbiAgICAgICAgZnJvbTogYnVpbGRIb29rUGFuZWwoKSxcbiAgICAgICAgdG86IGJ1aWxkRmVhdHVyZXNQYW5lbChoYW5kb2ZmRmVhdHVyZXNMb2NhbCksXG4gICAgICAgIHByb2dyZXNzOiBob29rVG9GZWF0dXJlc1AsXG4gICAgICAgIHN0eWxlOiBcIndpcGVcIixcbiAgICAgICAgYWNjZW50Q29sb3IsXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIEwuaGFuZG9mZih7XG4gICAgICAgIHNoYXJlZDogW0wuYmcoQVBQX0JHKV0sXG4gICAgICAgIHRyYW5zaXRpb246IGhhbmRvZmYsXG4gICAgICAgIHBpbm5lZDogW0wub3ZlcmxheShidWlsZFBob25lKHNjcmVlbiwgU1RFQURZX01PVElPTiwgeyBoaWdobGlnaHQgfSksIHBob25lT3ZlcmxheU9wdHMoKSldLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHQuaW5TcGFuKFwiMTAuMnNcIiwgXCIxMC44c1wiKSkge1xuICAgICAgY29uc3QgZmVhdHVyZXNUb0N0YVAgPSB0LnRyYW5zaXRpb24oXCIxMC4yc1wiLCBcIjEwLjhzXCIsIFwiZWFzZUluT3V0Q3ViaWNcIik7XG4gICAgICBjb25zdCBoYW5kb2ZmRGlyID0gdC5jbGlwKHsgZnJvbTogXCI5LjhzXCIsIGR1cmF0aW9uOiBcIjFzXCIgfSkuZGlyZWN0b3IoeyBlbnRlcjogXCIxMDAlXCIgfSk7XG4gICAgICByZXR1cm4gc3RkLnJldmVhbC5jcm9zc2ZhZGUoe1xuICAgICAgICBmcm9tOiBidWlsZEZlYXR1cmVzU2hvdCgxKSxcbiAgICAgICAgdG86IGJ1aWxkQ3RhU2hvdChoYW5kb2ZmRGlyKSxcbiAgICAgICAgcHJvZ3Jlc3M6IGZlYXR1cmVzVG9DdGFQLFxuICAgICAgfSkuaHRtbDtcbiAgICB9XG5cbiAgICBpZiAodC5hY3RpdmUgPT09IFwiaG9va1wiKSB7XG4gICAgICBjb25zdCBpbnRyb1AgPSB0LnNwYW4oXCIwc1wiLCBJTlRST19XSVBFX1NFQyk7XG4gICAgICBjb25zdCBpbnRyb1dpcGUgPSBzdGQucmV2ZWFsLndpcGUoe1xuICAgICAgICBwcm9ncmVzczogaW50cm9QLFxuICAgICAgICBkaXJlY3Rpb246IFwiZGlhZ29uYWxcIixcbiAgICAgICAgY29sb3I6IGFjY2VudENvbG9yLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gYnVpbGRIb29rU2hvdChpbnRyb1dpcGUpO1xuICAgIH1cblxuICAgIGlmICh0LmFjdGl2ZSA9PT0gXCJmZWF0dXJlc1wiKSB7XG4gICAgICByZXR1cm4gYnVpbGRGZWF0dXJlc1Nob3QoZmVhdHVyZXNMb2NhbExpdmUpO1xuICAgIH1cblxuICAgIHJldHVybiBidWlsZEN0YVNob3QodC5jbGlwKHsgZHVyaW5nOiBcImN0YVwiIH0pLmRpcmVjdG9yKHsgZW50ZXI6IFwiMTAwJVwiIH0pKTtcbiAgfSxcbn0pOyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixNQUFNLElBQUksTUFBTTtFQUNoQixNQUFNLGFBQWEsT0FBTyxNQUFNLFlBQVk7RUFDNUMsT0FBTztHQUNOO0dBQ0EsVUFBVSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsUUFBUSxhQUFhLEVBQUUsWUFBWSxRQUFRO0dBQ3JFLFFBQVEsTUFBTTtHQUNkLEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxhQUFhLEVBQUUsU0FBUyxNQUFNLFFBQVEsSUFBSSxDQUFDO0VBQy9DO0NBQ0Q7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQ3BDQSxTQUFnQixrQkFBa0IsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHO0VBQ3BELE9BQU8sRUFBRSxRQUFRLE1BQU07R0FDckIsUUFBUTtHQUNSLFFBQVEsS0FBSyxVQUFVO0lBQUUsR0FBRztJQUFHLEdBQUc7R0FBRztHQUNyQyxRQUFRLEtBQUs7R0FDYixNQUFNO0VBQ1IsQ0FBQztDQUNIOzs7Q0NHQSxNQUFNLFVBQVU7Q0FDaEIsTUFBTSxVQUFVO0NBSWhCLFNBQVMsZUFBZSxRQUFnQjtFQUN0QyxPQUFPOzs7O3dDQUkrQixPQUFPOzs7Q0FHL0M7Q0FFQSxTQUFTLFlBQVksT0FBaUI7RUFDcEMsT0FBTzs7c0NBRTZCLE1BQU0sWUFBWTs7OztDQUl4RDtDQUVBLFNBQVMsUUFBUSxPQUFpQixNQUFjLEdBQVcsR0FBVztFQUNwRSxNQUFNLElBQUksS0FBSyxNQUFNLE9BQU8sR0FBSTtFQUNoQyxNQUFNLFdBQVcsS0FBSyxNQUFNLE9B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