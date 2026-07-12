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
	exports.default = define({
		sample: {
			hook: "OKC has a tech scene.",
			hookLine2: "We saved you a seat.",
			subheader: "Laptops welcome. Beginners too.",
			talkTitle: "Coworking at 8th Street Market",
			backgroundImage: "https://secure.meetupstatic.com/photos/event/8/6/9/7/highres_516994455.jpeg",
			date: "March 18",
			time: "11 AM – 1 PM",
			address: "3 NE 8th St · Oklahoma City, OK",
			groupName: "OKC Coffee and Code",
			brandColor: "#f65858",
			techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "12s",
			fonts: ["Inter:wght@400;500;600;700;800"],
			audio: {
				id: "bed",
				src: "../../_assets/lofi-bg.mp3",
				role: "music",
				volume: .6,
				fadeIn: "0.5s",
				fadeOut: "1.5s",
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
    `]
		},
		render(ctx) {
			const { std, timeline, width, height, data } = ctx;
			const { hook, hookLine2, subheader, talkTitle, backgroundImage, date, time: eventTime, address, groupName, brandColor, techlahomaSvg } = data;
			const r = std.createResponsive(ctx);
			const mainDur = 9;
			const t = ctx.director({
				main: "9.0s",
				outro: "3.0s"
			});
			if (t.active === "outro") {
				const logoWidth = r({
					portrait: 500,
					square: 400,
					default: 480
				});
				const logoAnim = t.motion({
					during: "outro",
					scale: .1,
					for: "1.0s",
					exit: false
				});
				return `
        <div style="${std.css({
					width,
					height,
					background: "#000",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				})}">
          <img src="${techlahomaSvg}" style="${std.css({
					width: logoWidth,
					opacity: logoAnim.opacity
				})};${logoAnim.style}" />
        </div>
      `;
			}
			const bg = std.backgrounds.kenBurns({
				src: backgroundImage,
				progress: timeline.seconds / mainDur,
				zoomTo: 1.1,
				overlay: "rgba(0, 0, 0, 0.5)"
			});
			const hook1P = t.tween(0, 1, {
				during: "main",
				at: `${(0 / 9 * 100).toFixed(1)}%`,
				for: `${(.8 / 9 * 100).toFixed(1)}%`
			});
			const hook2P = t.tween(0, 1, {
				during: "main",
				at: `${(1.4 / 9 * 100).toFixed(1)}%`,
				for: `${(.7 / 9 * 100).toFixed(1)}%`
			});
			const subP = t.tween(0, 1, {
				during: "main",
				at: `${(2.7 / 9 * 100).toFixed(1)}%`,
				for: `${(.8 / 9 * 100).toFixed(1)}%`
			});
			const expandP = t.tween(0, 1, {
				during: "main",
				at: `${(4 / 9 * 100).toFixed(1)}%`,
				for: `${(.5 / 9 * 100).toFixed(1)}%`,
				easing: "easeInOutCubic"
			});
			const groupAnim = t.motion({
				during: "main",
				at: "4.2s",
				for: "0.4s",
				y: -20
			});
			const titleAnim = t.motion({
				during: "main",
				at: "4.4s",
				for: "0.4s",
				y: 20
			});
			const logisticsAnim = t.motion({
				during: "main",
				at: "4.7s",
				for: "0.4s",
				y: 20
			});
			const ctaAnim = t.motion({
				during: "main",
				at: "6.5s",
				for: "0.4s",
				y: 15
			});
			const cardAnim = t.motion({
				during: "main",
				at: "0%",
				for: "0.5s",
				scale: .05,
				exit: {
					window: [8.5 / 12, 9 / 12],
					y: 0,
					scale: 1
				}
			});
			const hook1Visible = std.text.type(hook, hook1P).visible;
			const hook2Visible = std.text.type(hookLine2, hook2P).visible;
			const subheaderVisible = std.text.type(subheader, subP).visible;
			const hookShiftAmount = r({
				portrait: -80,
				default: -60
			});
			const hookShiftY = std.interpolate(expandP, [0, 1], [0, hookShiftAmount], "easeInOutCubic");
			const cardWidth = r({
				portrait: "90%",
				square: "85%",
				default: "75%"
			});
			const cardMaxWidth = r({
				portrait: 972,
				default: 850
			});
			const hookSize = r({
				portrait: 68,
				square: 32,
				default: 48
			});
			const subheaderSize = r({
				portrait: 34,
				square: 16,
				default: 22
			});
			const titleSize = r({
				portrait: 44,
				square: 22,
				default: 32
			});
			const logisticsSize = r({
				portrait: 32,
				square: 16,
				default: 20
			});
			const addressSize = r({
				portrait: 28,
				square: 14,
				default: 16
			});
			const ctaSize = r({
				portrait: 32,
				square: 14,
				default: 18
			});
			const paddingX = r({
				portrait: 48,
				square: 28,
				default: 44
			});
			const paddingY = r({
				portrait: 64,
				square: 28,
				default: 44
			});
			const groupBadgeSize = r({
				portrait: 20,
				default: 13
			});
			const hostedBySize = r({
				portrait: 14,
				default: 10
			});
			const groupBadgePadding = r({
				portrait: "10px 24px",
				default: "6px 16px"
			});
			const hookMargin = r({
				portrait: 20,
				default: 12
			});
			const titleMargin = r({
				portrait: 24,
				default: 16
			});
			return `
      <div style="${std.css({
				width,
				height,
				position: "relative",
				overflow: "hidden"
			})}">
        ${bg.html}
        <div style="${std.css({
				position: "relative",
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40
			})}">
          <div style="${std.css({
				width: cardWidth,
				maxWidth: cardMaxWidth,
				background: std.color.alpha(brandColor, .95),
				borderRadius: 16,
				padding: `${paddingY}px ${paddingX}px`,
				boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
				color: "white",
				textAlign: "center",
				opacity: cardAnim.opacity,
				display: "flex",
				flexDirection: "column",
				alignItems: "center"
			})};${cardAnim.style}">

            <!-- Hosted by + Group badge -->
            <div style="${std.css({
				fontSize: hostedBySize,
				fontWeight: 500,
				textTransform: "uppercase",
				letterSpacing: "0.15em",
				opacity: groupAnim.opacity * .7,
				marginBottom: 6
			})};${groupAnim.style}">hosted by</div>
            <div style="${std.css({
				fontSize: groupBadgeSize,
				fontWeight: 600,
				background: std.color.alpha("#ffffff", .2),
				padding: groupBadgePadding,
				marginBottom: titleMargin + Math.abs(hookShiftY),
				opacity: groupAnim.opacity,
				textTransform: "uppercase",
				letterSpacing: "0.1em"
			})};${groupAnim.style}">${groupName}</div>

            <!-- Hook section -->
            <div style="${std.css({
				transform: `translateY(${hookShiftY}px)`,
				marginBottom: expandP > 0 ? 16 : 0
			})}">
              <div style="${std.css({
				fontSize: hookSize,
				fontWeight: 800,
				letterSpacing: "-0.02em",
				lineHeight: 1.1,
				minHeight: hookSize * 1.1,
				whiteSpace: "nowrap"
			})}">${hook1Visible}</div>
              <div style="${std.css({
				fontSize: hookSize,
				fontWeight: 800,
				letterSpacing: "-0.02em",
				lineHeight: 1.1,
				marginBottom: hookMargin,
				minHeight: hookSize * 1.1,
				whiteSpace: "nowrap"
			})}">${hook2Visible}</div>
              <div style="${std.css({
				fontSize: subheaderSize,
				fontWeight: 400,
				minHeight: subheaderSize * 1.2,
				opacity: subP > 0 ? .8 : 0,
				whiteSpace: "nowrap"
			})}">${subheaderVisible}</div>
            </div>

            <!-- Title -->
            <div style="${std.css({
				fontSize: titleSize,
				fontWeight: 600,
				lineHeight: 1.2,
				marginBottom: titleMargin,
				opacity: titleAnim.opacity
			})};${titleAnim.style}">${talkTitle}</div>

            <!-- Logistics -->
            <div style="${std.css({
				opacity: logisticsAnim.opacity,
				marginBottom: titleMargin,
				textAlign: "center"
			})};${logisticsAnim.style}">
              <div style="${std.css({
				fontSize: logisticsSize,
				fontWeight: 600,
				marginBottom: 8
			})}">${date} · ${eventTime}</div>
              <div style="${std.css({
				fontSize: addressSize,
				fontWeight: 400,
				opacity: .85
			})}">${address}</div>
            </div>

            <!-- CTA -->
            <div style="${std.css({
				fontSize: ctaSize,
				fontWeight: 500,
				fontStyle: "italic",
				opacity: ctaAnim.opacity * .9
			})};${ctaAnim.style}">Your seat's waiting.</div>
          </div>
        </div>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVldHVwLWFubm91bmNlbWVudC5tZWRpYS5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9zdXBlcmltZy10eXBlcy9kaXN0L2luZGV4LmpzIiwiLi4vZXhhbXBsZXMvZXZlbnRzL21lZXR1cC1hbm5vdW5jZW1lbnQvbWVldHVwLWFubm91bmNlbWVudC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBzYW1wbGU6IHtcbiAgICBob29rOiBcIk9LQyBoYXMgYSB0ZWNoIHNjZW5lLlwiLFxuICAgIGhvb2tMaW5lMjogXCJXZSBzYXZlZCB5b3UgYSBzZWF0LlwiLFxuICAgIHN1YmhlYWRlcjogXCJMYXB0b3BzIHdlbGNvbWUuIEJlZ2lubmVycyB0b28uXCIsXG4gICAgdGFsa1RpdGxlOiBcIkNvd29ya2luZyBhdCA4dGggU3RyZWV0IE1hcmtldFwiLFxuICAgIGJhY2tncm91bmRJbWFnZTogXCJodHRwczovL3NlY3VyZS5tZWV0dXBzdGF0aWMuY29tL3Bob3Rvcy9ldmVudC84LzYvOS83L2hpZ2hyZXNfNTE2OTk0NDU1LmpwZWdcIixcbiAgICBkYXRlOiBcIk1hcmNoIDE4XCIsXG4gICAgdGltZTogXCIxMSBBTSDigJMgMSBQTVwiLFxuICAgIGFkZHJlc3M6IFwiMyBORSA4dGggU3QgwrcgT2tsYWhvbWEgQ2l0eSwgT0tcIixcbiAgICBncm91cE5hbWU6IFwiT0tDIENvZmZlZSBhbmQgQ29kZVwiLFxuICAgIGJyYW5kQ29sb3I6IFwiI2Y2NTg1OFwiLFxuICAgIHRlY2hsYWhvbWFTdmc6IFwiaHR0cHM6Ly93d3cudGVjaGxhaG9tYS5vcmcvd3AtY29udGVudC91cGxvYWRzLzIwMjQvMDkvY3JvcHBlZC10ZWNobGFob21hX2hvcml6b250YWx0ZXh0LXdoaXRlLnBuZ1wiLFxuICB9LFxuXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjEyc1wiLFxuICAgIGZvbnRzOiBbXCJJbnRlcjp3Z2h0QDQwMDs1MDA7NjAwOzcwMDs4MDBcIl0sXG4gICAgYXVkaW86IHtcbiAgICAgIGlkOiBcImJlZFwiLFxuICAgICAgc3JjOiBcIi4uLy4uL19hc3NldHMvbG9maS1iZy5tcDNcIixcbiAgICAgIHJvbGU6IFwibXVzaWNcIixcbiAgICAgIHZvbHVtZTogMC42LFxuICAgICAgZmFkZUluOiBcIjAuNXNcIixcbiAgICAgIGZhZGVPdXQ6IFwiMS41c1wiLFxuICAgICAgbG9vcDogdHJ1ZSxcbiAgICB9LFxuICAgIG91dHB1dHM6IHtcbiAgICAgIGxhbmRzY2FwZTogeyB3aWR0aDogMTkyMCwgaGVpZ2h0OiAxMDgwIH0sXG4gICAgICBzcXVhcmU6IHsgd2lkdGg6IDEwODAsIGhlaWdodDogMTA4MCB9LFxuICAgICAgc3Rvcnk6IHsgd2lkdGg6IDEwODAsIGhlaWdodDogMTkyMCB9LFxuICAgIH0sXG4gICAgaW5saW5lQ3NzOiBbYFxuICAgICAgKiB7IG1hcmdpbjogMDsgcGFkZGluZzogMDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfVxuICAgICAgYm9keSB7IGZvbnQtZmFtaWx5OiAnSW50ZXInLCBzYW5zLXNlcmlmOyBvdmVyZmxvdzogaGlkZGVuOyB9XG4gICAgYF0sXG4gIH0sXG5cbiAgcmVuZGVyKGN0eCkge1xuICAgIGNvbnN0IHsgc3RkLCB0aW1lbGluZSwgd2lkdGgsIGhlaWdodCwgZGF0YSB9ID0gY3R4O1xuICAgIGNvbnN0IHsgaG9vaywgaG9va0xpbmUyLCBzdWJoZWFkZXIsIHRhbGtUaXRsZSwgYmFja2dyb3VuZEltYWdlLCBkYXRlLCB0aW1lOiBldmVudFRpbWUsIGFkZHJlc3MsIGdyb3VwTmFtZSwgYnJhbmRDb2xvciwgdGVjaGxhaG9tYVN2ZyB9ID0gZGF0YTtcblxuICAgIGNvbnN0IHIgPSBzdGQuY3JlYXRlUmVzcG9uc2l2ZShjdHgpO1xuICAgIGNvbnN0IG1haW5EdXIgPSA5LjA7XG4gICAgXG4gICAgLy8gZGlyZWN0b3IgcGhhc2VzOiBtYWluICgw4oCTOXMpIOKGkiBvdXRybyAoOeKAkzEycylcbiAgICBjb25zdCB0ID0gY3R4LmRpcmVjdG9yKHsgbWFpbjogXCI5LjBzXCIsIG91dHJvOiBcIjMuMHNcIiB9KTtcblxuICAgIC8vID09PSBPVVRSTyBQSEFTRSA9PT1cbiAgICBpZiAodC5hY3RpdmUgPT09IFwib3V0cm9cIikge1xuICAgICAgY29uc3QgbG9nb1dpZHRoID0gcih7IHBvcnRyYWl0OiA1MDAsIHNxdWFyZTogNDAwLCBkZWZhdWx0OiA0ODAgfSk7XG4gICAgICAvLyBVc2UgbW90aW9uKCkgaW4gdGhlIG91dHJvIHBoYXNlXG4gICAgICBjb25zdCBsb2dvQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcIm91dHJvXCIsIHNjYWxlOiAwLjEsIGZvcjogXCIxLjBzXCIsIGV4aXQ6IGZhbHNlIH0pO1xuXG4gICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGgsIGhlaWdodCwgYmFja2dyb3VuZDogXCIjMDAwXCIsIGRpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIiB9KX1cIj5cbiAgICAgICAgICA8aW1nIHNyYz1cIiR7dGVjaGxhaG9tYVN2Z31cIiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoOiBsb2dvV2lkdGgsIG9wYWNpdHk6IGxvZ29BbmltLm9wYWNpdHkgfSl9OyR7bG9nb0FuaW0uc3R5bGV9XCIgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICBgO1xuICAgIH1cblxuICAgIC8vID09PSBNQUlOIENPTlRFTlQgPT09XG4gICAgY29uc3QgYmcgPSBzdGQuYmFja2dyb3VuZHMua2VuQnVybnMoeyBzcmM6IGJhY2tncm91bmRJbWFnZSwgcHJvZ3Jlc3M6IHRpbWVsaW5lLnNlY29uZHMgLyBtYWluRHVyLCB6b29tVG86IDEuMSwgb3ZlcmxheTogXCJyZ2JhKDAsIDAsIDAsIDAuNSlcIiB9KTtcblxuICAgIC8vIEluZGl2aWR1YWwgdHJpZ2dlcnMgd2l0aGluIFwibWFpblwiIHBoYXNlXG4gICAgY29uc3QgaG9vazFQID0gdC50d2VlbigwLCAxLCB7IGR1cmluZzogXCJtYWluXCIsIGF0OiBgJHsoKDAvOSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogYCR7KCgwLjgvOSkgKiAxMDApLnRvRml4ZWQoMSl9JWB9KTtcbiAgICBjb25zdCBob29rMlAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IGAkeygoMS40LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBmb3I6IGAkeygoMC43LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgfSk7XG4gICAgY29uc3Qgc3ViUCA9IHQudHdlZW4oMCwgMSwgeyBkdXJpbmc6IFwibWFpblwiLCBhdDogYCR7KCgyLjcvOSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogYCR7KCgwLjgvOSkgKiAxMDApLnRvRml4ZWQoMSl9JWB9KTtcblxuICAgIGNvbnN0IGV4cGFuZFAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IGAkeygoNC4wLzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBmb3I6IGAkeygoMC41LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBlYXNpbmc6IFwiZWFzZUluT3V0Q3ViaWNcIiB9KTtcbiAgICBjb25zdCBncm91cEFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJtYWluXCIsIGF0OiBcIjQuMnNcIiwgZm9yOiBcIjAuNHNcIiwgeTogLTIwIH0pO1xuICAgIGNvbnN0IHRpdGxlQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IFwiNC40c1wiLCBmb3I6IFwiMC40c1wiLCB5OiAyMCB9KTtcbiAgICBjb25zdCBsb2dpc3RpY3NBbmltID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwibWFpblwiLCBhdDogXCI0LjdzXCIsIGZvcjogXCIwLjRzXCIsIHk6IDIwIH0pO1xuICAgIGNvbnN0IGN0YUFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJtYWluXCIsIGF0OiBcIjYuNXNcIiwgZm9yOiBcIjAuNHNcIiwgeTogMTUgfSk7XG5cbiAgICAvLyBFeGl0IHdpbmRvd3MgYXJlIGFic29sdXRlIHNjZW5lIGZyYWN0aW9uczogZmFkZSB0aGUgY2FyZCBvdXQgOC41c+KAkzlzLCBiZWZvcmUgdGhlIG91dHJvXG4gICAgY29uc3QgY2FyZEFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJtYWluXCIsIGF0OiBcIjAlXCIsIGZvcjogXCIwLjVzXCIsIHNjYWxlOiAwLjA1LCBleGl0OiB7IHdpbmRvdzogWzguNSAvIDEyLCA5IC8gMTJdLCB5OiAwLCBzY2FsZTogMSB9IH0pO1xuXG4gICAgLy8gQW5pbWF0aW9ucyBsb2dpY1xuICAgIGNvbnN0IGhvb2sxVmlzaWJsZSA9IHN0ZC50ZXh0LnR5cGUoaG9vaywgaG9vazFQKS52aXNpYmxlO1xuICAgIGNvbnN0IGhvb2syVmlzaWJsZSA9IHN0ZC50ZXh0LnR5cGUoaG9va0xpbmUyLCBob29rMlApLnZpc2libGU7XG4gICAgY29uc3Qgc3ViaGVhZGVyVmlzaWJsZSA9IHN0ZC50ZXh0LnR5cGUoc3ViaGVhZGVyLCBzdWJQKS52aXNpYmxlO1xuXG4gICAgY29uc3QgaG9va1NoaWZ0QW1vdW50ID0gcih7IHBvcnRyYWl0OiAtODAsIGRlZmF1bHQ6IC02MCB9KTtcbiAgICBjb25zdCBob29rU2hpZnRZID0gc3RkLmludGVycG9sYXRlKGV4cGFuZFAsIFswLCAxXSwgWzAsIGhvb2tTaGlmdEFtb3VudF0sIFwiZWFzZUluT3V0Q3ViaWNcIik7XG5cbiAgICAvLyBSZXNwb25zaXZlIHNpemluZ1xuICAgIGNvbnN0IGNhcmRXaWR0aCA9IHIoeyBwb3J0cmFpdDogXCI5MCVcIiwgc3F1YXJlOiBcIjg1JVwiLCBkZWZhdWx0OiBcIjc1JVwiIH0pO1xuICAgIGNvbnN0IGNhcmRNYXhXaWR0aCA9IHIoeyBwb3J0cmFpdDogOTcyLCBkZWZhdWx0OiA4NTAgfSk7XG4gICAgY29uc3QgaG9va1NpemUgPSByKHsgcG9ydHJhaXQ6IDY4LCBzcXVhcmU6IDMyLCBkZWZhdWx0OiA0OCB9KTtcbiAgICBjb25zdCBzdWJoZWFkZXJTaXplID0gcih7IHBvcnRyYWl0OiAzNCwgc3F1YXJlOiAxNiwgZGVmYXVsdDogMjIgfSk7XG4gICAgY29uc3QgdGl0bGVTaXplID0gcih7IHBvcnRyYWl0OiA0NCwgc3F1YXJlOiAyMiwgZGVmYXVsdDogMzIgfSk7XG4gICAgY29uc3QgbG9naXN0aWNzU2l6ZSA9IHIoeyBwb3J0cmFpdDogMzIsIHNxdWFyZTogMTYsIGRlZmF1bHQ6IDIwIH0pO1xuICAgIGNvbnN0IGFkZHJlc3NTaXplID0gcih7IHBvcnRyYWl0OiAyOCwgc3F1YXJlOiAxNCwgZGVmYXVsdDogMTYgfSk7XG4gICAgY29uc3QgY3RhU2l6ZSA9IHIoeyBwb3J0cmFpdDogMzIsIHNxdWFyZTogMTQsIGRlZmF1bHQ6IDE4IH0pO1xuICAgIGNvbnN0IHBhZGRpbmdYID0gcih7IHBvcnRyYWl0OiA0OCwgc3F1YXJlOiAyOCwgZGVmYXVsdDogNDQgfSk7XG4gICAgY29uc3QgcGFkZGluZ1kgPSByKHsgcG9ydHJhaXQ6IDY0LCBzcXVhcmU6IDI4LCBkZWZhdWx0OiA0NCB9KTtcbiAgICBjb25zdCBncm91cEJhZGdlU2l6ZSA9IHIoeyBwb3J0cmFpdDogMjAsIGRlZmF1bHQ6IDEzIH0pO1xuICAgIGNvbnN0IGhvc3RlZEJ5U2l6ZSA9IHIoeyBwb3J0cmFpdDogMTQsIGRlZmF1bHQ6IDEwIH0pO1xuICAgIGNvbnN0IGdyb3VwQmFkZ2VQYWRkaW5nID0gcih7IHBvcnRyYWl0OiBcIjEwcHggMjRweFwiLCBkZWZhdWx0OiBcIjZweCAxNnB4XCIgfSk7XG4gICAgY29uc3QgaG9va01hcmdpbiA9IHIoeyBwb3J0cmFpdDogMjAsIGRlZmF1bHQ6IDEyIH0pO1xuICAgIGNvbnN0IHRpdGxlTWFyZ2luID0gcih7IHBvcnRyYWl0OiAyNCwgZGVmYXVsdDogMTYgfSk7XG5cbiAgICByZXR1cm4gYFxuICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoLCBoZWlnaHQsIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsIG92ZXJmbG93OiBcImhpZGRlblwiIH0pfVwiPlxuICAgICAgICAke2JnLmh0bWx9XG4gICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLCB3aWR0aDogXCIxMDAlXCIsIGhlaWdodDogXCIxMDAlXCIsIGRpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIiwgcGFkZGluZzogNDAgfSl9XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICB3aWR0aDogY2FyZFdpZHRoLCBtYXhXaWR0aDogY2FyZE1heFdpZHRoLCBiYWNrZ3JvdW5kOiBzdGQuY29sb3IuYWxwaGEoYnJhbmRDb2xvciwgMC45NSksXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IDE2LCBwYWRkaW5nOiBgJHtwYWRkaW5nWX1weCAke3BhZGRpbmdYfXB4YCwgYm94U2hhZG93OiBcIjAgMjRweCA2NHB4IHJnYmEoMCwgMCwgMCwgMC40KVwiLFxuICAgICAgICAgICAgY29sb3I6IFwid2hpdGVcIiwgdGV4dEFsaWduOiBcImNlbnRlclwiLCBvcGFjaXR5OiBjYXJkQW5pbS5vcGFjaXR5LCBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIixcbiAgICAgICAgICB9KX07JHtjYXJkQW5pbS5zdHlsZX1cIj5cblxuICAgICAgICAgICAgPCEtLSBIb3N0ZWQgYnkgKyBHcm91cCBiYWRnZSAtLT5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogaG9zdGVkQnlTaXplLCBmb250V2VpZ2h0OiA1MDAsIHRleHRUcmFuc2Zvcm06IFwidXBwZXJjYXNlXCIsIGxldHRlclNwYWNpbmc6IFwiMC4xNWVtXCIsIG9wYWNpdHk6IGdyb3VwQW5pbS5vcGFjaXR5ICogMC43LCBtYXJnaW5Cb3R0b206IDYgfSl9OyR7Z3JvdXBBbmltLnN0eWxlfVwiPmhvc3RlZCBieTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICAgIGZvbnRTaXplOiBncm91cEJhZGdlU2l6ZSwgZm9udFdlaWdodDogNjAwLCBiYWNrZ3JvdW5kOiBzdGQuY29sb3IuYWxwaGEoXCIjZmZmZmZmXCIsIDAuMiksXG4gICAgICAgICAgICAgIHBhZGRpbmc6IGdyb3VwQmFkZ2VQYWRkaW5nLCBtYXJnaW5Cb3R0b206IHRpdGxlTWFyZ2luICsgTWF0aC5hYnMoaG9va1NoaWZ0WSksXG4gICAgICAgICAgICAgIG9wYWNpdHk6IGdyb3VwQW5pbS5vcGFjaXR5LCB0ZXh0VHJhbnNmb3JtOiBcInVwcGVyY2FzZVwiLCBsZXR0ZXJTcGFjaW5nOiBcIjAuMWVtXCIsXG4gICAgICAgICAgICB9KX07JHtncm91cEFuaW0uc3R5bGV9XCI+JHtncm91cE5hbWV9PC9kaXY+XG5cbiAgICAgICAgICAgIDwhLS0gSG9vayBzZWN0aW9uIC0tPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHRyYW5zZm9ybTogYHRyYW5zbGF0ZVkoJHtob29rU2hpZnRZfXB4KWAsIG1hcmdpbkJvdHRvbTogZXhwYW5kUCA+IDAgPyAxNiA6IDAgfSl9XCI+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogaG9va1NpemUsIGZvbnRXZWlnaHQ6IDgwMCwgbGV0dGVyU3BhY2luZzogXCItMC4wMmVtXCIsIGxpbmVIZWlnaHQ6IDEuMSwgbWluSGVpZ2h0OiBob29rU2l6ZSAqIDEuMSwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9KX1cIj4ke2hvb2sxVmlzaWJsZX08L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBob29rU2l6ZSwgZm9udFdlaWdodDogODAwLCBsZXR0ZXJTcGFjaW5nOiBcIi0wLjAyZW1cIiwgbGluZUhlaWdodDogMS4xLCBtYXJnaW5Cb3R0b206IGhvb2tNYXJnaW4sIG1pbkhlaWdodDogaG9va1NpemUgKiAxLjEsIHdoaXRlU3BhY2U6IFwibm93cmFwXCIgfSl9XCI+JHtob29rMlZpc2libGV9PC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogc3ViaGVhZGVyU2l6ZSwgZm9udFdlaWdodDogNDAwLCBtaW5IZWlnaHQ6IHN1YmhlYWRlclNpemUgKiAxLjIsIG9wYWNpdHk6IHN1YlAgPiAwID8gMC44IDogMCwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9KX1cIj4ke3N1YmhlYWRlclZpc2libGV9PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPCEtLSBUaXRsZSAtLT5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogdGl0bGVTaXplLCBmb250V2VpZ2h0OiA2MDAsIGxpbmVIZWlnaHQ6IDEuMiwgbWFyZ2luQm90dG9tOiB0aXRsZU1hcmdpbiwgb3BhY2l0eTogdGl0bGVBbmltLm9wYWNpdHkgfSl9OyR7dGl0bGVBbmltLnN0eWxlfVwiPiR7dGFsa1RpdGxlfTwvZGl2PlxuXG4gICAgICAgICAgICA8IS0tIExvZ2lzdGljcyAtLT5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBvcGFjaXR5OiBsb2dpc3RpY3NBbmltLm9wYWNpdHksIG1hcmdpbkJvdHRvbTogdGl0bGVNYXJnaW4sIHRleHRBbGlnbjogXCJjZW50ZXJcIiB9KX07JHtsb2dpc3RpY3NBbmltLnN0eWxlfVwiPlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IGxvZ2lzdGljc1NpemUsIGZvbnRXZWlnaHQ6IDYwMCwgbWFyZ2luQm90dG9tOiA4IH0pfVwiPiR7ZGF0ZX0gwrcgJHtldmVudFRpbWV9PC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogYWRkcmVzc1NpemUsIGZvbnRXZWlnaHQ6IDQwMCwgb3BhY2l0eTogMC44NSB9KX1cIj4ke2FkZHJlc3N9PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPCEtLSBDVEEgLS0+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IGN0YVNpemUsIGZvbnRXZWlnaHQ6IDUwMCwgZm9udFN0eWxlOiBcIml0YWxpY1wiLCBvcGFjaXR5OiBjdGFBbmltLm9wYWNpdHkgKiAwLjkgfSl9OyR7Y3RhQW5pbS5zdHlsZX1cIj5Zb3VyIHNlYXQncyB3YWl0aW5nLjwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gIH0sXG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixNQUFNLElBQUksTUFBTTtFQUNoQixNQUFNLGFBQWEsT0FBTyxNQUFNLFlBQVk7RUFDNUMsT0FBTztHQUNOO0dBQ0EsVUFBVSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsUUFBUSxhQUFhLEVBQUUsWUFBWSxRQUFRO0dBQ3JFLFFBQVEsTUFBTTtHQUNkLEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxhQUFhLEVBQUUsU0FBUyxNQUFNLFFBQVEsSUFBSSxDQUFDO0VBQy9DO0NBQ0Q7Ozs7Ozs7Ozs7Ozs7Ozs7bUJDdkNlLE9BQU87RUFDcEIsUUFBUTtHQUNOLE1BQU07R0FDTixXQUFXO0dBQ1gsV0FBVztHQUNYLFdBQVc7R0FDWCxpQkFBaUI7R0FDakIsTUFBTTtHQUNOLE1BQU07R0FDTixTQUFTO0dBQ1QsV0FBVztHQUNYLFlBQVk7R0FDWixlQUFlO0VBQ2pCO0VBRUEsUUFBUTtHQUNOLE9BQU87R0FDUCxRQUFRO0dBQ1IsS0FBSztHQUNMLFVBQVU7R0FDVixPQUFPLENBQUMsZ0NBQWdDO0dBQ3hDLE9BQU87SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNMLE1BQU07SUFDTixRQUFRO0lBQ1IsUUFBUTtJQUNSLFNBQVM7SUFDVCxNQUFNO0dBQ1I7R0FDQSxTQUFTO0lBQ1AsV0FBVztLQUFFLE9BQU87S0FBTSxRQUFRO0lBQUs7SUFDdkMsUUFBUTtLQUFFLE9BQU87S0FBTSxRQUFRO0lBQUs7SUFDcEMsT0FBTztLQUFFLE9BQU87S0FBTSxRQUFRO0lBQUs7R0FDckM7R0FDQSxXQUFXLENBQUM7OztLQUdYO0VBQ0g7RUFFQSxPQUFPLEtBQUs7R0FDVixNQUFNLEVBQUUsS0FBSyxVQUFVLE9BQU8sUUFBUSxTQUFTO0dBQy9DLE1BQU0sRUFBRSxNQUFNLFdBQVcsV0FBVyxXQUFXLGlCQUFpQixNQUFNLE1BQU0sV0FBVyxTQUFTLFdBQVcsWUFBWSxrQkFBa0I7R0FFekksTUFBTSxJQUFJLElBQUksaUJBQWlCLEdBQUc7R0FDbEMsTUFBTSxVQUFVO0dBR2hCLE1BQU0sSUFBSSxJQUFJLFNBQVM7SUFBRSxNQUFNO0lBQVEsT0FBTztHQUFPLENBQUM7R0FHdEQsSUFBSSxFQUFFLFdBQVcsU0FBUztJQUN4QixNQUFNLFlBQVksRUFBRTtLQUFFLFVBQVU7S0FBSyxRQUFRO0tBQUssU0FBUztJQUFJLENBQUM7SUFFaEUsTUFBTSxXQUFXLEVBQUUsT0FBTztLQUFFLFFBQVE7S0FBUyxPQUFPO0tBQUssS0FBSztLQUFRLE1BQU07SUFBTSxDQUFDO0lBRW5GLE9BQU87c0JBQ1MsSUFBSSxJQUFJO0tBQUU7S0FBTztLQUFRLFlBQVk7S0FBUSxTQUFTO0tBQVEsWUFBWTtLQUFVLGdCQUFnQjtJQUFTLENBQUMsRUFBRTtzQkFDaEgsY0FBYyxXQUFXLElBQUksSUFBSTtLQUFFLE9BQU87S0FBVyxTQUFTLFNBQVM7SUFBUSxDQUFDLEVBQUUsR0FBRyxTQUFTLE1BQU07OztHQUd0SDtHQUdBLE1BQU0sS0FBSyxJQUFJLFlBQVksU0FBUztJQUFFLEtBQUs7SUFBaUIsVUFBVSxTQUFTLFVBQVU7SUFBUyxRQUFRO0lBQUssU0FBUztHQUFxQixDQUFDO0dBRzlJLE1BQU0sU0FBUyxFQUFFLE1BQU0sR0FBRyxHQUFHO0lBQUUsUUFBUTtJQUFRLElBQUksSUFBSyxJQUFFLElBQUssSUFBQSxDQUFLLFFBQVEsQ0FBQyxFQUFFO0lBQUksS0FBSyxJQUFLLEtBQUksSUFBSyxJQUFBLENBQUssUUFBUSxDQUFDLEVBQUU7R0FBRSxDQUFDO0dBQ3pILE1BQU0sU0FBUyxFQUFFLE1BQU0sR0FBRyxHQUFHO0lBQUUsUUFBUTtJQUFRLElBQUksSUFBSyxNQUFJLElBQUssSUFBQSxDQUFLLFFBQVEsQ0FBQyxFQUFFO0lBQUksS0FBSyxJQUFLLEtBQUksSUFBSyxJQUFBLENBQUssUUFBUSxDQUFDLEVBQUU7R0FBRSxDQUFDO0dBQzNILE1BQU0sT0FBTyxFQUFFLE1BQU0sR0FBRyxHQUFHO0lBQUUsUUFBUTtJQUFRLElBQUksSUFBSyxNQUFJLElBQUssSUFBQSxDQUFLLFFBQVEsQ0FBQyxFQUFFO0lBQUksS0FBSyxJQUFLLEtBQUksSUFBSyxJQUFBLENBQUssUUFBUSxDQUFDLEVBQUU7R0FBRSxDQUFDO0dBRXpILE1BQU0sVUFBVSxFQUFFLE1BQU0sR0FBRyxHQUFHO0lBQUUsUUFBUTtJQUFRLElBQUksSUFBSyxJQUFJLElBQUssSUFBQSxDQUFLLFFBQVEsQ0FBQyxFQUFFO0lBQUksS0FBSyxJQUFLLEtBQUksSUFBSyxJQUFBLENBQUssUUFBUSxDQUFDLEVBQUU7SUFBSSxRQUFRO0dBQWlCLENBQUM7R0FDdkosTUFBTSxZQUFZLEVBQUUsT0FBTztJQUFFLFFBQVE7SUFBUSxJQUFJO0lBQVEsS0FBSztJQUFRLEdBQUc7R0FBSSxDQUFDO0dBQzlFLE1BQU0sWUFBWSxFQUFFLE9BQU87SUFBRSxRQUFRO0lBQVEsSUFBSTtJQUFRLEtBQUs7SUFBUSxHQUFHO0dBQUcsQ0FBQztHQUM3RSxNQUFNLGdCQUFnQixFQUFFLE9BQU87SUFBRSxRQUFRO0lBQVEsSUFBSTtJQUFRLEtBQUs7SUFBUSxHQUFHO0dBQUcsQ0FBQztHQUNqRixNQUFNLFVBQVUsRUFBRSxPQUFPO0lBQUUsUUFBUTtJQUFRLElBQUk7SUFBUSxLQUFLO0lBQVEsR0FBRztHQUFHLENBQUM7R0FHM0UsTUFBTSxXQUFXLEVBQUUsT0FBTztJQUFFLFFBQVE7SUFBUSxJQUFJO0lBQU0sS0FBSztJQUFRLE9BQU87SUFBTSxNQUFNO0tBQUUsUUFBUSxDQUFDLE1BQU0sSUFBSSxJQUFJLEVBQUU7S0FBRyxHQUFHO0tBQUcsT0FBTztJQUFFO0dBQUUsQ0FBQztHQUd0SSxNQUFNLGVBQWUsSUFBSSxLQUFLLEtBQUssTUFBTSxNQUFNLENBQUMsQ0FBQztHQUNqRCxNQUFNLGVBQWUsSUFBSSxLQUFLLEtBQUssV0FBVyxNQUFNLENBQUMsQ0FBQztHQUN0RCxNQUFNLG1CQUFtQixJQUFJLEtBQUssS0FBSyxXQUFXLElBQUksQ0FBQyxDQUFDO0dBRXhELE1BQU0sa0JBQWtCLEVBQUU7SUFBRSxVQUFVO0lBQUssU0FBUztHQUFJLENBQUM7R0FDekQsTUFBTSxhQUFhLElBQUksWUFBWSxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLGVBQWUsR0FBRyxnQkFBZ0I7R0FHMUYsTUFBTSxZQUFZLEVBQUU7SUFBRSxVQUFVO0lBQU8sUUFBUTtJQUFPLFNBQVM7R0FBTSxDQUFDO0dBQ3RFLE1BQU0sZUFBZSxFQUFFO0lBQUUsVUFBVTtJQUFLLFNBQVM7R0FBSSxDQUFDO0dBQ3RELE1BQU0sV0FBVyxFQUFFO0lBQUUsVUFBVTtJQUFJLFFBQVE7SUFBSSxTQUFTO0dBQUcsQ0FBQztHQUM1RCxNQUFNLGdCQUFnQixFQUFFO0lBQUUsVUFBVTtJQUFJLFFBQVE7SUFBSSxTQUFTO0dBQUcsQ0FBQztHQUNqRSxNQUFNLFlBQVksRUFBRTtJQUFFLFVBQVU7SUFBSSxRQUFRO0lBQUksU0FBUztHQUFHLENBQUM7R0FDN0QsTUFBTSxnQkFBZ0IsRUFBRTtJQUFFLFVBQVU7SUFBSSxRQUFRO0lBQUksU0FBUztHQUFHLENBQUM7R0FDakUsTUFBTSxjQUFjLEVBQUU7SUFBRSxVQUFVO0lBQUksUUFBUTtJQUFJLFNBQVM7R0FBRyxDQUFDO0dBQy9ELE1BQU0sVUFBVSxFQUFFO0lBQUUsVUFBVTtJQUFJLFFBQVE7SUFBSSxTQUFTO0dBQUcsQ0FBQztHQUMzRCxNQUFNLFdBQVcsRUFBRTtJQUFFLFVBQVU7SUFBSSxRQUFRO0lBQUksU0FBUztHQUFHLENBQUM7R0FDNUQsTUFBTSxXQUFXLEVBQUU7SUFBRSxVQUFVO0lBQUksUUFBUTtJQUFJLFNBQVM7R0FBRyxDQUFDO0dBQzVELE1BQU0saUJBQWlCLEVBQUU7SUFBRSxVQUFVO0lBQUksU0FBUztHQUFHLENBQUM7R0FDdEQsTUFBTSxlQUFlLEVBQUU7SUFBRSxVQUFVO0lBQUksU0FBUztHQUFHLENBQUM7R0FDcEQsTUFBTSxvQkFBb0IsRUFBRTtJQUFFLFVBQVU7SUFBYSxTQUFTO0dBQVcsQ0FBQztHQUMxRSxNQUFNLGFBQWEsRUFBRTtJQUFFLFVBQVU7SUFBSSxTQUFTO0dBQUcsQ0FBQztHQUNsRCxNQUFNLGNBQWMsRUFBRTtJQUFFLFVBQVU7SUFBSSxTQUFTO0dBQUcsQ0FBQztHQUVuRCxPQUFPO29CQUNTLElBQUksSUFBSTtJQUFFO0lBQU87SUFBUSxVQUFVO0lBQVksVUFBVTtHQUFTLENBQUMsRUFBRTtVQUMvRSxHQUFHLEtBQUs7c0JBQ0ksSUFBSSxJQUFJO0lBQUUsVUFBVTtJQUFZLE9BQU87SUFBUSxRQUFRO0lBQVEsU0FBUztJQUFRLFlBQVk7SUFBVSxnQkFBZ0I7SUFBVSxTQUFTO0dBQUcsQ0FBQyxFQUFFO3dCQUM3SSxJQUFJLElBQUk7SUFDcEIsT0FBTztJQUFXLFVBQVU7SUFBYyxZQUFZLElBQUksTUFBTSxNQUFNLFlBQVksR0FBSTtJQUN0RixjQUFjO0lBQUksU0FBUyxHQUFHLFNBQVMsS0FBSyxTQUFTO0lBQUssV0FBVztJQUNyRSxPQUFPO0lBQVMsV0FBVztJQUFVLFNBQVMsU0FBUztJQUFTLFNBQVM7SUFBUSxlQUFlO0lBQVUsWUFBWTtHQUN4SCxDQUFDLEVBQUUsR0FBRyxTQUFTLE1BQU07OzswQkFHTCxJQUFJLElBQUk7SUFBRSxVQUFVO0lBQWMsWUFBWTtJQUFLLGVBQWU7SUFBYSxlQUFlO0lBQVUsU0FBUyxVQUFVLFVBQVU7SUFBSyxjQUFjO0dBQUUsQ0FBQyxFQUFFLEdBQUcsVUFBVSxNQUFNOzBCQUNoTCxJQUFJLElBQUk7SUFDcEIsVUFBVTtJQUFnQixZQUFZO0lBQUssWUFBWSxJQUFJLE1BQU0sTUFBTSxXQUFXLEVBQUc7SUFDckYsU0FBUztJQUFtQixjQUFjLGNBQWMsS0FBSyxJQUFJLFVBQVU7SUFDM0UsU0FBUyxVQUFVO0lBQVMsZUFBZTtJQUFhLGVBQWU7R0FDekUsQ0FBQyxFQUFFLEdBQUcsVUFBVSxNQUFNLElBQUksVUFBVTs7OzBCQUd0QixJQUFJLElBQUk7SUFBRSxXQUFXLGNBQWMsV0FBVztJQUFNLGNBQWMsVUFBVSxJQUFJLEtBQUs7R0FBRSxDQUFDLEVBQUU7NEJBQ3hGLElBQUksSUFBSTtJQUFFLFVBQVU7SUFBVSxZQUFZO0lBQUssZUFBZTtJQUFXLFlBQVk7SUFBSyxXQUFXLFdBQVc7SUFBSyxZQUFZO0dBQVMsQ0FBQyxFQUFFLElBQUksYUFBYTs0QkFDOUosSUFBSSxJQUFJO0lBQUUsVUFBVTtJQUFVLFlBQVk7SUFBSyxlQUFlO0lBQVcsWUFBWTtJQUFLLGNBQWM7SUFBWSxXQUFXLFdBQVc7SUFBSyxZQUFZO0dBQVMsQ0FBQyxFQUFFLElBQUksYUFBYTs0QkFDeEwsSUFBSSxJQUFJO0lBQUUsVUFBVTtJQUFlLFlBQVk7SUFBSyxXQUFXLGdCQUFnQjtJQUFLLFNBQVMsT0FBTyxJQUFJLEtBQU07SUFBRyxZQUFZO0dBQVMsQ0FBQyxFQUFFLElBQUksaUJBQWlCOzs7OzBCQUloSyxJQUFJLElBQUk7SUFBRSxVQUFVO0lBQVcsWUFBWTtJQUFLLFlBQVk7SUFBSyxjQUFjO0lBQWEsU0FBUyxVQUFVO0dBQVEsQ0FBQyxFQUFFLEdBQUcsVUFBVSxNQUFNLElBQUksVUFBVTs7OzBCQUczSixJQUFJLElBQUk7SUFBRSxTQUFTLGNBQWM7SUFBUyxjQUFjO0lBQWEsV0FBVztHQUFTLENBQUMsRUFBRSxHQUFHLGNBQWMsTUFBTTs0QkFDakgsSUFBSSxJQUFJO0lBQUUsVUFBVTtJQUFlLFlBQVk7SUFBSyxjQUFjO0dBQUUsQ0FBQyxFQUFFLElBQUksS0FBSyxLQUFLLFVBQVU7NEJBQy9GLElBQUksSUFBSTtJQUFFLFVBQVU7SUFBYSxZQUFZO0lBQUssU0FBUztHQUFLLENBQUMsRUFBRSxJQUFJLFFBQVE7Ozs7MEJBSWpGLElBQUksSUFBSTtJQUFFLFVBQVU7SUFBUyxZQUFZO0lBQUssV0FBVztJQUFVLFNBQVMsUUFBUSxVQUFVO0dBQUksQ0FBQyxFQUFFLEdBQUcsUUFBUSxNQUFNOzs7OztFQUs5STtDQUNGIn0=