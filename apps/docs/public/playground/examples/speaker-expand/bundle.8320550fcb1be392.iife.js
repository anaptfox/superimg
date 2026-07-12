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
			speakerName: "Jane Doe",
			speakerTitle: "Principal Engineer @ TechCo",
			speakerPhoto: "https://i.pravatar.cc/500?img=47",
			talkTitle: "Scaling with React Server Components",
			date: "March 18",
			time: "11 AM – 1 PM",
			address: "3 NE 8th St · Oklahoma City, OK",
			groupName: "OKC ReactJS",
			backgroundImage: "https://secure.meetupstatic.com/photos/event/8/6/9/7/highres_516994455.jpeg",
			brandColor: "#0f172a",
			techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "12s",
			fonts: ["Inter:wght@400;500;600;700;800;900"],
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
			const { std, timeline, width, height, data, isPortrait } = ctx;
			const { speakerName, speakerTitle, speakerPhoto, talkTitle, date, time: eventTime, address, groupName, brandColor, backgroundImage, techlahomaSvg } = data;
			const mainDur = 9;
			const r = std.createResponsive(ctx);
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
					for: `${(1 / 3 * 100).toFixed(1)}%`,
					exit: false
				});
				return `<div style="${std.css({
					width,
					height,
					background: "#000",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				})}"><img src="${techlahomaSvg}" style="${std.css({
					width: logoWidth,
					opacity: logoAnim.opacity
				})};${logoAnim.style}" /></div>`;
			}
			const bg = std.backgrounds.kenBurns({
				src: backgroundImage,
				progress: timeline.seconds / mainDur,
				zoomTo: 1.1,
				overlay: "rgba(0, 0, 0, 0.7)"
			});
			const avatarAnim = t.motion({
				during: "main",
				at: `${(.5 / 9 * 100).toFixed(1)}%`,
				for: `${(.6 / 9 * 100).toFixed(1)}%`,
				scale: .5
			});
			const profileAnim = t.motion({
				during: "main",
				at: `${(.8 / 9 * 100).toFixed(1)}%`,
				for: `${(.5 / 9 * 100).toFixed(1)}%`,
				y: 20
			});
			const expandP = t.tween(0, 1, {
				during: "main",
				at: `${(3 / 9 * 100).toFixed(1)}%`,
				for: `${(.6 / 9 * 100).toFixed(1)}%`,
				easing: "easeInOutCubic"
			});
			const cardContentAnim = t.motion({
				during: "main",
				at: `${(3.3 / 9 * 100).toFixed(1)}%`,
				for: `${(.5 / 9 * 100).toFixed(1)}%`,
				y: 20
			});
			const fadeOut = 1 - t.tween(0, 1, {
				during: "main",
				at: `${(8.5 / 9 * 100).toFixed(1)}%`,
				for: `${(.5 / 9 * 100).toFixed(1)}%`,
				easing: "easeInCubic"
			});
			const shiftYAmount = r({
				portrait: -350,
				square: -250,
				default: -200
			});
			const profileShiftY = std.interpolate(expandP, [0, 1], [0, shiftYAmount], "easeInOutCubic");
			const profileScale = std.interpolate(expandP, [0, 1], [1, .85], "easeInOutCubic");
			const cardHeightBase = r({
				portrait: 700,
				square: 500,
				default: 480
			});
			const cardHeight = std.interpolate(expandP, [0, 1], [0, cardHeightBase], "easeInOutCubic");
			const cardOpacity = std.interpolate(expandP, [0, 1], [0, 1], "easeInOutCubic");
			const avatarSize = r({
				portrait: 360,
				square: 280,
				default: 280
			});
			const nameSize = r({
				portrait: 64,
				square: 48,
				default: 56
			});
			const titleSize = r({
				portrait: 28,
				square: 24,
				default: 28
			});
			const cardWidth = r({
				portrait: "90%",
				square: "80%",
				default: "60%"
			});
			const talkSize = r({
				portrait: 40,
				square: 32,
				default: 40
			});
			const logisticsSize = r({
				portrait: 28,
				square: 20,
				default: 24
			});
			const cardPadding = r({
				portrait: "40px 60px 60px",
				default: "40px 60px 50px"
			});
			const cardMarginTop = r({
				portrait: 120,
				square: 80,
				default: 60
			});
			return `
      <div style="${std.css({
				width,
				height,
				position: "relative",
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			})}">
        ${bg.html}
        <div style="${std.css({
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				position: "relative",
				width: "100%",
				opacity: fadeOut
			})}">

          <!-- Profile Block -->
          <div style="${std.css({
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				transform: `translateY(${profileShiftY}px) scale(${profileScale})`,
				position: "relative",
				zIndex: 10
			})}">
            <div style="${std.css({
				width: avatarSize,
				height: avatarSize,
				borderRadius: "50%",
				backgroundImage: `url(${speakerPhoto})`,
				backgroundSize: "cover",
				border: "8px solid #cbd5e1",
				boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
				opacity: avatarAnim.opacity,
				marginBottom: 32
			})};${avatarAnim.style}"></div>
            <div style="${std.css({
				textAlign: "center",
				color: "white",
				opacity: profileAnim.opacity,
				textShadow: "0 4px 12px rgba(0,0,0,0.8)"
			})};${profileAnim.style}">
              <div style="${std.css({
				fontSize: nameSize,
				fontWeight: 900,
				letterSpacing: "-0.02em",
				lineHeight: 1.1,
				marginBottom: 8
			})}">${speakerName}</div>
              <div style="${std.css({
				fontSize: titleSize,
				fontWeight: 500,
				color: "#61dafb"
			})}">${speakerTitle}</div>
            </div>
          </div>

          <!-- Expanding Card -->
          <div style="${std.css({
				position: "absolute",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				width: cardWidth,
				maxWidth: 1e3,
				display: "flex",
				justifyContent: "center",
				marginTop: cardMarginTop
			})}">
            <div style="${std.css({
				width: "100%",
				height: cardHeight,
				background: std.color.alpha(brandColor, .95),
				borderRadius: 24,
				boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
				opacity: cardOpacity,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				padding: cardPadding,
				textAlign: "center",
				color: "white"
			})}">
              <div style="${std.css({
				opacity: cardContentAnim.opacity,
				display: "flex",
				flexDirection: "column",
				height: "100%",
				justifyContent: "flex-end"
			})};${cardContentAnim.style}">
                <div style="${std.css({
				fontSize: 16,
				textTransform: "uppercase",
				letterSpacing: "0.15em",
				fontWeight: 700,
				color: "#61dafb",
				marginBottom: 16
			})}">${groupName} Presents</div>
                <div style="${std.css({
				fontSize: talkSize,
				fontWeight: 800,
				lineHeight: 1.2,
				fontStyle: "italic",
				marginBottom: 32
			})}">"${talkTitle}"</div>
                <div style="${std.css({
				borderTop: `1px solid ${std.color.alpha("#ffffff", .2)}`,
				paddingTop: 24
			})}">
                  <div style="${std.css({
				fontSize: logisticsSize,
				fontWeight: 600,
				marginBottom: 8
			})}">${date} · ${eventTime}</div>
                  <div style="${std.css({
				fontSize: logisticsSize * .8,
				fontWeight: 400,
				opacity: .7
			})}">${address}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BlYWtlci1leHBhbmQubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2V2ZW50cy9zcGVha2VyLWV4cGFuZC9zcGVha2VyLWV4cGFuZC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBzYW1wbGU6IHtcbiAgICBzcGVha2VyTmFtZTogXCJKYW5lIERvZVwiLFxuICAgIHNwZWFrZXJUaXRsZTogXCJQcmluY2lwYWwgRW5naW5lZXIgQCBUZWNoQ29cIixcbiAgICBzcGVha2VyUGhvdG86IFwiaHR0cHM6Ly9pLnByYXZhdGFyLmNjLzUwMD9pbWc9NDdcIixcbiAgICB0YWxrVGl0bGU6IFwiU2NhbGluZyB3aXRoIFJlYWN0IFNlcnZlciBDb21wb25lbnRzXCIsXG4gICAgZGF0ZTogXCJNYXJjaCAxOFwiLFxuICAgIHRpbWU6IFwiMTEgQU0g4oCTIDEgUE1cIixcbiAgICBhZGRyZXNzOiBcIjMgTkUgOHRoIFN0IMK3IE9rbGFob21hIENpdHksIE9LXCIsXG4gICAgZ3JvdXBOYW1lOiBcIk9LQyBSZWFjdEpTXCIsXG4gICAgYmFja2dyb3VuZEltYWdlOiBcImh0dHBzOi8vc2VjdXJlLm1lZXR1cHN0YXRpYy5jb20vcGhvdG9zL2V2ZW50LzgvNi85LzcvaGlnaHJlc181MTY5OTQ0NTUuanBlZ1wiLFxuICAgIGJyYW5kQ29sb3I6IFwiIzBmMTcyYVwiLFxuICAgIHRlY2hsYWhvbWFTdmc6IFwiaHR0cHM6Ly93d3cudGVjaGxhaG9tYS5vcmcvd3AtY29udGVudC91cGxvYWRzLzIwMjQvMDkvY3JvcHBlZC10ZWNobGFob21hX2hvcml6b250YWx0ZXh0LXdoaXRlLnBuZ1wiLFxuICB9LFxuXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjEyc1wiLFxuICAgIGZvbnRzOiBbXCJJbnRlcjp3Z2h0QDQwMDs1MDA7NjAwOzcwMDs4MDA7OTAwXCJdLFxuICAgIGF1ZGlvOiB7XG4gICAgICBpZDogXCJiZWRcIixcbiAgICAgIHNyYzogXCIuLi8uLi9fYXNzZXRzL2xvZmktYmcubXAzXCIsXG4gICAgICByb2xlOiBcIm11c2ljXCIsXG4gICAgICB2b2x1bWU6IDAuNixcbiAgICAgIGZhZGVJbjogXCIwLjVzXCIsXG4gICAgICBmYWRlT3V0OiBcIjEuNXNcIixcbiAgICAgIGxvb3A6IHRydWUsXG4gICAgfSxcbiAgICBvdXRwdXRzOiB7XG4gICAgICBsYW5kc2NhcGU6IHsgd2lkdGg6IDE5MjAsIGhlaWdodDogMTA4MCB9LFxuICAgICAgc3F1YXJlOiB7IHdpZHRoOiAxMDgwLCBoZWlnaHQ6IDEwODAgfSxcbiAgICAgIHN0b3J5OiB7IHdpZHRoOiAxMDgwLCBoZWlnaHQ6IDE5MjAgfSxcbiAgICB9LFxuICAgIGlubGluZUNzczogW2BcbiAgICAgICogeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cbiAgICAgIGJvZHkgeyBmb250LWZhbWlseTogJ0ludGVyJywgc2Fucy1zZXJpZjsgb3ZlcmZsb3c6IGhpZGRlbjsgfVxuICAgIGBdLFxuICB9LFxuXG4gIHJlbmRlcihjdHgpIHtcbiAgICBjb25zdCB7IHN0ZCwgdGltZWxpbmUsIHdpZHRoLCBoZWlnaHQsIGRhdGEsIGlzUG9ydHJhaXQgfSA9IGN0eDtcbiAgICBjb25zdCB7IHNwZWFrZXJOYW1lLCBzcGVha2VyVGl0bGUsIHNwZWFrZXJQaG90bywgdGFsa1RpdGxlLCBkYXRlLCB0aW1lOiBldmVudFRpbWUsIGFkZHJlc3MsIGdyb3VwTmFtZSwgYnJhbmRDb2xvciwgYmFja2dyb3VuZEltYWdlLCB0ZWNobGFob21hU3ZnIH0gPSBkYXRhO1xuXG4gICAgY29uc3QgbWFpbkR1ciA9IDkuMDtcbiAgICBjb25zdCByID0gc3RkLmNyZWF0ZVJlc3BvbnNpdmUoY3R4KTtcblxuICAgIC8vIGRpcmVjdG9yIHBoYXNlczogbWFpbiAoOXMpIOKGkiBvdXRybyAoM3MpXG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3Rvcih7IG1haW46IFwiOS4wc1wiLCBvdXRybzogXCIzLjBzXCIgfSk7XG5cbiAgICAvLyA9PT0gT1VUUk8gUEhBU0UgPT09XG4gICAgaWYgKHQuYWN0aXZlID09PSBcIm91dHJvXCIpIHtcbiAgICAgIGNvbnN0IGxvZ29XaWR0aCA9IHIoeyBwb3J0cmFpdDogNTAwLCBzcXVhcmU6IDQwMCwgZGVmYXVsdDogNDgwIH0pO1xuICAgICAgY29uc3QgbG9nb0FuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJvdXRyb1wiLCBzY2FsZTogMC4xLCBmb3I6IGAkeygoMS8zKSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZXhpdDogZmFsc2UgfSk7XG5cbiAgICAgIHJldHVybiBgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoLCBoZWlnaHQsIGJhY2tncm91bmQ6IFwiIzAwMFwiLCBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIgfSl9XCI+PGltZyBzcmM9XCIke3RlY2hsYWhvbWFTdmd9XCIgc3R5bGU9XCIke3N0ZC5jc3MoeyB3aWR0aDogbG9nb1dpZHRoLCBvcGFjaXR5OiBsb2dvQW5pbS5vcGFjaXR5IH0pfTske2xvZ29BbmltLnN0eWxlfVwiIC8+PC9kaXY+YDtcbiAgICB9XG5cbiAgICAvLyA9PT0gTUFJTiBDT05URU5UID09PVxuICAgIGNvbnN0IGJnID0gc3RkLmJhY2tncm91bmRzLmtlbkJ1cm5zKHsgc3JjOiBiYWNrZ3JvdW5kSW1hZ2UsIHByb2dyZXNzOiB0aW1lbGluZS5zZWNvbmRzIC8gbWFpbkR1ciwgem9vbVRvOiAxLjEsIG92ZXJsYXk6IFwicmdiYSgwLCAwLCAwLCAwLjcpXCIgfSk7XG5cbiAgICAvLyBUcmlnZ2VycyB3aXRoaW4gXCJtYWluXCIgcGhhc2UgKDlzKVxuICAgIGNvbnN0IGF2YXRhckFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJtYWluXCIsIGF0OiBgJHsoKDAuNS85KSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZm9yOiBgJHsoKDAuNi85KSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgc2NhbGU6IDAuNSB9KTtcbiAgICBjb25zdCBwcm9maWxlQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IGAkeygoMC44LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBmb3I6IGAkeygoMC41LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCB5OiAyMCB9KTtcbiAgICBjb25zdCBleHBhbmRQID0gdC50d2VlbigwLCAxLCB7IGR1cmluZzogXCJtYWluXCIsIGF0OiBgJHsoKDMuMC85KSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZm9yOiBgJHsoKDAuNi85KSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZWFzaW5nOiBcImVhc2VJbk91dEN1YmljXCIgfSk7XG4gICAgY29uc3QgY2FyZENvbnRlbnRBbmltID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwibWFpblwiLCBhdDogYCR7KCgzLjMvOSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogYCR7KCgwLjUvOSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIHk6IDIwIH0pO1xuXG4gICAgLy8gR2xvYmFsIGZhZGUgb3V0IGF0IGVuZCBvZiBtYWluXG4gICAgY29uc3QgZmFkZU91dFAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IGAkeygoOC41LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBmb3I6IGAkeygoMC41LzkpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBlYXNpbmc6IFwiZWFzZUluQ3ViaWNcIiB9KTtcbiAgICBjb25zdCBmYWRlT3V0ID0gMSAtIGZhZGVPdXRQO1xuXG4gICAgY29uc3Qgc2hpZnRZQW1vdW50ID0gcih7IHBvcnRyYWl0OiAtMzUwLCBzcXVhcmU6IC0yNTAsIGRlZmF1bHQ6IC0yMDAgfSk7XG4gICAgY29uc3QgcHJvZmlsZVNoaWZ0WSA9IHN0ZC5pbnRlcnBvbGF0ZShleHBhbmRQLCBbMCwgMV0sIFswLCBzaGlmdFlBbW91bnRdLCBcImVhc2VJbk91dEN1YmljXCIpO1xuICAgIGNvbnN0IHByb2ZpbGVTY2FsZSA9IHN0ZC5pbnRlcnBvbGF0ZShleHBhbmRQLCBbMCwgMV0sIFsxLCAwLjg1XSwgXCJlYXNlSW5PdXRDdWJpY1wiKTtcblxuICAgIGNvbnN0IGNhcmRIZWlnaHRCYXNlID0gcih7IHBvcnRyYWl0OiA3MDAsIHNxdWFyZTogNTAwLCBkZWZhdWx0OiA0ODAgfSk7XG4gICAgY29uc3QgY2FyZEhlaWdodCA9IHN0ZC5pbnRlcnBvbGF0ZShleHBhbmRQLCBbMCwgMV0sIFswLCBjYXJkSGVpZ2h0QmFzZV0sIFwiZWFzZUluT3V0Q3ViaWNcIik7XG4gICAgY29uc3QgY2FyZE9wYWNpdHkgPSBzdGQuaW50ZXJwb2xhdGUoZXhwYW5kUCwgWzAsIDFdLCBbMCwgMV0sIFwiZWFzZUluT3V0Q3ViaWNcIik7XG5cbiAgICAvLyBSZXNwb25zaXZlIHNpemluZ1xuICAgIGNvbnN0IGF2YXRhclNpemUgPSByKHsgcG9ydHJhaXQ6IDM2MCwgc3F1YXJlOiAyODAsIGRlZmF1bHQ6IDI4MCB9KTtcbiAgICBjb25zdCBuYW1lU2l6ZSA9IHIoeyBwb3J0cmFpdDogNjQsIHNxdWFyZTogNDgsIGRlZmF1bHQ6IDU2IH0pO1xuICAgIGNvbnN0IHRpdGxlU2l6ZSA9IHIoeyBwb3J0cmFpdDogMjgsIHNxdWFyZTogMjQsIGRlZmF1bHQ6IDI4IH0pO1xuICAgIGNvbnN0IGNhcmRXaWR0aCA9IHIoeyBwb3J0cmFpdDogXCI5MCVcIiwgc3F1YXJlOiBcIjgwJVwiLCBkZWZhdWx0OiBcIjYwJVwiIH0pO1xuICAgIGNvbnN0IHRhbGtTaXplID0gcih7IHBvcnRyYWl0OiA0MCwgc3F1YXJlOiAzMiwgZGVmYXVsdDogNDAgfSk7XG4gICAgY29uc3QgbG9naXN0aWNzU2l6ZSA9IHIoeyBwb3J0cmFpdDogMjgsIHNxdWFyZTogMjAsIGRlZmF1bHQ6IDI0IH0pO1xuICAgIGNvbnN0IGNhcmRQYWRkaW5nID0gcih7IHBvcnRyYWl0OiBcIjQwcHggNjBweCA2MHB4XCIsIGRlZmF1bHQ6IFwiNDBweCA2MHB4IDUwcHhcIiB9KTtcbiAgICBjb25zdCBjYXJkTWFyZ2luVG9wID0gcih7IHBvcnRyYWl0OiAxMjAsIHNxdWFyZTogODAsIGRlZmF1bHQ6IDYwIH0pO1xuXG4gICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyB3aWR0aCwgaGVpZ2h0LCBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLCBvdmVyZmxvdzogXCJoaWRkZW5cIiwgZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiIH0pfVwiPlxuICAgICAgICAke2JnLmh0bWx9XG4gICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgcG9zaXRpb246IFwicmVsYXRpdmVcIiwgd2lkdGg6IFwiMTAwJVwiLCBvcGFjaXR5OiBmYWRlT3V0IH0pfVwiPlxuXG4gICAgICAgICAgPCEtLSBQcm9maWxlIEJsb2NrIC0tPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgdHJhbnNmb3JtOiBgdHJhbnNsYXRlWSgke3Byb2ZpbGVTaGlmdFl9cHgpIHNjYWxlKCR7cHJvZmlsZVNjYWxlfSlgLCBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLCB6SW5kZXg6IDEwIH0pfVwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoOiBhdmF0YXJTaXplLCBoZWlnaHQ6IGF2YXRhclNpemUsIGJvcmRlclJhZGl1czogXCI1MCVcIiwgYmFja2dyb3VuZEltYWdlOiBgdXJsKCR7c3BlYWtlclBob3RvfSlgLCBiYWNrZ3JvdW5kU2l6ZTogXCJjb3ZlclwiLCBib3JkZXI6IFwiOHB4IHNvbGlkICNjYmQ1ZTFcIiwgYm94U2hhZG93OiBcIjAgMTZweCA0OHB4IHJnYmEoMCwwLDAsMC40KVwiLCBvcGFjaXR5OiBhdmF0YXJBbmltLm9wYWNpdHksIG1hcmdpbkJvdHRvbTogMzIgfSl9OyR7YXZhdGFyQW5pbS5zdHlsZX1cIj48L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyB0ZXh0QWxpZ246IFwiY2VudGVyXCIsIGNvbG9yOiBcIndoaXRlXCIsIG9wYWNpdHk6IHByb2ZpbGVBbmltLm9wYWNpdHksIHRleHRTaGFkb3c6IFwiMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuOClcIiB9KX07JHtwcm9maWxlQW5pbS5zdHlsZX1cIj5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBuYW1lU2l6ZSwgZm9udFdlaWdodDogOTAwLCBsZXR0ZXJTcGFjaW5nOiBcIi0wLjAyZW1cIiwgbGluZUhlaWdodDogMS4xLCBtYXJnaW5Cb3R0b206IDggfSl9XCI+JHtzcGVha2VyTmFtZX08L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiB0aXRsZVNpemUsIGZvbnRXZWlnaHQ6IDUwMCwgY29sb3I6IFwiIzYxZGFmYlwiIH0pfVwiPiR7c3BlYWtlclRpdGxlfTwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8IS0tIEV4cGFuZGluZyBDYXJkIC0tPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLCB0b3A6IFwiNTAlXCIsIGxlZnQ6IFwiNTAlXCIsIHRyYW5zZm9ybTogXCJ0cmFuc2xhdGUoLTUwJSwgLTUwJSlcIiwgd2lkdGg6IGNhcmRXaWR0aCwgbWF4V2lkdGg6IDEwMDAsIGRpc3BsYXk6IFwiZmxleFwiLCBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIiwgbWFyZ2luVG9wOiBjYXJkTWFyZ2luVG9wIH0pfVwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICAgIHdpZHRoOiBcIjEwMCVcIiwgaGVpZ2h0OiBjYXJkSGVpZ2h0LCBiYWNrZ3JvdW5kOiBzdGQuY29sb3IuYWxwaGEoYnJhbmRDb2xvciwgMC45NSksIGJvcmRlclJhZGl1czogMjQsXG4gICAgICAgICAgICAgIGJveFNoYWRvdzogXCIwIDI0cHggNjRweCByZ2JhKDAsIDAsIDAsIDAuNSlcIiwgb3BhY2l0eTogY2FyZE9wYWNpdHksIG92ZXJmbG93OiBcImhpZGRlblwiLFxuICAgICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwganVzdGlmeUNvbnRlbnQ6IFwiZmxleC1lbmRcIiwgcGFkZGluZzogY2FyZFBhZGRpbmcsIHRleHRBbGlnbjogXCJjZW50ZXJcIiwgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgICAgIH0pfVwiPlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgb3BhY2l0eTogY2FyZENvbnRlbnRBbmltLm9wYWNpdHksIGRpc3BsYXk6IFwiZmxleFwiLCBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLCBoZWlnaHQ6IFwiMTAwJVwiLCBqdXN0aWZ5Q29udGVudDogXCJmbGV4LWVuZFwiIH0pfTske2NhcmRDb250ZW50QW5pbS5zdHlsZX1cIj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IDE2LCB0ZXh0VHJhbnNmb3JtOiBcInVwcGVyY2FzZVwiLCBsZXR0ZXJTcGFjaW5nOiBcIjAuMTVlbVwiLCBmb250V2VpZ2h0OiA3MDAsIGNvbG9yOiBcIiM2MWRhZmJcIiwgbWFyZ2luQm90dG9tOiAxNiB9KX1cIj4ke2dyb3VwTmFtZX0gUHJlc2VudHM8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHRhbGtTaXplLCBmb250V2VpZ2h0OiA4MDAsIGxpbmVIZWlnaHQ6IDEuMiwgZm9udFN0eWxlOiBcIml0YWxpY1wiLCBtYXJnaW5Cb3R0b206IDMyIH0pfVwiPlwiJHt0YWxrVGl0bGV9XCI8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgYm9yZGVyVG9wOiBgMXB4IHNvbGlkICR7c3RkLmNvbG9yLmFscGhhKFwiI2ZmZmZmZlwiLCAwLjIpfWAsIHBhZGRpbmdUb3A6IDI0IH0pfVwiPlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBsb2dpc3RpY3NTaXplLCBmb250V2VpZ2h0OiA2MDAsIG1hcmdpbkJvdHRvbTogOCB9KX1cIj4ke2RhdGV9IMK3ICR7ZXZlbnRUaW1lfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBsb2dpc3RpY3NTaXplICogMC44LCBmb250V2VpZ2h0OiA0MDAsIG9wYWNpdHk6IDAuNyB9KX1cIj4ke2FkZHJlc3N9PC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgfSxcbn0pO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQSxTQUFTLE9BQU8sT0FBTztFQUN0QixNQUFNLFNBQVMsTUFBTSxVQUFVO0VBQy9CLE1BQU0sSUFBSSxNQUFNO0VBQ2hCLE1BQU0sYUFBYSxPQUFPLE1BQU0sWUFBWTtFQUM1QyxPQUFPO0dBQ047R0FDQSxVQUFVLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRSxRQUFRLGFBQWEsRUFBRSxZQUFZLFFBQVE7R0FDckUsUUFBUSxNQUFNO0dBQ2QsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLGFBQWEsRUFBRSxTQUFTLE1BQU0sUUFBUSxJQUFJLENBQUM7RUFDL0M7Q0FDRDs7Ozs7Ozs7Ozs7Ozs7OzttQkN2Q2UsT0FBTztFQUNwQixRQUFRO0dBQ04sYUFBYTtHQUNiLGNBQWM7R0FDZCxjQUFjO0dBQ2QsV0FBVztHQUNYLE1BQU07R0FDTixNQUFNO0dBQ04sU0FBUztHQUNULFdBQVc7R0FDWCxpQkFBaUI7R0FDakIsWUFBWTtHQUNaLGVBQWU7RUFDakI7RUFFQSxRQUFRO0dBQ04sT0FBTztHQUNQLFFBQVE7R0FDUixLQUFLO0dBQ0wsVUFBVTtHQUNWLE9BQU8sQ0FBQyxvQ0FBb0M7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