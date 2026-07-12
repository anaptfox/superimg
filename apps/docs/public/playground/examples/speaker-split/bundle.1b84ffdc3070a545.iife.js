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
			const { speakerName, speakerTitle, speakerPhoto, talkTitle, date, time: eventTime, address, groupName, brandColor, techlahomaSvg } = data;
			const r = std.createResponsive(ctx);
			const isHorizontalSplit = !isPortrait;
			const t = ctx.director({
				content: "9.0s",
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
					for: "1.0s",
					scale: .9
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
          <img src="${techlahomaSvg}" style="${std.css({ width: logoWidth })}; ${logoAnim.style}" />
        </div>
      `;
			}
			const zoom = std.interpolate(t.in("content"), [0, 1], [1, 1.1]);
			const photoAnim = t.motion({
				at: "0%",
				for: "10%",
				exit: false
			});
			const contentAnim = t.motion({
				at: "5%",
				for: "10%",
				x: isHorizontalSplit ? 100 : 0,
				y: isHorizontalSplit ? 0 : 100,
				exit: false
			});
			const groupAnim = t.motion({
				at: "10%",
				for: "10%",
				exit: false
			});
			const labelAnim = t.motion({
				at: "15%",
				for: "10%",
				exit: false
			});
			const nameRoleAnim = t.motion({
				at: "20%",
				for: "10%",
				y: 20,
				exit: false
			});
			const talkAnim = t.motion({
				at: "25%",
				for: "10%",
				y: 20,
				exit: false
			});
			const logisticsAnim = t.motion({
				at: "30%",
				for: "10%",
				y: 20,
				exit: false
			});
			const fadeOut = std.interpolate(t.in("content", {
				at: "94%",
				duration: "6%"
			}), [0, 1], [1, 0], "easeInCubic");
			const padding = r({
				portrait: 56,
				square: 60,
				default: 80
			});
			const labelSize = r({
				portrait: 24,
				square: 18,
				default: 20
			});
			const nameSize = r({
				portrait: 64,
				square: 48,
				default: 64
			});
			const titleSize = r({
				portrait: 28,
				square: 20,
				default: 28
			});
			const talkSize = r({
				portrait: 36,
				square: 28,
				default: 40
			});
			const logisticsSize = r({
				portrait: 28,
				square: 20,
				default: 24
			});
			return `
      <div style="${std.css({
				width,
				height,
				display: "flex",
				flexDirection: isHorizontalSplit ? "row" : "column",
				backgroundColor: brandColor,
				overflow: "hidden"
			})}">
        <div style="${std.css({
				width: isHorizontalSplit ? "45%" : "100%",
				height: isHorizontalSplit ? "100%" : "40%",
				position: "relative",
				overflow: "hidden",
				opacity: photoAnim.opacity * fadeOut
			})}">
          <div style="${std.css({
				position: "absolute",
				inset: -50,
				backgroundImage: `url(${speakerPhoto})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
				transform: `scale(${zoom})`
			})}"></div>
        </div>

        <div style="${std.css({
				width: isHorizontalSplit ? "55%" : "100%",
				height: isHorizontalSplit ? "100%" : "60%",
				backgroundColor: brandColor,
				color: "white",
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				padding,
				opacity: contentAnim.opacity * fadeOut
			})}; ${contentAnim.style}">
          <div style="${std.css({
				alignSelf: "flex-start",
				fontSize: 14,
				fontWeight: 700,
				background: std.color.alpha("#ffffff", .15),
				padding: "8px 20px",
				borderRadius: 100,
				marginBottom: 40,
				textTransform: "uppercase",
				letterSpacing: "0.15em"
			})}; ${groupAnim.style}">${groupName}</div>
          <div style="${std.css({
				fontSize: labelSize,
				fontWeight: 800,
				color: "#61dafb",
				textTransform: "uppercase",
				letterSpacing: "0.15em",
				marginBottom: 20
			})}; ${labelAnim.style}">Guest Speaker</div>

          <div style="${std.css({ marginBottom: 48 })}; ${nameRoleAnim.style}">
            <div style="${std.css({
				fontSize: nameSize,
				fontWeight: 900,
				lineHeight: 1.1,
				letterSpacing: "-0.02em",
				marginBottom: 8
			})}">${speakerName}</div>
            <div style="${std.css({
				fontSize: titleSize,
				fontWeight: 400,
				opacity: .9
			})}">${speakerTitle}</div>
          </div>

          <div style="${std.css({
				marginBottom: 48,
				borderLeft: "6px solid #61dafb",
				paddingLeft: 24
			})}; ${talkAnim.style}">
            <div style="${std.css({
				fontSize: 16,
				textTransform: "uppercase",
				letterSpacing: "0.15em",
				fontWeight: 700,
				opacity: .7,
				marginBottom: 12
			})}">Talk Topic</div>
            <div style="${std.css({
				fontSize: talkSize,
				fontWeight: 700,
				lineHeight: 1.2
			})}">"${talkTitle}"</div>
          </div>

          <div style="${std.css({
				marginTop: "auto",
				paddingTop: 32,
				borderTop: `1px solid ${std.color.alpha("#ffffff", .2)}`
			})}; ${logisticsAnim.style}">
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
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BlYWtlci1zcGxpdC5tZWRpYS5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9zdXBlcmltZy10eXBlcy9kaXN0L2luZGV4LmpzIiwiLi4vZXhhbXBsZXMvZXZlbnRzL3NwZWFrZXItc3BsaXQvc3BlYWtlci1zcGxpdC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBzYW1wbGU6IHtcbiAgICBzcGVha2VyTmFtZTogXCJKYW5lIERvZVwiLFxuICAgIHNwZWFrZXJUaXRsZTogXCJQcmluY2lwYWwgRW5naW5lZXIgQCBUZWNoQ29cIixcbiAgICBzcGVha2VyUGhvdG86IFwiaHR0cHM6Ly9pLnByYXZhdGFyLmNjLzUwMD9pbWc9NDdcIixcbiAgICB0YWxrVGl0bGU6IFwiU2NhbGluZyB3aXRoIFJlYWN0IFNlcnZlciBDb21wb25lbnRzXCIsXG4gICAgZGF0ZTogXCJNYXJjaCAxOFwiLFxuICAgIHRpbWU6IFwiMTEgQU0g4oCTIDEgUE1cIixcbiAgICBhZGRyZXNzOiBcIjMgTkUgOHRoIFN0IMK3IE9rbGFob21hIENpdHksIE9LXCIsXG4gICAgZ3JvdXBOYW1lOiBcIk9LQyBSZWFjdEpTXCIsXG4gICAgYnJhbmRDb2xvcjogXCIjMGYxNzJhXCIsXG4gICAgdGVjaGxhaG9tYVN2ZzogXCJodHRwczovL3d3dy50ZWNobGFob21hLm9yZy93cC1jb250ZW50L3VwbG9hZHMvMjAyNC8wOS9jcm9wcGVkLXRlY2hsYWhvbWFfaG9yaXpvbnRhbHRleHQtd2hpdGUucG5nXCIsXG4gIH0sXG5cbiAgY29uZmlnOiB7XG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGZwczogMzAsXG4gICAgZHVyYXRpb246IFwiMTJzXCIsXG4gICAgZm9udHM6IFtcIkludGVyOndnaHRANDAwOzUwMDs2MDA7NzAwOzgwMDs5MDBcIl0sXG4gICAgYXVkaW86IHtcbiAgICAgIGlkOiBcImJlZFwiLFxuICAgICAgc3JjOiBcIi4uLy4uL19hc3NldHMvbG9maS1iZy5tcDNcIixcbiAgICAgIHJvbGU6IFwibXVzaWNcIixcbiAgICAgIHZvbHVtZTogMC42LFxuICAgICAgZmFkZUluOiBcIjAuNXNcIixcbiAgICAgIGZhZGVPdXQ6IFwiMS41c1wiLFxuICAgICAgbG9vcDogdHJ1ZSxcbiAgICB9LFxuICAgIG91dHB1dHM6IHtcbiAgICAgIGxhbmRzY2FwZTogeyB3aWR0aDogMTkyMCwgaGVpZ2h0OiAxMDgwIH0sXG4gICAgICBzcXVhcmU6IHsgd2lkdGg6IDEwODAsIGhlaWdodDogMTA4MCB9LFxuICAgICAgc3Rvcnk6IHsgd2lkdGg6IDEwODAsIGhlaWdodDogMTkyMCB9LFxuICAgIH0sXG4gICAgaW5saW5lQ3NzOiBbYFxuICAgICAgKiB7IG1hcmdpbjogMDsgcGFkZGluZzogMDsgYm94LXNpemluZzogYm9yZGVyLWJveDsgfVxuICAgICAgYm9keSB7IGZvbnQtZmFtaWx5OiAnSW50ZXInLCBzYW5zLXNlcmlmOyBvdmVyZmxvdzogaGlkZGVuOyB9XG4gICAgYF0sXG4gIH0sXG5cbiAgcmVuZGVyKGN0eCkge1xuICAgIGNvbnN0IHsgc3RkLCB0aW1lbGluZSwgd2lkdGgsIGhlaWdodCwgZGF0YSwgaXNQb3J0cmFpdCB9ID0gY3R4O1xuICAgIGNvbnN0IHsgc3BlYWtlck5hbWUsIHNwZWFrZXJUaXRsZSwgc3BlYWtlclBob3RvLCB0YWxrVGl0bGUsIGRhdGUsIHRpbWU6IGV2ZW50VGltZSwgYWRkcmVzcywgZ3JvdXBOYW1lLCBicmFuZENvbG9yLCB0ZWNobGFob21hU3ZnIH0gPSBkYXRhO1xuXG4gICAgY29uc3QgciA9IHN0ZC5jcmVhdGVSZXNwb25zaXZlKGN0eCk7XG4gICAgY29uc3QgaXNIb3Jpem9udGFsU3BsaXQgPSAhaXNQb3J0cmFpdDtcblxuICAgIC8vIERpcmVjdG9yIHBoYXNlczogY29udGVudCAoMOKAkzlzKSB8IG91dHJvICg54oCTMTJzKVxuICAgIGNvbnN0IHQgPSBjdHguZGlyZWN0b3Ioe1xuICAgICAgY29udGVudDogXCI5LjBzXCIsXG4gICAgICBvdXRybzogXCIzLjBzXCJcbiAgICB9KTtcblxuICAgIGlmICh0LmFjdGl2ZSA9PT0gXCJvdXRyb1wiKSB7XG4gICAgICBjb25zdCBsb2dvV2lkdGggPSByKHsgcG9ydHJhaXQ6IDUwMCwgc3F1YXJlOiA0MDAsIGRlZmF1bHQ6IDQ4MCB9KTtcbiAgICAgIC8vIEVudGVyIG92ZXIgMXM7IHRoZSBkZWZhdWx0IGV4aXQgdGhlbiBmYWRlcyB0aGUgbG9nbyB0byBibGFjayBhY3Jvc3MgdGhlIG91dHJvXG4gICAgICBjb25zdCBsb2dvQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcIm91dHJvXCIsIGZvcjogXCIxLjBzXCIsIHNjYWxlOiAwLjkgfSk7XG4gICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGgsIGhlaWdodCwgYmFja2dyb3VuZDogXCIjMDAwXCIsIGRpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBqdXN0aWZ5Q29udGVudDogXCJjZW50ZXJcIiB9KX1cIj5cbiAgICAgICAgICA8aW1nIHNyYz1cIiR7dGVjaGxhaG9tYVN2Z31cIiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoOiBsb2dvV2lkdGggfSl9OyAke2xvZ29BbmltLnN0eWxlfVwiIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICB9XG5cbiAgICAvLyBCYWNrZ3JvdW5kIHpvb20gKG1hbnVhbCBpbnRlcnBvbGF0aW9uKVxuICAgIGNvbnN0IHpvb20gPSBzdGQuaW50ZXJwb2xhdGUodC5pbihcImNvbnRlbnRcIiksIFswLCAxXSwgWzEuMCwgMS4xXSk7XG5cbiAgICBjb25zdCBwaG90b0FuaW0gPSB0Lm1vdGlvbih7IGF0OiBcIjAlXCIsIGZvcjogXCIxMCVcIiwgZXhpdDogZmFsc2UgfSk7XG4gICAgY29uc3QgY29udGVudEFuaW0gPSB0Lm1vdGlvbih7IFxuICAgICAgYXQ6IFwiNSVcIiwgXG4gICAgICBmb3I6IFwiMTAlXCIsIFxuICAgICAgeDogaXNIb3Jpem9udGFsU3BsaXQgPyAxMDAgOiAwLCBcbiAgICAgIHk6IGlzSG9yaXpvbnRhbFNwbGl0ID8gMCA6IDEwMCwgXG4gICAgICBleGl0OiBmYWxzZSBcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyb3VwQW5pbSA9IHQubW90aW9uKHsgYXQ6IFwiMTAlXCIsIGZvcjogXCIxMCVcIiwgZXhpdDogZmFsc2UgfSk7XG4gICAgY29uc3QgbGFiZWxBbmltID0gdC5tb3Rpb24oeyBhdDogXCIxNSVcIiwgZm9yOiBcIjEwJVwiLCBleGl0OiBmYWxzZSB9KTtcbiAgICBjb25zdCBuYW1lUm9sZUFuaW0gPSB0Lm1vdGlvbih7IGF0OiBcIjIwJVwiLCBmb3I6IFwiMTAlXCIsIHk6IDIwLCBleGl0OiBmYWxzZSB9KTtcbiAgICBjb25zdCB0YWxrQW5pbSA9IHQubW90aW9uKHsgYXQ6IFwiMjUlXCIsIGZvcjogXCIxMCVcIiwgeTogMjAsIGV4aXQ6IGZhbHNlIH0pO1xuICAgIGNvbnN0IGxvZ2lzdGljc0FuaW0gPSB0Lm1vdGlvbih7IGF0OiBcIjMwJVwiLCBmb3I6IFwiMTAlXCIsIHk6IDIwLCBleGl0OiBmYWxzZSB9KTtcblxuICAgIC8vIEZhZGUgb3V0IGV2ZXJ5dGhpbmcgYXQgdGhlIGVuZCBvZiBjb250ZW50IHBoYXNlICg4LjVzIC0gOXMpXG4gICAgY29uc3QgZmFkZU91dCA9IHN0ZC5pbnRlcnBvbGF0ZSh0LmluKFwiY29udGVudFwiLCB7IGF0OiBcIjk0JVwiLCBkdXJhdGlvbjogXCI2JVwifSksIFswLCAxXSwgWzEsIDBdLCBcImVhc2VJbkN1YmljXCIpO1xuXG4gICAgY29uc3QgcGFkZGluZyA9IHIoeyBwb3J0cmFpdDogNTYsIHNxdWFyZTogNjAsIGRlZmF1bHQ6IDgwIH0pO1xuICAgIGNvbnN0IGxhYmVsU2l6ZSA9IHIoeyBwb3J0cmFpdDogMjQsIHNxdWFyZTogMTgsIGRlZmF1bHQ6IDIwIH0pO1xuICAgIGNvbnN0IG5hbWVTaXplID0gcih7IHBvcnRyYWl0OiA2NCwgc3F1YXJlOiA0OCwgZGVmYXVsdDogNjQgfSk7XG4gICAgY29uc3QgdGl0bGVTaXplID0gcih7IHBvcnRyYWl0OiAyOCwgc3F1YXJlOiAyMCwgZGVmYXVsdDogMjggfSk7XG4gICAgY29uc3QgdGFsa1NpemUgPSByKHsgcG9ydHJhaXQ6IDM2LCBzcXVhcmU6IDI4LCBkZWZhdWx0OiA0MCB9KTtcbiAgICBjb25zdCBsb2dpc3RpY3NTaXplID0gcih7IHBvcnRyYWl0OiAyOCwgc3F1YXJlOiAyMCwgZGVmYXVsdDogMjQgfSk7XG5cbiAgICByZXR1cm4gYFxuICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoLCBoZWlnaHQsIGRpc3BsYXk6IFwiZmxleFwiLCBmbGV4RGlyZWN0aW9uOiBpc0hvcml6b250YWxTcGxpdCA/IFwicm93XCIgOiBcImNvbHVtblwiLCBiYWNrZ3JvdW5kQ29sb3I6IGJyYW5kQ29sb3IsIG92ZXJmbG93OiBcImhpZGRlblwiIH0pfVwiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGg6IGlzSG9yaXpvbnRhbFNwbGl0ID8gXCI0NSVcIiA6IFwiMTAwJVwiLCBoZWlnaHQ6IGlzSG9yaXpvbnRhbFNwbGl0ID8gXCIxMDAlXCIgOiBcIjQwJVwiLCBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLCBvdmVyZmxvdzogXCJoaWRkZW5cIiwgb3BhY2l0eTogcGhvdG9BbmltLm9wYWNpdHkgKiBmYWRlT3V0IH0pfVwiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLCBpbnNldDogLTUwLCBiYWNrZ3JvdW5kSW1hZ2U6IGB1cmwoJHtzcGVha2VyUGhvdG99KWAsIGJhY2tncm91bmRTaXplOiBcImNvdmVyXCIsIGJhY2tncm91bmRQb3NpdGlvbjogXCJjZW50ZXJcIiwgdHJhbnNmb3JtOiBgc2NhbGUoJHt6b29tfSlgIH0pfVwiPjwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICB3aWR0aDogaXNIb3Jpem9udGFsU3BsaXQgPyBcIjU1JVwiIDogXCIxMDAlXCIsIGhlaWdodDogaXNIb3Jpem9udGFsU3BsaXQgPyBcIjEwMCVcIiA6IFwiNjAlXCIsIGJhY2tncm91bmRDb2xvcjogYnJhbmRDb2xvciwgY29sb3I6IFwid2hpdGVcIixcbiAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsIHBhZGRpbmc6IHBhZGRpbmcsXG4gICAgICAgICAgb3BhY2l0eTogY29udGVudEFuaW0ub3BhY2l0eSAqIGZhZGVPdXQsXG4gICAgICAgIH0pfTsgJHtjb250ZW50QW5pbS5zdHlsZX1cIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgYWxpZ25TZWxmOiBcImZsZXgtc3RhcnRcIiwgZm9udFNpemU6IDE0LCBmb250V2VpZ2h0OiA3MDAsIGJhY2tncm91bmQ6IHN0ZC5jb2xvci5hbHBoYShcIiNmZmZmZmZcIiwgMC4xNSksIHBhZGRpbmc6IFwiOHB4IDIwcHhcIiwgYm9yZGVyUmFkaXVzOiAxMDAsIG1hcmdpbkJvdHRvbTogNDAsIHRleHRUcmFuc2Zvcm06IFwidXBwZXJjYXNlXCIsIGxldHRlclNwYWNpbmc6IFwiMC4xNWVtXCIgfSl9OyAke2dyb3VwQW5pbS5zdHlsZX1cIj4ke2dyb3VwTmFtZX08L2Rpdj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IGxhYmVsU2l6ZSwgZm9udFdlaWdodDogODAwLCBjb2xvcjogXCIjNjFkYWZiXCIsIHRleHRUcmFuc2Zvcm06IFwidXBwZXJjYXNlXCIsIGxldHRlclNwYWNpbmc6IFwiMC4xNWVtXCIsIG1hcmdpbkJvdHRvbTogMjAgfSl9OyAke2xhYmVsQW5pbS5zdHlsZX1cIj5HdWVzdCBTcGVha2VyPC9kaXY+XG5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgbWFyZ2luQm90dG9tOiA0OCB9KX07ICR7bmFtZVJvbGVBbmltLnN0eWxlfVwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBuYW1lU2l6ZSwgZm9udFdlaWdodDogOTAwLCBsaW5lSGVpZ2h0OiAxLjEsIGxldHRlclNwYWNpbmc6IFwiLTAuMDJlbVwiLCBtYXJnaW5Cb3R0b206IDggfSl9XCI+JHtzcGVha2VyTmFtZX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogdGl0bGVTaXplLCBmb250V2VpZ2h0OiA0MDAsIG9wYWNpdHk6IDAuOSB9KX1cIj4ke3NwZWFrZXJUaXRsZX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBtYXJnaW5Cb3R0b206IDQ4LCBib3JkZXJMZWZ0OiBcIjZweCBzb2xpZCAjNjFkYWZiXCIsIHBhZGRpbmdMZWZ0OiAyNCB9KX07ICR7dGFsa0FuaW0uc3R5bGV9XCI+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IDE2LCB0ZXh0VHJhbnNmb3JtOiBcInVwcGVyY2FzZVwiLCBsZXR0ZXJTcGFjaW5nOiBcIjAuMTVlbVwiLCBmb250V2VpZ2h0OiA3MDAsIG9wYWNpdHk6IDAuNywgbWFyZ2luQm90dG9tOiAxMiB9KX1cIj5UYWxrIFRvcGljPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHRhbGtTaXplLCBmb250V2VpZ2h0OiA3MDAsIGxpbmVIZWlnaHQ6IDEuMiB9KX1cIj5cIiR7dGFsa1RpdGxlfVwiPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgbWFyZ2luVG9wOiBcImF1dG9cIiwgcGFkZGluZ1RvcDogMzIsIGJvcmRlclRvcDogYDFweCBzb2xpZCAke3N0ZC5jb2xvci5hbHBoYShcIiNmZmZmZmZcIiwgMC4yKX1gIH0pfTsgJHtsb2dpc3RpY3NBbmltLnN0eWxlfVwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBsb2dpc3RpY3NTaXplLCBmb250V2VpZ2h0OiA2MDAsIG1hcmdpbkJvdHRvbTogOCB9KX1cIj4ke2RhdGV9IMK3ICR7ZXZlbnRUaW1lfTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiBsb2dpc3RpY3NTaXplICogMC44LCBmb250V2VpZ2h0OiA0MDAsIG9wYWNpdHk6IDAuNyB9KX1cIj4ke2FkZHJlc3N9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgYDtcbiAgfSxcbn0pO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQTZCQSxTQUFTLE9BQU8sT0FBTztFQUN0QixNQUFNLFNBQVMsTUFB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