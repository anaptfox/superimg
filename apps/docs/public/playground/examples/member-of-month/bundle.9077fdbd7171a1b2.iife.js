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
			name: "Luigi Polvani",
			role: "Software Engineer",
			location: "Norman, OK",
			photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
			quote: "Luigi has made major contributions to the Norman tech scene through Coffee and Code meetups and Oklathon.",
			techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
			ctaUrl: "techlahoma.org/volunteer",
			brandColor: "#FFD700"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "15s",
			fonts: ["Inter:wght@400;500;600;700;800"],
			audio: {
				id: "bed",
				src: "../../_assets/lofi-bg.mp3",
				role: "music",
				volume: .5,
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
			const { std, timeline, width, height, data, isPortrait, isSquare } = ctx;
			const { name, role, location, photoUrl, quote, techlahomaSvg, ctaUrl, brandColor } = data;
			const t = ctx.director({
				build: "3.0s",
				content: "7.5s",
				poster: "4.5s"
			});
			const frameAnim = t.motion({
				at: "0%",
				for: "0.8s",
				scale: .8
			});
			const photoAnim = t.motion({
				at: "50%",
				for: "0.8s",
				scale: 0
			});
			const logoAnim = t.motion({
				at: "70%",
				for: "0.5s",
				y: -20
			});
			const titleAnim = t.motion({
				at: "30%",
				for: "0.5s",
				y: 20,
				exit: {
					window: [.66, .7],
					y: 0
				}
			});
			const nameAnim = t.motion({
				during: "content",
				at: "0s",
				for: "0.6s",
				y: 30
			});
			const roleAnim = t.motion({
				during: "content",
				at: "0.15s",
				for: "0.6s",
				y: 20
			});
			const quoteAnim = t.motion({
				during: "content",
				at: "1.2s",
				for: "0.6s",
				y: isPortrait ? 40 : -40,
				exit: {
					window: [.66, .7],
					y: 0
				}
			});
			const badgeAnim = t.motion({
				during: "poster",
				at: "0%",
				for: "0.6s",
				scale: .9
			});
			const ctaAnim = t.motion({
				during: "poster",
				at: "40%",
				for: "0.5s",
				y: 20
			});
			const badgePulse = t.active === "poster" ? 1 + Math.sin((timeline.seconds - 11) * 3) * .02 : 1;
			const frameSize = isPortrait ? 300 : isSquare ? 240 : 260;
			const frameBorder = isPortrait ? 8 : 6;
			const photoSize = frameSize - frameBorder * 4;
			const nameSize = isPortrait ? 48 : isSquare ? 36 : 42;
			const roleSize = isPortrait ? 24 : isSquare ? 18 : 22;
			const titleSize = isPortrait ? 20 : isSquare ? 16 : 18;
			const quoteSize = isPortrait ? 24 : isSquare ? 18 : 22;
			const logoHeight = isPortrait ? 32 : 28;
			const ctaSize = isPortrait ? 18 : 16;
			const padding = isPortrait ? 48 : 60;
			const frameTop = isPortrait ? 160 : isSquare ? 80 : 100;
			return `
      <div style="${std.css({
				width,
				height,
				background: "#000",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				position: "relative",
				overflow: "hidden"
			})}">
        <!-- Techlahoma Logo (top right) -->
        <img src="${techlahomaSvg}" style="${std.css({
				position: "absolute",
				top: padding,
				right: padding,
				height: logoHeight
			})}; ${logoAnim.style}" />

        <!-- Quote Box -->
        ${quoteAnim.visible ? `
          <div style="${std.css({
				position: "absolute",
				top: isPortrait ? "auto" : 60,
				bottom: isPortrait ? frameTop + frameSize + 180 : "auto",
				left: padding,
				right: padding,
				background: brandColor,
				borderRadius: 12,
				padding: isPortrait ? "20px 24px" : "24px 32px"
			})}; ${quoteAnim.style}">
            <div style="${std.css({
				fontSize: quoteSize,
				fontWeight: 500,
				color: "#000",
				lineHeight: 1.5,
				textAlign: "center"
			})}">"${quote}"</div>
          </div>
        ` : ""}

        <!-- Main Content Container -->
        <div style="${std.css({
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				marginTop: isPortrait ? 0 : 40
			})}">
          <!-- Yellow Frame -->
          <div style="${std.css({
				width: frameSize,
				height: frameSize,
				border: `${frameBorder}px solid ${brandColor}`,
				borderRadius: 16,
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			})}; ${frameAnim.style}">
            <!-- Photo -->
            <div style="${std.css({
				width: photoSize,
				height: photoSize,
				borderRadius: 8,
				overflow: "hidden"
			})}; ${photoAnim.style}">
              <img src="${photoUrl}" style="${std.css({
				width: "100%",
				height: "100%",
				objectFit: "cover",
				filter: "grayscale(100%)"
			})}" />
            </div>
          </div>

          <!-- Name -->
          <div style="${std.css({
				marginTop: 24,
				fontSize: nameSize,
				fontWeight: 800,
				color: "#fff"
			})}; ${nameAnim.style}">${name}</div>

          <!-- Role + Location -->
          <div style="${std.css({
				marginTop: 8,
				fontSize: roleSize,
				fontWeight: 500,
				color: "rgba(255,255,255,0.7)"
			})}; ${roleAnim.style}">${role} | ${location}</div>
        </div>

        <!-- MEMBER OF THE MONTH Title -->
        <div style="${std.css({
				position: "absolute",
				bottom: isPortrait ? 120 : 80,
				left: 0,
				right: 0,
				textAlign: "center"
			})}">
          ${t.active === "poster" ? `
            <!-- Poster moment: prominent badge -->
            <div style="${std.css({
				display: "inline-block",
				background: brandColor,
				padding: isPortrait ? "16px 40px" : "12px 32px",
				borderRadius: 8,
				transform: `scale(${badgePulse})`
			})}; ${badgeAnim.style}">
              <div style="${std.css({
				fontSize: titleSize + 4,
				fontWeight: 800,
				color: "#000",
				letterSpacing: "0.1em"
			})}">MEMBER OF THE MONTH</div>
            </div>
          ` : `
            <!-- Regular title during earlier phases -->
            <div style="${std.css({
				fontSize: titleSize,
				fontWeight: 600,
				color: "rgba(255,255,255,0.6)",
				letterSpacing: "0.15em"
			})}; ${titleAnim.style}">MEMBER OF THE MONTH</div>
          `}
        </div>

        <!-- CTA URL -->
        <div style="${std.css({
				position: "absolute",
				bottom: isPortrait ? 60 : 40,
				left: 0,
				right: 0,
				textAlign: "center",
				fontSize: ctaSize,
				fontWeight: 500,
				color: "rgba(255,255,255,0.5)"
			})}; ${ctaAnim.style}">${ctaUrl}</div>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVtYmVyLW9mLW1vbnRoLm1lZGlhLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLXR5cGVzL2Rpc3QvaW5kZXguanMiLCIuLi9leGFtcGxlcy9ldmVudHMvbWVtYmVyLW9mLW1vbnRoL21lbWJlci1vZi1tb250aC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBzYW1wbGU6IHtcbiAgICBuYW1lOiBcIkx1aWdpIFBvbHZhbmlcIixcbiAgICByb2xlOiBcIlNvZnR3YXJlIEVuZ2luZWVyXCIsXG4gICAgbG9jYXRpb246IFwiTm9ybWFuLCBPS1wiLFxuICAgIHBob3RvVXJsOiBcImh0dHBzOi8vaW1hZ2VzLnVuc3BsYXNoLmNvbS9waG90by0xNTA3MDAzMjExMTY5LTBhMWRkNzIyOGYyZD93PTQwMFwiLFxuICAgIHF1b3RlOiBcIkx1aWdpIGhhcyBtYWRlIG1ham9yIGNvbnRyaWJ1dGlvbnMgdG8gdGhlIE5vcm1hbiB0ZWNoIHNjZW5lIHRocm91Z2ggQ29mZmVlIGFuZCBDb2RlIG1lZXR1cHMgYW5kIE9rbGF0aG9uLlwiLFxuICAgIHRlY2hsYWhvbWFTdmc6IFwiaHR0cHM6Ly93d3cudGVjaGxhaG9tYS5vcmcvd3AtY29udGVudC91cGxvYWRzLzIwMjQvMDkvY3JvcHBlZC10ZWNobGFob21hX2hvcml6b250YWx0ZXh0LXdoaXRlLnBuZ1wiLFxuICAgIGN0YVVybDogXCJ0ZWNobGFob21hLm9yZy92b2x1bnRlZXJcIixcbiAgICBicmFuZENvbG9yOiBcIiNGRkQ3MDBcIixcbiAgfSxcblxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCIxNXNcIixcbiAgICBmb250czogW1wiSW50ZXI6d2dodEA0MDA7NTAwOzYwMDs3MDA7ODAwXCJdLFxuICAgIGF1ZGlvOiB7XG4gICAgICBpZDogXCJiZWRcIixcbiAgICAgIHNyYzogXCIuLi8uLi9fYXNzZXRzL2xvZmktYmcubXAzXCIsXG4gICAgICByb2xlOiBcIm11c2ljXCIsXG4gICAgICB2b2x1bWU6IDAuNSxcbiAgICAgIGZhZGVJbjogXCIwLjVzXCIsXG4gICAgICBmYWRlT3V0OiBcIjEuNXNcIixcbiAgICAgIGxvb3A6IHRydWUsXG4gICAgfSxcbiAgICBvdXRwdXRzOiB7XG4gICAgICBsYW5kc2NhcGU6IHsgd2lkdGg6IDE5MjAsIGhlaWdodDogMTA4MCB9LFxuICAgICAgc3F1YXJlOiB7IHdpZHRoOiAxMDgwLCBoZWlnaHQ6IDEwODAgfSxcbiAgICAgIHN0b3J5OiB7IHdpZHRoOiAxMDgwLCBoZWlnaHQ6IDE5MjAgfSxcbiAgICB9LFxuICAgIGlubGluZUNzczogW2BcbiAgICAgICogeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cbiAgICAgIGJvZHkgeyBmb250LWZhbWlseTogJ0ludGVyJywgc2Fucy1zZXJpZjsgb3ZlcmZsb3c6IGhpZGRlbjsgfVxuICAgIGBdLFxuICB9LFxuXG4gIHJlbmRlcihjdHgpIHtcbiAgICBjb25zdCB7IHN0ZCwgdGltZWxpbmUsIHdpZHRoLCBoZWlnaHQsIGRhdGEsIGlzUG9ydHJhaXQsIGlzU3F1YXJlIH0gPSBjdHg7XG4gICAgY29uc3QgeyBuYW1lLCByb2xlLCBsb2NhdGlvbiwgcGhvdG9VcmwsIHF1b3RlLCB0ZWNobGFob21hU3ZnLCBjdGFVcmwsIGJyYW5kQ29sb3IgfSA9IGRhdGE7XG5cbiAgICAvLyBEaXJlY3RvciBwaGFzZXMgZm9yIGEgMTVzIHNjZW5lXG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3Rvcih7XG4gICAgICBidWlsZDogXCIzLjBzXCIsXG4gICAgICBjb250ZW50OiBcIjcuNXNcIixcbiAgICAgIHBvc3RlcjogXCI0LjVzXCJcbiAgICB9KTtcblxuICAgIC8vIEJ1aWxkIGFuaW1hdGlvbnNcbiAgICBjb25zdCBmcmFtZUFuaW0gPSB0Lm1vdGlvbih7IGF0OiBcIjAlXCIsIGZvcjogXCIwLjhzXCIsIHNjYWxlOiAwLjggfSk7XG4gICAgY29uc3QgcGhvdG9BbmltID0gdC5tb3Rpb24oeyBhdDogXCI1MCVcIiwgZm9yOiBcIjAuOHNcIiwgc2NhbGU6IDAgfSk7XG4gICAgY29uc3QgbG9nb0FuaW0gID0gdC5tb3Rpb24oeyBhdDogXCI3MCVcIiwgZm9yOiBcIjAuNXNcIiwgeTogLTIwIH0pO1xuICAgIC8vIFRpdGxlIGZhZGVzIG91dCBhdCB0aGUgZW5kIG9mIGNvbnRlbnQsIGJlZm9yZSB0aGUgcG9zdGVyIGJhZGdlIHJlcGxhY2VzIGl0XG4gICAgY29uc3QgdGl0bGVBbmltID0gdC5tb3Rpb24oeyBhdDogXCIzMCVcIiwgZm9yOiBcIjAuNXNcIiwgeTogMjAsIGV4aXQ6IHsgd2luZG93OiBbMC42NiwgMC43XSwgeTogMCB9IH0pO1xuXG4gICAgLy8gQ29udGVudCBhbmltYXRpb25zXG4gICAgY29uc3QgbmFtZUFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJjb250ZW50XCIsIGF0OiBcIjBzXCIsIGZvcjogXCIwLjZzXCIsIHk6IDMwIH0pO1xuICAgIGNvbnN0IHJvbGVBbmltID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwiY29udGVudFwiLCBhdDogXCIwLjE1c1wiLCBmb3I6IFwiMC42c1wiLCB5OiAyMCB9KTtcbiAgICBjb25zdCBxdW90ZUFuaW0gPSB0Lm1vdGlvbih7XG4gICAgICBkdXJpbmc6IFwiY29udGVudFwiLFxuICAgICAgYXQ6IFwiMS4yc1wiLFxuICAgICAgZm9yOiBcIjAuNnNcIixcbiAgICAgIHk6IGlzUG9ydHJhaXQgPyA0MCA6IC00MCxcbiAgICAgIC8vIEZhZGUgb3V0IG92ZXIgdGhlIGxhc3QgMC42cyBvZiB0aGUgY29udGVudCBwaGFzZSBzbyB0aGUgcXVvdGUgaXMgZ29uZVxuICAgICAgLy8gYmVmb3JlIHRoZSBwb3N0ZXIgbW9tZW50IHN0YXJ0cyAod2luZG93IGlzIGluIGFic29sdXRlIHNjZW5lIGZyYWN0aW9ucylcbiAgICAgIGV4aXQ6IHsgd2luZG93OiBbMC42NiwgMC43XSwgeTogMCB9XG4gICAgfSk7XG5cbiAgICAvLyBQb3N0ZXIgbW9tZW50XG4gICAgY29uc3QgYmFkZ2VBbmltID0gdC5tb3Rpb24oeyBkdXJpbmc6IFwicG9zdGVyXCIsIGF0OiBcIjAlXCIsIGZvcjogXCIwLjZzXCIsIHNjYWxlOiAwLjkgfSk7XG4gICAgY29uc3QgY3RhQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcInBvc3RlclwiLCBhdDogXCI0MCVcIiwgZm9yOiBcIjAuNXNcIiwgeTogMjAgfSk7XG5cbiAgICAvLyBQdWxzZSBlZmZlY3QgZm9yIGZpbmFsIGJhZGdlXG4gICAgY29uc3QgYmFkZ2VQdWxzZSA9IHQuYWN0aXZlID09PSBcInBvc3RlclwiID8gMSArIE1hdGguc2luKCh0aW1lbGluZS5zZWNvbmRzIC0gMTEpICogMykgKiAwLjAyIDogMTtcblxuICAgIC8vIFJlc3BvbnNpdmUgc2l6aW5nXG4gICAgY29uc3QgZnJhbWVTaXplID0gaXNQb3J0cmFpdCA/IDMwMCA6IGlzU3F1YXJlID8gMjQwIDogMjYwO1xuICAgIGNvbnN0IGZyYW1lQm9yZGVyID0gaXNQb3J0cmFpdCA/IDggOiA2O1xuICAgIGNvbnN0IHBob3RvU2l6ZSA9IGZyYW1lU2l6ZSAtIGZyYW1lQm9yZGVyICogNDtcbiAgICBjb25zdCBuYW1lU2l6ZSA9IGlzUG9ydHJhaXQgPyA0OCA6IGlzU3F1YXJlID8gMzYgOiA0MjtcbiAgICBjb25zdCByb2xlU2l6ZSA9IGlzUG9ydHJhaXQgPyAyNCA6IGlzU3F1YXJlID8gMTggOiAyMjtcbiAgICBjb25zdCB0aXRsZVNpemUgPSBpc1BvcnRyYWl0ID8gMjAgOiBpc1NxdWFyZSA/IDE2IDogMTg7XG4gICAgY29uc3QgcXVvdGVTaXplID0gaXNQb3J0cmFpdCA/IDI0IDogaXNTcXVhcmUgPyAxOCA6IDIyO1xuICAgIGNvbnN0IGxvZ29IZWlnaHQgPSBpc1BvcnRyYWl0ID8gMzIgOiAyODtcbiAgICBjb25zdCBjdGFTaXplID0gaXNQb3J0cmFpdCA/IDE4IDogMTY7XG4gICAgY29uc3QgcGFkZGluZyA9IGlzUG9ydHJhaXQgPyA0OCA6IDYwO1xuICAgIGNvbnN0IGZyYW1lVG9wID0gaXNQb3J0cmFpdCA/IDE2MCA6IGlzU3F1YXJlID8gODAgOiAxMDA7XG5cbiAgICByZXR1cm4gYFxuICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgIHdpZHRoLCBoZWlnaHQsIGJhY2tncm91bmQ6IFwiIzAwMFwiLFxuICAgICAgICBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsIG92ZXJmbG93OiBcImhpZGRlblwiLFxuICAgICAgfSl9XCI+XG4gICAgICAgIDwhLS0gVGVjaGxhaG9tYSBMb2dvICh0b3AgcmlnaHQpIC0tPlxuICAgICAgICA8aW1nIHNyYz1cIiR7dGVjaGxhaG9tYVN2Z31cIiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgcG9zaXRpb246IFwiYWJzb2x1dGVcIiwgdG9wOiBwYWRkaW5nLCByaWdodDogcGFkZGluZyxcbiAgICAgICAgICBoZWlnaHQ6IGxvZ29IZWlnaHQsXG4gICAgICAgIH0pfTsgJHtsb2dvQW5pbS5zdHlsZX1cIiAvPlxuXG4gICAgICAgIDwhLS0gUXVvdGUgQm94IC0tPlxuICAgICAgICAke3F1b3RlQW5pbS52aXNpYmxlID8gYFxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgcG9zaXRpb246IFwiYWJzb2x1dGVcIixcbiAgICAgICAgICAgIHRvcDogaXNQb3J0cmFpdCA/IFwiYXV0b1wiIDogNjAsXG4gICAgICAgICAgICBib3R0b206IGlzUG9ydHJhaXQgPyBmcmFtZVRvcCArIGZyYW1lU2l6ZSArIDE4MCA6IFwiYXV0b1wiLFxuICAgICAgICAgICAgbGVmdDogcGFkZGluZywgcmlnaHQ6IHBhZGRpbmcsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiBicmFuZENvbG9yLCBib3JkZXJSYWRpdXM6IDEyLFxuICAgICAgICAgICAgcGFkZGluZzogaXNQb3J0cmFpdCA/IFwiMjBweCAyNHB4XCIgOiBcIjI0cHggMzJweFwiLFxuICAgICAgICAgIH0pfTsgJHtxdW90ZUFuaW0uc3R5bGV9XCI+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgICAgZm9udFNpemU6IHF1b3RlU2l6ZSwgZm9udFdlaWdodDogNTAwLCBjb2xvcjogXCIjMDAwXCIsXG4gICAgICAgICAgICAgIGxpbmVIZWlnaHQ6IDEuNSwgdGV4dEFsaWduOiBcImNlbnRlclwiLFxuICAgICAgICAgICAgfSl9XCI+XCIke3F1b3RlfVwiPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIGAgOiBcIlwifVxuXG4gICAgICAgIDwhLS0gTWFpbiBDb250ZW50IENvbnRhaW5lciAtLT5cbiAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsXG4gICAgICAgICAgbWFyZ2luVG9wOiBpc1BvcnRyYWl0ID8gMCA6IDQwLFxuICAgICAgICB9KX1cIj5cbiAgICAgICAgICA8IS0tIFllbGxvdyBGcmFtZSAtLT5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgIHdpZHRoOiBmcmFtZVNpemUsIGhlaWdodDogZnJhbWVTaXplLFxuICAgICAgICAgICAgYm9yZGVyOiBgJHtmcmFtZUJvcmRlcn1weCBzb2xpZCAke2JyYW5kQ29sb3J9YCxcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogMTYsXG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsXG4gICAgICAgICAgfSl9OyAke2ZyYW1lQW5pbS5zdHlsZX1cIj5cbiAgICAgICAgICAgIDwhLS0gUGhvdG8gLS0+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgICAgd2lkdGg6IHBob3RvU2l6ZSwgaGVpZ2h0OiBwaG90b1NpemUsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogOCwgb3ZlcmZsb3c6IFwiaGlkZGVuXCIsXG4gICAgICAgICAgICB9KX07ICR7cGhvdG9BbmltLnN0eWxlfVwiPlxuICAgICAgICAgICAgICA8aW1nIHNyYz1cIiR7cGhvdG9Vcmx9XCIgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgICAgIHdpZHRoOiBcIjEwMCVcIiwgaGVpZ2h0OiBcIjEwMCVcIiwgb2JqZWN0Rml0OiBcImNvdmVyXCIsXG4gICAgICAgICAgICAgICAgZmlsdGVyOiBcImdyYXlzY2FsZSgxMDAlKVwiLFxuICAgICAgICAgICAgICB9KX1cIiAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICA8IS0tIE5hbWUgLS0+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICBtYXJnaW5Ub3A6IDI0LFxuICAgICAgICAgICAgZm9udFNpemU6IG5hbWVTaXplLCBmb250V2VpZ2h0OiA4MDAsIGNvbG9yOiBcIiNmZmZcIixcbiAgICAgICAgICB9KX07ICR7bmFtZUFuaW0uc3R5bGV9XCI+JHtuYW1lfTwvZGl2PlxuXG4gICAgICAgICAgPCEtLSBSb2xlICsgTG9jYXRpb24gLS0+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICBtYXJnaW5Ub3A6IDgsXG4gICAgICAgICAgICBmb250U2l6ZTogcm9sZVNpemUsIGZvbnRXZWlnaHQ6IDUwMCwgY29sb3I6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjcpXCIsXG4gICAgICAgICAgfSl9OyAke3JvbGVBbmltLnN0eWxlfVwiPiR7cm9sZX0gfCAke2xvY2F0aW9ufTwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8IS0tIE1FTUJFUiBPRiBUSEUgTU9OVEggVGl0bGUgLS0+XG4gICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsXG4gICAgICAgICAgYm90dG9tOiBpc1BvcnRyYWl0ID8gMTIwIDogODAsXG4gICAgICAgICAgbGVmdDogMCwgcmlnaHQ6IDAsIHRleHRBbGlnbjogXCJjZW50ZXJcIixcbiAgICAgICAgfSl9XCI+XG4gICAgICAgICAgJHt0LmFjdGl2ZSA9PT0gXCJwb3N0ZXJcIiA/IGBcbiAgICAgICAgICAgIDwhLS0gUG9zdGVyIG1vbWVudDogcHJvbWluZW50IGJhZGdlIC0tPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICAgIGRpc3BsYXk6IFwiaW5saW5lLWJsb2NrXCIsXG4gICAgICAgICAgICAgIGJhY2tncm91bmQ6IGJyYW5kQ29sb3IsXG4gICAgICAgICAgICAgIHBhZGRpbmc6IGlzUG9ydHJhaXQgPyBcIjE2cHggNDBweFwiIDogXCIxMnB4IDMycHhcIixcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiA4LFxuICAgICAgICAgICAgICB0cmFuc2Zvcm06IGBzY2FsZSgke2JhZGdlUHVsc2V9KWAsXG4gICAgICAgICAgICB9KX07ICR7YmFkZ2VBbmltLnN0eWxlfVwiPlxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICAgICAgICBmb250U2l6ZTogdGl0bGVTaXplICsgNCwgZm9udFdlaWdodDogODAwLCBjb2xvcjogXCIjMDAwXCIsXG4gICAgICAgICAgICAgICAgbGV0dGVyU3BhY2luZzogXCIwLjFlbVwiLFxuICAgICAgICAgICAgICB9KX1cIj5NRU1CRVIgT0YgVEhFIE1PTlRIPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBgIDogYFxuICAgICAgICAgICAgPCEtLSBSZWd1bGFyIHRpdGxlIGR1cmluZyBlYXJsaWVyIHBoYXNlcyAtLT5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgICBmb250U2l6ZTogdGl0bGVTaXplLCBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiBcInJnYmEoMjU1LDI1NSwyNTUsMC42KVwiLFxuICAgICAgICAgICAgICBsZXR0ZXJTcGFjaW5nOiBcIjAuMTVlbVwiLFxuICAgICAgICAgICAgfSl9OyAke3RpdGxlQW5pbS5zdHlsZX1cIj5NRU1CRVIgT0YgVEhFIE1PTlRIPC9kaXY+XG4gICAgICAgICAgYH1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPCEtLSBDVEEgVVJMIC0tPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHtcbiAgICAgICAgICBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLFxuICAgICAgICAgIGJvdHRvbTogaXNQb3J0cmFpdCA/IDYwIDogNDAsXG4gICAgICAgICAgbGVmdDogMCwgcmlnaHQ6IDAsIHRleHRBbGlnbjogXCJjZW50ZXJcIixcbiAgICAgICAgICBmb250U2l6ZTogY3RhU2l6ZSwgZm9udFdlaWdodDogNTAwLCBjb2xvcjogXCJyZ2JhKDI1NSwyNTUsMjU1LDAuNSlcIixcbiAgICAgICAgfSl9OyAke2N0YUFuaW0uc3R5bGV9XCI+JHtjdGFVcmx9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICBgO1xuICB9LFxufSk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJBLFNBQVMsT0FBTyxPQUFPO0VBQ3RCLE1BQU0sU0FBUyxNQUFNLFVBQVU7RUFDL0IsTUFBTSxJQUFJLE1BQU07RUFDaEIsTUFBTSxhQUFhLE9BQU8sTUFBTSxZQUFZO0VBQzVDLE9BQU87R0FDTjtHQUNBLFVBQVUsQ0FBQyxDQUFDLEtBQUssT0FBTyxFQUFFLFFBQVEsYUFBYSxFQUFFLFlBQVksUUFBUTtHQUNyRSxRQUFRLE1BQU07R0FDZCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsYUFBYSxFQUFFLFNBQVMsTUFBTSxRQUFRLElBQUksQ0FBQztFQUMvQztDQUNEOzs7Ozs7Ozs7Ozs7Ozs7O21CQ3ZDZSxPQUFPO0VBQ3BCLFFBQVE7R0FDTixNQUFNO0dBQ04sTUFBTTtHQUNOLFVBQVU7R0FDVixVQUFVO0dBQ1YsT0FBTztHQUNQLGVBQWU7R0FDZixRQUFRO0dBQ1IsWUFBWTtFQUNkO0VBRUEsUUFBUTtHQUNOLE9BQU87R0FDUCxRQUFRO0dBQ1IsS0FBSztHQUNMLFVBQVU7R0FDVixPQUFPLENBQUMsZ0NBQWdDO0dBQ3hDLE9BQU87SUFDTCxJQUFJO0lBQ0osS0FBSztJQUNM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