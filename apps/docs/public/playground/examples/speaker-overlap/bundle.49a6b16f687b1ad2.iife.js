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
			hook: "Meet the Speaker.",
			hookLine2: "Deep dive into React Server Components.",
			talkTitle: "Scaling with React Server Components",
			backgroundImage: "https://secure.meetupstatic.com/photos/event/8/6/9/7/highres_516994455.jpeg",
			date: "March 18",
			time: "11 AM – 1 PM",
			address: "3 NE 8th St · Oklahoma City, OK",
			groupName: "OKC ReactJS",
			brandColor: "#0f172a",
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
			const { std, timeline, width, height, data, isPortrait } = ctx;
			const { hook, hookLine2, speakerName, speakerTitle, speakerPhoto, talkTitle, backgroundImage, date, time: eventTime, address, groupName, brandColor, techlahomaSvg } = data;
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
				overlay: "rgba(0, 0, 0, 0.65)"
			});
			const hook1P = t.tween(0, 1, {
				during: "main",
				at: "0%",
				for: "0.8s"
			});
			const hook2P = t.tween(0, 1, {
				during: "main",
				at: "1.4s",
				for: "0.7s"
			});
			const speakerInfoAnim = t.motion({
				during: "main",
				at: "2.7s",
				for: "0.6s"
			});
			const expandP = t.tween(0, 1, {
				during: "main",
				at: "4.0s",
				for: "0.5s",
				easing: "easeInOutCubic"
			});
			const groupAnim = t.motion({
				during: "main",
				at: "4.2s",
				for: "0.4s",
				y: -20
			});
			const talkAnim = t.motion({
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
			const hookShiftAmount = r({
				portrait: -80,
				default: -60
			});
			const hookShiftY = std.interpolate(expandP, [0, 1], [0, hookShiftAmount], "easeInOutCubic");
			const cardWidth = r({
				portrait: "90%",
				square: "75%",
				default: "65%"
			});
			const cardMaxWidth = r({
				portrait: 972,
				default: 900
			});
			const hookSize = r({
				portrait: 56,
				square: 32,
				default: 44
			});
			const speakerNameSize = r({
				portrait: 44,
				square: 28,
				default: 36
			});
			const speakerTitleSize = r({
				portrait: 28,
				square: 16,
				default: 20
			});
			const talkSize = r({
				portrait: 36,
				square: 20,
				default: 28
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
			const paddingX = r({
				portrait: 48,
				square: 36,
				default: 48
			});
			const paddingY = r({
				portrait: 64,
				square: 36,
				default: 48
			});
			const avatarSize = r({
				portrait: 280,
				square: 200,
				default: 300
			});
			const portraitPaddingTop = paddingY + avatarSize / 2;
			const landscapePaddingRight = paddingX + avatarSize / 2;
			const cardHtml = `
          <div style="${std.css({
				width: cardWidth,
				maxWidth: cardMaxWidth,
				background: std.color.alpha(brandColor, .95),
				borderRadius: 16,
				paddingTop: isPortrait ? portraitPaddingTop : paddingY,
				paddingBottom: paddingY,
				paddingLeft: paddingX,
				paddingRight: isPortrait ? paddingX : landscapePaddingRight,
				boxShadow: "0 24px 64px rgba(0, 0, 0, 0.4)",
				color: "white",
				textAlign: isPortrait ? "center" : "left",
				opacity: cardAnim.opacity,
				display: "flex",
				flexDirection: "column",
				alignItems: isPortrait ? "center" : "flex-start",
				position: "relative"
			})};${cardAnim.style}">

            <!-- Overlapping Speaker Avatar -->
            <div style="${std.css({
				width: avatarSize,
				height: avatarSize,
				borderRadius: "50%",
				backgroundImage: `url(${speakerPhoto})`,
				backgroundSize: "cover",
				position: "absolute",
				top: isPortrait ? -avatarSize / 2 : "50%",
				marginTop: isPortrait ? 0 : -avatarSize / 2,
				right: isPortrait ? "auto" : -avatarSize / 3,
				left: isPortrait ? "50%" : "auto",
				marginLeft: isPortrait ? -avatarSize / 2 : 0,
				border: "8px solid #cbd5e1",
				boxShadow: "0 16px 32px rgba(0,0,0,0.3)"
			})}"></div>

            <!-- Hook section -->
            <div style="${std.css({
				transform: `translateY(${hookShiftY}px)`,
				marginBottom: expandP > 0 ? 16 : 0
			})}">
              <div style="${std.css({
				fontSize: 16,
				fontWeight: 600,
				background: std.color.alpha("#ffffff", .2),
				padding: "6px 16px",
				marginBottom: 24,
				opacity: groupAnim.opacity,
				textTransform: "uppercase",
				letterSpacing: "0.1em",
				display: "inline-block"
			})};${groupAnim.style}">${groupName}</div>

              <div style="${std.css({
				fontSize: hookSize,
				fontWeight: 800,
				letterSpacing: "-0.02em",
				lineHeight: 1.1,
				minHeight: hookSize * 1.1
			})}">${hook1Visible}</div>
              <div style="${std.css({
				fontSize: hookSize * .7,
				fontWeight: 500,
				letterSpacing: "-0.01em",
				lineHeight: 1.2,
				marginBottom: 20,
				minHeight: hookSize * .7 * 1.2,
				opacity: .8
			})}">${hook2Visible}</div>
            </div>

            <!-- Speaker Info -->
            <div style="${std.css({
				opacity: speakerInfoAnim.opacity,
				marginBottom: 16
			})};${speakerInfoAnim.style}">
              <div style="${std.css({
				fontSize: speakerNameSize,
				fontWeight: 700
			})}">${speakerName}</div>
              <div style="${std.css({
				fontSize: speakerTitleSize,
				fontWeight: 400,
				color: "#61dafb"
			})}">${speakerTitle}</div>
            </div>

            <!-- Talk Title -->
            <div style="${std.css({
				fontSize: talkSize,
				fontWeight: 600,
				lineHeight: 1.2,
				marginBottom: 24,
				opacity: talkAnim.opacity,
				fontStyle: "italic"
			})};${talkAnim.style}">"${talkTitle}"</div>

            <!-- Logistics -->
            <div style="${std.css({ opacity: logisticsAnim.opacity })};${logisticsAnim.style}">
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
          </div>
    `;
			const L = std.layers({
				width,
				height
			});
			return L.render(L.bg(bg), L.content(`
        <div style="${std.css({
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 40
			})}">
          ${cardHtml}
        </div>
      `));
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BlYWtlci1vdmVybGFwLm1lZGlhLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLXR5cGVzL2Rpc3QvaW5kZXguanMiLCIuLi9leGFtcGxlcy9ldmVudHMvc3BlYWtlci1vdmVybGFwL3NwZWFrZXItb3ZlcmxhcC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBzYW1wbGU6IHtcbiAgICBzcGVha2VyTmFtZTogXCJKYW5lIERvZVwiLFxuICAgIHNwZWFrZXJUaXRsZTogXCJQcmluY2lwYWwgRW5naW5lZXIgQCBUZWNoQ29cIixcbiAgICBzcGVha2VyUGhvdG86IFwiaHR0cHM6Ly9pLnByYXZhdGFyLmNjLzUwMD9pbWc9NDdcIixcbiAgICBob29rOiBcIk1lZXQgdGhlIFNwZWFrZXIuXCIsXG4gICAgaG9va0xpbmUyOiBcIkRlZXAgZGl2ZSBpbnRvIFJlYWN0IFNlcnZlciBDb21wb25lbnRzLlwiLFxuICAgIHRhbGtUaXRsZTogXCJTY2FsaW5nIHdpdGggUmVhY3QgU2VydmVyIENvbXBvbmVudHNcIixcbiAgICBiYWNrZ3JvdW5kSW1hZ2U6IFwiaHR0cHM6Ly9zZWN1cmUubWVldHVwc3RhdGljLmNvbS9waG90b3MvZXZlbnQvOC82LzkvNy9oaWdocmVzXzUxNjk5NDQ1NS5qcGVnXCIsXG4gICAgZGF0ZTogXCJNYXJjaCAxOFwiLFxuICAgIHRpbWU6IFwiMTEgQU0g4oCTIDEgUE1cIixcbiAgICBhZGRyZXNzOiBcIjMgTkUgOHRoIFN0IMK3IE9rbGFob21hIENpdHksIE9LXCIsXG4gICAgZ3JvdXBOYW1lOiBcIk9LQyBSZWFjdEpTXCIsXG4gICAgYnJhbmRDb2xvcjogXCIjMGYxNzJhXCIsXG4gICAgdGVjaGxhaG9tYVN2ZzogXCJodHRwczovL3d3dy50ZWNobGFob21hLm9yZy93cC1jb250ZW50L3VwbG9hZHMvMjAyNC8wOS9jcm9wcGVkLXRlY2hsYWhvbWFfaG9yaXpvbnRhbHRleHQtd2hpdGUucG5nXCIsXG4gIH0sXG5cbiAgY29uZmlnOiB7XG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGZwczogMzAsXG4gICAgZHVyYXRpb246IFwiMTJzXCIsXG4gICAgZm9udHM6IFtcIkludGVyOndnaHRANDAwOzUwMDs2MDA7NzAwOzgwMFwiXSxcbiAgICBhdWRpbzoge1xuICAgICAgaWQ6IFwiYmVkXCIsXG4gICAgICBzcmM6IFwiLi4vLi4vX2Fzc2V0cy9sb2ZpLWJnLm1wM1wiLFxuICAgICAgcm9sZTogXCJtdXNpY1wiLFxuICAgICAgdm9sdW1lOiAwLjYsXG4gICAgICBmYWRlSW46IFwiMC41c1wiLFxuICAgICAgZmFkZU91dDogXCIxLjVzXCIsXG4gICAgICBsb29wOiB0cnVlLFxuICAgIH0sXG4gICAgb3V0cHV0czoge1xuICAgICAgbGFuZHNjYXBlOiB7IHdpZHRoOiAxOTIwLCBoZWlnaHQ6IDEwODAgfSxcbiAgICAgIHNxdWFyZTogeyB3aWR0aDogMTA4MCwgaGVpZ2h0OiAxMDgwIH0sXG4gICAgICBzdG9yeTogeyB3aWR0aDogMTA4MCwgaGVpZ2h0OiAxOTIwIH0sXG4gICAgfSxcbiAgICBpbmxpbmVDc3M6IFtgXG4gICAgICAqIHsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgICBib2R5IHsgZm9udC1mYW1pbHk6ICdJbnRlcicsIHNhbnMtc2VyaWY7IG92ZXJmbG93OiBoaWRkZW47IH1cbiAgICBgXSxcbiAgfSxcblxuICByZW5kZXIoY3R4KSB7XG4gICAgY29uc3QgeyBzdGQsIHRpbWVsaW5lLCB3aWR0aCwgaGVpZ2h0LCBkYXRhLCBpc1BvcnRyYWl0IH0gPSBjdHg7XG4gICAgY29uc3QgeyBob29rLCBob29rTGluZTIsIHNwZWFrZXJOYW1lLCBzcGVha2VyVGl0bGUsIHNwZWFrZXJQaG90bywgdGFsa1RpdGxlLCBiYWNrZ3JvdW5kSW1hZ2UsIGRhdGUsIHRpbWU6IGV2ZW50VGltZSwgYWRkcmVzcywgZ3JvdXBOYW1lLCBicmFuZENvbG9yLCB0ZWNobGFob21hU3ZnIH0gPSBkYXRhO1xuXG4gICAgY29uc3QgbWFpbkR1ciA9IDkuMDtcbiAgICBjb25zdCByID0gc3RkLmNyZWF0ZVJlc3BvbnNpdmUoY3R4KTtcblxuICAgIC8vIGRpcmVjdG9yIHBoYXNlczogbWFpbiAoOXMpIOKGkiBvdXRybyAoM3MpXG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3Rvcih7IG1haW46IFwiOS4wc1wiLCBvdXRybzogXCIzLjBzXCIgfSk7XG5cbiAgICAvLyA9PT0gT1VUUk8gUEhBU0UgPT09XG4gICAgaWYgKHQuYWN0aXZlID09PSBcIm91dHJvXCIpIHtcbiAgICAgIGNvbnN0IGxvZ29XaWR0aCA9IHIoeyBwb3J0cmFpdDogNTAwLCBzcXVhcmU6IDQwMCwgZGVmYXVsdDogNDgwIH0pO1xuICAgICAgY29uc3QgbG9nb0FuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJvdXRyb1wiLCBzY2FsZTogMC4xLCBmb3I6IFwiMS4wc1wiLCBleGl0OiBmYWxzZSB9KTtcblxuICAgICAgcmV0dXJuIGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoLCBoZWlnaHQsIGJhY2tncm91bmQ6IFwiIzAwMFwiLCBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIgfSl9XCI+XG4gICAgICAgICAgPGltZyBzcmM9XCIke3RlY2hsYWhvbWFTdmd9XCIgc3R5bGU9XCIke3N0ZC5jc3MoeyB3aWR0aDogbG9nb1dpZHRoLCBvcGFjaXR5OiBsb2dvQW5pbS5vcGFjaXR5IH0pfTske2xvZ29BbmltLnN0eWxlfVwiIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICB9XG5cbiAgICAvLyA9PT0gTUFJTiBDT05URU5UID09PVxuICAgIGNvbnN0IGJnID0gc3RkLmJhY2tncm91bmRzLmtlbkJ1cm5zKHsgc3JjOiBiYWNrZ3JvdW5kSW1hZ2UsIHByb2dyZXNzOiB0aW1lbGluZS5zZWNvbmRzIC8gbWFpbkR1ciwgem9vbVRvOiAxLjEsIG92ZXJsYXk6IFwicmdiYSgwLCAwLCAwLCAwLjY1KVwiIH0pO1xuXG4gICAgLy8gVHJpZ2dlcnMgd2l0aGluIFwibWFpblwiIHBoYXNlICg5cyBkdXJhdGlvbilcbiAgICBjb25zdCBob29rMVAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IFwiMCVcIiwgZm9yOiBcIjAuOHNcIiB9KTtcbiAgICBjb25zdCBob29rMlAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IFwiMS40c1wiLCBmb3I6IFwiMC43c1wiIH0pO1xuICAgIGNvbnN0IHNwZWFrZXJJbmZvQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IFwiMi43c1wiLCBmb3I6IFwiMC42c1wiIH0pO1xuICAgIGNvbnN0IGV4cGFuZFAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcIm1haW5cIiwgYXQ6IFwiNC4wc1wiLCBmb3I6IFwiMC41c1wiLCBlYXNpbmc6IFwiZWFzZUluT3V0Q3ViaWNcIiB9KTtcbiAgICBjb25zdCBncm91cEFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJtYWluXCIsIGF0OiBcIjQuMnNcIiwgZm9yOiBcIjAuNHNcIiwgeTogLTIwIH0pO1xuICAgIGNvbnN0IHRhbGtBbmltID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwibWFpblwiLCBhdDogXCI0LjRzXCIsIGZvcjogXCIwLjRzXCIsIHk6IDIwIH0pO1xuICAgIGNvbnN0IGxvZ2lzdGljc0FuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJtYWluXCIsIGF0OiBcIjQuN3NcIiwgZm9yOiBcIjAuNHNcIiwgeTogMjAgfSk7XG5cbiAgICAvLyBDYXJkIHdpdGggZW50ZXIgYW5kIGV4aXRcbiAgICBjb25zdCBjYXJkQW5pbSA9IHQubW90aW9uKHtcbiAgICAgIGR1cmluZzogXCJtYWluXCIsIGF0OiBcIjAlXCIsIGZvcjogXCIwLjVzXCIsIHNjYWxlOiAwLjA1LFxuICAgICAgLy8gRXhpdCB3aW5kb3cgaXMgaW4gYWJzb2x1dGUgc2NlbmUgZnJhY3Rpb25zOiBmYWRlIG91dCA4LjVz4oCTOXMsIGJlZm9yZSB0aGUgb3V0cm9cbiAgICAgIGV4aXQ6IHsgd2luZG93OiBbOC41IC8gMTIsIDkgLyAxMl0sIHk6IDAsIHNjYWxlOiAxIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IGhvb2sxVmlzaWJsZSA9IHN0ZC50ZXh0LnR5cGUoaG9vaywgaG9vazFQKS52aXNpYmxlO1xuICAgIGNvbnN0IGhvb2syVmlzaWJsZSA9IHN0ZC50ZXh0LnR5cGUoaG9va0xpbmUyLCBob29rMlApLnZpc2libGU7XG5cbiAgICBjb25zdCBob29rU2hpZnRBbW91bnQgPSByKHsgcG9ydHJhaXQ6IC04MCwgZGVmYXVsdDogLTYwIH0pO1xuICAgIGNvbnN0IGhvb2tTaGlmdFkgPSBzdGQuaW50ZXJwb2xhdGUoZXhwYW5kUCwgWzAsIDFdLCBbMCwgaG9va1NoaWZ0QW1vdW50XSwgXCJlYXNlSW5PdXRDdWJpY1wiKTtcblxuICAgIC8vIFJlc3BvbnNpdmUgc2l6aW5nXG4gICAgY29uc3QgY2FyZFdpZHRoID0gcih7IHBvcnRyYWl0OiBcIjkwJVwiLCBzcXVhcmU6IFwiNzUlXCIsIGRlZmF1bHQ6IFwiNjUlXCIgfSk7XG4gICAgY29uc3QgY2FyZE1heFdpZHRoID0gcih7IHBvcnRyYWl0OiA5NzIsIGRlZmF1bHQ6IDkwMCB9KTtcbiAgICBjb25zdCBob29rU2l6ZSA9IHIoeyBwb3J0cmFpdDogNTYsIHNxdWFyZTogMzIsIGRlZmF1bHQ6IDQ0IH0pO1xuICAgIGNvbnN0IHNwZWFrZXJOYW1lU2l6ZSA9IHIoeyBwb3J0cmFpdDogNDQsIHNxdWFyZTogMjgsIGRlZmF1bHQ6IDM2IH0pO1xuICAgIGNvbnN0IHNwZWFrZXJUaXRsZVNpemUgPSByKHsgcG9ydHJhaXQ6IDI4LCBzcXVhcmU6IDE2LCBkZWZhdWx0OiAyMCB9KTtcbiAgICBjb25zdCB0YWxrU2l6ZSA9IHIoeyBwb3J0cmFpdDogMzYsIHNxdWFyZTogMjAsIGRlZmF1bHQ6IDI4IH0pO1xuICAgIGNvbnN0IGxvZ2lzdGljc1NpemUgPSByKHsgcG9ydHJhaXQ6IDMyLCBzcXVhcmU6IDE2LCBkZWZhdWx0OiAyMCB9KTtcbiAgICBjb25zdCBhZGRyZXNzU2l6ZSA9IHIoeyBwb3J0cmFpdDogMjgsIHNxdWFyZTogMTQsIGRlZmF1bHQ6IDE2IH0pO1xuICAgIGNvbnN0IHBhZGRpbmdYID0gcih7IHBvcnRyYWl0OiA0OCwgc3F1YXJlOiAzNiwgZGVmYXVsdDogNDggfSk7XG4gICAgY29uc3QgcGFkZGluZ1kgPSByKHsgcG9ydHJhaXQ6IDY0LCBzcXVhcmU6IDM2LCBkZWZhdWx0OiA0OCB9KTtcbiAgICBjb25zdCBhdmF0YXJTaXplID0gcih7IHBvcnRyYWl0OiAyODAsIHNxdWFyZTogMjAwLCBkZWZhdWx0OiAzMDAgfSk7XG5cbiAgICBjb25zdCBwb3J0cmFpdFBhZGRpbmdUb3AgPSBwYWRkaW5nWSArIChhdmF0YXJTaXplIC8gMik7XG4gICAgY29uc3QgbGFuZHNjYXBlUGFkZGluZ1JpZ2h0ID0gcGFkZGluZ1ggKyAoYXZhdGFyU2l6ZSAvIDIpO1xuXG4gICAgY29uc3QgY2FyZEh0bWwgPSBgXG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICB3aWR0aDogY2FyZFdpZHRoLCBtYXhXaWR0aDogY2FyZE1heFdpZHRoLCBiYWNrZ3JvdW5kOiBzdGQuY29sb3IuYWxwaGEoYnJhbmRDb2xvciwgMC45NSksIGJvcmRlclJhZGl1czogMTYsXG4gICAgICAgICAgICBwYWRkaW5nVG9wOiBpc1BvcnRyYWl0ID8gcG9ydHJhaXRQYWRkaW5nVG9wIDogcGFkZGluZ1ksIHBhZGRpbmdCb3R0b206IHBhZGRpbmdZLCBwYWRkaW5nTGVmdDogcGFkZGluZ1gsXG4gICAgICAgICAgICBwYWRkaW5nUmlnaHQ6IGlzUG9ydHJhaXQgPyBwYWRkaW5nWCA6IGxhbmRzY2FwZVBhZGRpbmdSaWdodCwgYm94U2hhZG93OiBcIjAgMjRweCA2NHB4IHJnYmEoMCwgMCwgMCwgMC40KVwiLFxuICAgICAgICAgICAgY29sb3I6IFwid2hpdGVcIiwgdGV4dEFsaWduOiBpc1BvcnRyYWl0ID8gXCJjZW50ZXJcIiA6IFwibGVmdFwiLCBvcGFjaXR5OiBjYXJkQW5pbS5vcGFjaXR5LFxuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsIGFsaWduSXRlbXM6IGlzUG9ydHJhaXQgPyBcImNlbnRlclwiIDogXCJmbGV4LXN0YXJ0XCIsIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsXG4gICAgICAgICAgfSl9OyR7Y2FyZEFuaW0uc3R5bGV9XCI+XG5cbiAgICAgICAgICAgIDwhLS0gT3ZlcmxhcHBpbmcgU3BlYWtlciBBdmF0YXIgLS0+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgICAgd2lkdGg6IGF2YXRhclNpemUsIGhlaWdodDogYXZhdGFyU2l6ZSwgYm9yZGVyUmFkaXVzOiBcIjUwJVwiLCBiYWNrZ3JvdW5kSW1hZ2U6IGB1cmwoJHtzcGVha2VyUGhvdG99KWAsIGJhY2tncm91bmRTaXplOiBcImNvdmVyXCIsXG4gICAgICAgICAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsIHRvcDogaXNQb3J0cmFpdCA/IC1hdmF0YXJTaXplIC8gMiA6IFwiNTAlXCIsIG1hcmdpblRvcDogaXNQb3J0cmFpdCA/IDAgOiAtYXZhdGFyU2l6ZSAvIDIsXG4gICAgICAgICAgICAgIHJpZ2h0OiBpc1BvcnRyYWl0ID8gXCJhdXRvXCIgOiAtYXZhdGFyU2l6ZSAvIDMsIGxlZnQ6IGlzUG9ydHJhaXQgPyBcIjUwJVwiIDogXCJhdXRvXCIsIG1hcmdpbkxlZnQ6IGlzUG9ydHJhaXQgPyAtYXZhdGFyU2l6ZSAvIDIgOiAwLFxuICAgICAgICAgICAgICBib3JkZXI6IFwiOHB4IHNvbGlkICNjYmQ1ZTFcIiwgYm94U2hhZG93OiBcIjAgMTZweCAzMnB4IHJnYmEoMCwwLDAsMC4zKVwiLFxuICAgICAgICAgICAgfSl9XCI+PC9kaXY+XG5cbiAgICAgICAgICAgIDwhLS0gSG9vayBzZWN0aW9uIC0tPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHRyYW5zZm9ybTogYHRyYW5zbGF0ZVkoJHtob29rU2hpZnRZfXB4KWAsIG1hcmdpbkJvdHRvbTogZXhwYW5kUCA+IDAgPyAxNiA6IDAgfSl9XCI+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgICAgIGZvbnRTaXplOiAxNiwgZm9udFdlaWdodDogNjAwLCBiYWNrZ3JvdW5kOiBzdGQuY29sb3IuYWxwaGEoXCIjZmZmZmZmXCIsIDAuMiksIHBhZGRpbmc6IFwiNnB4IDE2cHhcIixcbiAgICAgICAgICAgICAgICBtYXJnaW5Cb3R0b206IDI0LCBvcGFjaXR5OiBncm91cEFuaW0ub3BhY2l0eSwgdGV4dFRyYW5zZm9ybTogXCJ1cHBlcmNhc2VcIiwgbGV0dGVyU3BhY2luZzogXCIwLjFlbVwiLCBkaXNwbGF5OiBcImlubGluZS1ibG9ja1wiLFxuICAgICAgICAgICAgICB9KX07JHtncm91cEFuaW0uc3R5bGV9XCI+JHtncm91cE5hbWV9PC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBob29rU2l6ZSwgZm9udFdlaWdodDogODAwLCBsZXR0ZXJTcGFjaW5nOiBcIi0wLjAyZW1cIiwgbGluZUhlaWdodDogMS4xLCBtaW5IZWlnaHQ6IGhvb2tTaXplICogMS4xIH0pfVwiPiR7aG9vazFWaXNpYmxlfTwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IGhvb2tTaXplICogMC43LCBmb250V2VpZ2h0OiA1MDAsIGxldHRlclNwYWNpbmc6IFwiLTAuMDFlbVwiLCBsaW5lSGVpZ2h0OiAxLjIsIG1hcmdpbkJvdHRvbTogMjAsIG1pbkhlaWdodDogaG9va1NpemUgKiAwLjcgKiAxLjIsIG9wYWNpdHk6IDAuOCB9KX1cIj4ke2hvb2syVmlzaWJsZX08L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8IS0tIFNwZWFrZXIgSW5mbyAtLT5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBvcGFjaXR5OiBzcGVha2VySW5mb0FuaW0ub3BhY2l0eSwgbWFyZ2luQm90dG9tOiAxNiB9KX07JHtzcGVha2VySW5mb0FuaW0uc3R5bGV9XCI+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogc3BlYWtlck5hbWVTaXplLCBmb250V2VpZ2h0OiA3MDAgfSl9XCI+JHtzcGVha2VyTmFtZX08L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBzcGVha2VyVGl0bGVTaXplLCBmb250V2VpZ2h0OiA0MDAsIGNvbG9yOiBcIiM2MWRhZmJcIiB9KX1cIj4ke3NwZWFrZXJUaXRsZX08L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8IS0tIFRhbGsgVGl0bGUgLS0+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHRhbGtTaXplLCBmb250V2VpZ2h0OiA2MDAsIGxpbmVIZWlnaHQ6IDEuMiwgbWFyZ2luQm90dG9tOiAyNCwgb3BhY2l0eTogdGFsa0FuaW0ub3BhY2l0eSwgZm9udFN0eWxlOiBcIml0YWxpY1wiIH0pfTske3RhbGtBbmltLnN0eWxlfVwiPlwiJHt0YWxrVGl0bGV9XCI8L2Rpdj5cblxuICAgICAgICAgICAgPCEtLSBMb2dpc3RpY3MgLS0+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgb3BhY2l0eTogbG9naXN0aWNzQW5pbS5vcGFjaXR5IH0pfTske2xvZ2lzdGljc0FuaW0uc3R5bGV9XCI+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogbG9naXN0aWNzU2l6ZSwgZm9udFdlaWdodDogNjAwLCBtYXJnaW5Cb3R0b206IDggfSl9XCI+JHtkYXRlfSDCtyAke2V2ZW50VGltZX08L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBhZGRyZXNzU2l6ZSwgZm9udFdlaWdodDogNDAwLCBvcGFjaXR5OiAwLjg1IH0pfVwiPiR7YWRkcmVzc308L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBjb25zdCBMID0gc3RkLmxheWVycyh7IHdpZHRoLCBoZWlnaHQgfSk7XG4gICAgcmV0dXJuIEwucmVuZGVyKFxuICAgICAgTC5iZyhiZyksXG4gICAgICBMLmNvbnRlbnQoYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGg6IFwiMTAwJVwiLCBoZWlnaHQ6IFwiMTAwJVwiLCBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsIHBhZGRpbmc6IDQwIH0pfVwiPlxuICAgICAgICAgICR7Y2FyZEh0bWx9XG4gICAgICAgIDwvZGl2PlxuICAgICAgYCksXG4gICAgKTtcbiAgfSxcbn0pO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQSxTQUFTLE9BQU8sT0FBTztFQUN0QixNQUFNLFNBQVMsTUFBTSxVQUFVO0VBQy9CLE1BQU0sSUFBSSxNQUFNO0VBQ2hCLE1BQU0sYUFBYSxPQUFPLE1BQU0sWUFBWTtFQUM1QyxPQUFPO0dBQ047R0FDQSxVQUFVLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRSxRQUFRLGFBQWEsRUFBRSxZQUFZLFFBQVE7R0FDckUsUUFBUSxNQUFNO0dBQ2QsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLGFBQWEsRUFBRSxTQUFTLE1BQU0sUUFBUSxJQUFJLENBQUM7RUFDL0M7Q0FDRDs7Ozs7Ozs7Ozs7Ozs7OzttQkN2Q2UsT0FBTztFQUNwQixRQUFRO0dBQ04sYUFBYTtHQUNiLGNBQWM7R0FDZCxjQUFjO0dBQ2QsTUFBTTtHQUNOLFdBQVc7R0FDWCxXQUFXO0dBQ1gsaUJBQWlCO0dBQ2pCLE1BQU07R0FDTixNQUFNO0dBQ04sU0FBUztHQUNULFdBQVc7R0FDWCxZQUFZO0dBQ1osZUFBZTtFQUNqQjtFQUVBLFFBQVE7R0FDTixPQUFPO0dBQ1AsUUFBUTtHQUNSLEtBQUs7R0FDTCxVQUFVO0dBQ1YsT0FBTyxDQUFDLGdDQUFnQztHQUN4QyxPQUFPO0lBQ0wsSUFBSTtJQUNKLEtBQUs7SUFDTCxNQUFNO0lBQ04sUUFBUTtJQUNSLFFBQVE7SUFDUixTQUFTO0lBQ1QsTUFBTTtHQUNSO0dBQ0EsU0FBUztJQUNQLFdBQVc7S0FBRSxPQUFPO0tB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