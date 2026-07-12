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
			skyTop: "#87CEEB",
			skyBottom: "#E0F4FF",
			road: "#6B7280",
			grass: "#4ADE80",
			frameColor: "#F97316",
			wheelColor: "#1F2937",
			pelicanBody: "#F8FAFC",
			pelicanWing: "#CBD5E1",
			beakColor: "#FB923C",
			pouchColor: "#FDBA74"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "6s",
			inlineCss: ["* { margin: 0; padding: 0; box-sizing: border-box; }", "body { overflow: hidden; font-family: system-ui, sans-serif; }"]
		},
		render(ctx) {
			const { std, width, height, data, timeline } = ctx;
			const { skyTop, skyBottom, road, grass, frameColor, wheelColor, pelicanBody, pelicanWing, beakColor, pouchColor } = data;
			const t = ctx.director({
				intro: "1.2s",
				ride: "4.0s",
				outro: "0.8s"
			});
			const titleMotion = t.motion({
				y: 18,
				exit: { y: -12 }
			});
			const groundY = height * .78;
			const rearHub = {
				x: width * .34,
				y: groundY - height * .096
			};
			const frontHub = {
				x: width * .62,
				y: groundY - height * .096
			};
			const crank = {
				x: width * .425,
				y: groundY - height * .096
			};
			const seat = {
				x: width * .385,
				y: groundY - height * .24
			};
			const handle = {
				x: width * .585,
				y: groundY - height * .29
			};
			const wheelAngle = timeline.seconds / 1.4 * 360 % 360;
			const pelicanBob = Math.sin(timeline.seconds * Math.PI * 2 / .9) * height * .008;
			const cloudDrift1 = timeline.seconds * (width * .02) % (width * .05);
			const cloudDrift2 = timeline.seconds * (width * .015) % (width * .04);
			const roadDashOffset = timeline.seconds * 140;
			const bikeTravel = std.interpolate(t.in("ride"), [0, 1], [0, width * .08], "easeInOutSine");
			const wheelR = height * .096;
			const spoke = (len) => `
      <line x1="${-len}" y1="0" x2="${len}" y2="0" stroke="${wheelColor}" stroke-width="3" stroke-linecap="round"/>
      <line x1="0" y1="${-len}" x2="0" y2="${len}" stroke="${wheelColor}" stroke-width="3" stroke-linecap="round"/>
      <line x1="${-len * .7}" y1="${-len * .7}" x2="${len * .7}" y2="${len * .7}" stroke="${wheelColor}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${len * .7}" y1="${-len * .7}" x2="${-len * .7}" y2="${len * .7}" stroke="${wheelColor}" stroke-width="2.5" stroke-linecap="round"/>
    `;
			const wheel = (hub) => `
      <g transform="translate(${hub.x + bikeTravel} ${hub.y})">
        <circle r="${wheelR}" fill="none" stroke="${wheelColor}" stroke-width="7"/>
        <g transform="rotate(${wheelAngle})">${spoke(wheelR * .83)}</g>
        <circle r="8" fill="${frameColor}"/>
      </g>
    `;
			const pelicanX = seat.x - width * .03 + bikeTravel;
			const pelicanY = seat.y - height * .155 + pelicanBob;
			return `
      <div style="${std.css({
				width,
				height,
				position: "relative"
			})}">
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${skyTop}"/>
              <stop offset="100%" stop-color="${skyBottom}"/>
            </linearGradient>
            <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${road}"/>
              <stop offset="100%" stop-color="#374151"/>
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#00000022"/>
            </filter>
          </defs>

          <rect width="${width}" height="${height}" fill="url(#sky)"/>

          <ellipse cx="${width * .2}" cy="${groundY - height * .03}" rx="${width * .12}" ry="${height * .065}" fill="${grass}" opacity="0.55"/>
          <ellipse cx="${width * .8}" cy="${groundY - height * .015}" rx="${width * .14}" ry="${height * .075}" fill="${grass}" opacity="0.45"/>

          <g opacity="0.9">
            <g transform="translate(${cloudDrift1} 0)">
              <ellipse cx="${width * .15}" cy="${height * .16}" rx="${width * .028}" ry="${height * .046}" fill="#fff"/>
              <ellipse cx="${width * .19}" cy="${height * .135}" rx="${width * .02}" ry="${height * .04}" fill="#fff"/>
              <ellipse cx="${width * .12}" cy="${height * .135}" rx="${width * .016}" ry="${height * .033}" fill="#fff"/>
            </g>
            <g transform="translate(${-cloudDrift2} 0)">
              <ellipse cx="${width * .75}" cy="${height * .2}" rx="${width * .032}" ry="${height * .05}" fill="#fff"/>
              <ellipse cx="${width * .79}" cy="${height * .18}" rx="${width * .022}" ry="${height * .043}" fill="#fff"/>
              <ellipse cx="${width * .72}" cy="${height * .182}" rx="${width * .018}" ry="${height * .037}" fill="#fff"/>
            </g>
          </g>

          <rect x="0" y="${groundY}" width="${width}" height="${height - groundY}" fill="${grass}"/>
          <rect x="0" y="${groundY + height * .06}" width="${width}" height="${height * .2}" fill="url(#road)"/>
          <line x1="0" y1="${groundY + height * .12}" x2="${width}" y2="${groundY + height * .12}"
                stroke="#FDE68A" stroke-width="5" stroke-dasharray="40 30"
                stroke-dashoffset="${roadDashOffset}" opacity="0.85"/>

          <g filter="url(#softShadow)">
            ${wheel(rearHub)}
            ${wheel(frontHub)}

            <path d="M ${rearHub.x + bikeTravel} ${rearHub.y}
                     L ${crank.x + bikeTravel} ${crank.y}
                     L ${seat.x + bikeTravel} ${seat.y}
                     L ${handle.x + bikeTravel} ${handle.y}
                     L ${frontHub.x + bikeTravel} ${frontHub.y}
                     M ${crank.x + bikeTravel} ${crank.y} L ${frontHub.x + bikeTravel} ${frontHub.y}"
                  fill="none" stroke="${frameColor}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M ${seat.x + bikeTravel - 8} ${seat.y + 4} Q ${seat.x + bikeTravel + 10} ${seat.y + 18} ${seat.x + bikeTravel + 28} ${seat.y + 6}"
                  fill="none" stroke="${frameColor}" stroke-width="7" stroke-linecap="round"/>
            <line x1="${handle.x + bikeTravel}" y1="${handle.y}" x2="${handle.x + bikeTravel + 4}" y2="${handle.y - height * .07}"
                  stroke="${frameColor}" stroke-width="7" stroke-linecap="round"/>
            <line x1="${handle.x + bikeTravel - 22}" y1="${handle.y - height * .063}" x2="${handle.x + bikeTravel + 26}" y2="${handle.y - height * .063}"
                  stroke="${frameColor}" stroke-width="7" stroke-linecap="round"/>

            <g transform="translate(${crank.x + bikeTravel} ${crank.y})">
              <g transform="rotate(${wheelAngle})">
                <line x1="-26" y1="0" x2="26" y2="0" stroke="${frameColor}" stroke-width="6" stroke-linecap="round"/>
                <rect x="-34" y="-7" width="14" height="14" rx="3" fill="#111827"/>
                <rect x="20" y="-7" width="14" height="14" rx="3" fill="#111827"/>
              </g>
            </g>
          </g>

          <g filter="url(#softShadow)" transform="translate(${pelicanX} ${pelicanY})">
            <path d="M 10 95 Q -30 80 -18 58 Q -5 72 10 78 Z" fill="${pelicanWing}"/>
            <ellipse cx="72" cy="88" rx="58" ry="48" fill="${pelicanBody}"/>
            <ellipse cx="88" cy="102" rx="42" ry="34" fill="${pelicanBody}"/>
            <path d="M 48 72 Q 20 50 58 38 Q 95 55 88 78 Z" fill="${pelicanWing}"/>
            <path d="M 52 74 Q 30 58 52 48" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
            <path d="M 108 70 Q 138 42 162 48 Q 176 52 170 66 Q 158 78 132 82 Q 118 84 108 70 Z" fill="${pelicanBody}"/>
            <path d="M 168 58 L 250 52 Q 258 56 252 64 L 176 70 Z" fill="${beakColor}"/>
            <path d="M 176 68 Q 210 92 198 112 Q 182 104 174 78 Z" fill="${pouchColor}" stroke="${beakColor}" stroke-width="2"/>
            <circle cx="166" cy="58" r="5" fill="#111827"/>
            <circle cx="168" cy="56" r="1.8" fill="#fff"/>
            <path d="M 78 128 L 70 150 L 58 158" fill="none" stroke="${beakColor}" stroke-width="5" stroke-linecap="round"/>
            <path d="M 96 130 L 104 152 L 118 160" fill="none" stroke="${beakColor}" stroke-width="5" stroke-linecap="round"/>
            <path d="M 128 78 Q 148 88 138 98 Q 126 92 120 82 Z" fill="#EF4444"/>
          </g>
        </svg>

        <div style="${std.css({
				position: "absolute",
				left: 0,
				right: 0,
				top: height * .04,
				textAlign: "center",
				pointerEvents: "none"
			})}; ${titleMotion.style}">
          <div style="font-size:${height * .046}px;font-weight:700;color:#0F172A;opacity:0.9">
            Pelican Commute
          </div>
          <div style="font-size:${height * .022}px;color:#475569;margin-top:6px">
            SuperImg video · inline SVG animation
          </div>
        </div>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVsaWNhbi1iaWN5Y2xlLm1lZGlhLmpzIiwibmFtZXMiOltdLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3N1cGVyaW1nLXR5cGVzL2Rpc3QvaW5kZXguanMiLCIuLi9leGFtcGxlcy92ZWN0b3IvcGVsaWNhbi1iaWN5Y2xlL3BlbGljYW4tYmljeWNsZS5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsIi8vIFBlbGljYW4gb24gYSBCaWN5Y2xlIOKAlCB3aGltc2ljYWwgYW5pbWF0ZWQgdmlkZW8gd2l0aCBpbmxpbmUgU1ZHXG4vLyBEZW1vbnN0cmF0ZXM6IHRpbWVsaW5lLnNlY29uZHMtZHJpdmVuIFNWRyB0cmFuc2Zvcm1zLCBsb29waW5nIG1vdGlvbiwgZGlyZWN0b3IgaW50cm9cblxuaW1wb3J0IHsgZGVmaW5lIH0gZnJvbSBcInN1cGVyaW1nXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZSh7XG4gIHNhbXBsZToge1xuICAgIHNreVRvcDogXCIjODdDRUVCXCIsXG4gICAgc2t5Qm90dG9tOiBcIiNFMEY0RkZcIixcbiAgICByb2FkOiBcIiM2QjcyODBcIixcbiAgICBncmFzczogXCIjNEFERTgwXCIsXG4gICAgZnJhbWVDb2xvcjogXCIjRjk3MzE2XCIsXG4gICAgd2hlZWxDb2xvcjogXCIjMUYyOTM3XCIsXG4gICAgcGVsaWNhbkJvZHk6IFwiI0Y4RkFGQ1wiLFxuICAgIHBlbGljYW5XaW5nOiBcIiNDQkQ1RTFcIixcbiAgICBiZWFrQ29sb3I6IFwiI0ZCOTIzQ1wiLFxuICAgIHBvdWNoQ29sb3I6IFwiI0ZEQkE3NFwiLFxuICB9LFxuXG4gIGNvbmZpZzoge1xuICAgIHdpZHRoOiAxOTIwLFxuICAgIGhlaWdodDogMTA4MCxcbiAgICBmcHM6IDMwLFxuICAgIGR1cmF0aW9uOiBcIjZzXCIsXG4gICAgaW5saW5lQ3NzOiBbXG4gICAgICBcIiogeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cIixcbiAgICAgIFwiYm9keSB7IG92ZXJmbG93OiBoaWRkZW47IGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7IH1cIixcbiAgICBdLFxuICB9LFxuXG4gIHJlbmRlcihjdHgpIHtcbiAgICBjb25zdCB7IHN0ZCwgd2lkdGgsIGhlaWdodCwgZGF0YSwgdGltZWxpbmUgfSA9IGN0eDtcbiAgICBjb25zdCB7XG4gICAgICBza3lUb3AsXG4gICAgICBza3lCb3R0b20sXG4gICAgICByb2FkLFxuICAgICAgZ3Jhc3MsXG4gICAgICBmcmFtZUNvbG9yLFxuICAgICAgd2hlZWxDb2xvcixcbiAgICAgIHBlbGljYW5Cb2R5LFxuICAgICAgcGVsaWNhbldpbmcsXG4gICAgICBiZWFrQ29sb3IsXG4gICAgICBwb3VjaENvbG9yLFxuICAgIH0gPSBkYXRhO1xuXG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3Rvcih7IGludHJvOiBcIjEuMnNcIiwgcmlkZTogXCI0LjBzXCIsIG91dHJvOiBcIjAuOHNcIiB9KTtcbiAgICBjb25zdCB0aXRsZU1vdGlvbiA9IHQubW90aW9uKHsgeTogMTgsIGV4aXQ6IHsgeTogLTEyIH0gfSk7XG5cbiAgICAvLyBMYXlvdXQgKHByb3BvcnRpb25hbCB0byBmcmFtZSBzaXplKVxuICAgIGNvbnN0IGdyb3VuZFkgPSBoZWlnaHQgKiAwLjc4O1xuICAgIGNvbnN0IHJlYXJIdWIgPSB7IHg6IHdpZHRoICogMC4zNCwgeTogZ3JvdW5kWSAtIGhlaWdodCAqIDAuMDk2IH07XG4gICAgY29uc3QgZnJvbnRIdWIgPSB7IHg6IHdpZHRoICogMC42MiwgeTogZ3JvdW5kWSAtIGhlaWdodCAqIDAuMDk2IH07XG4gICAgY29uc3QgY3JhbmsgPSB7IHg6IHdpZHRoICogMC40MjUsIHk6IGdyb3VuZFkgLSBoZWlnaHQgKiAwLjA5NiB9O1xuICAgIGNvbnN0IHNlYXQgPSB7IHg6IHdpZHRoICogMC4zODUsIHk6IGdyb3VuZFkgLSBoZWlnaHQgKiAwLjI0IH07XG4gICAgY29uc3QgaGFuZGxlID0geyB4OiB3aWR0aCAqIDAuNTg1LCB5OiBncm91bmRZIC0gaGVpZ2h0ICogMC4yOSB9O1xuXG4gICAgLy8gQ29udGludW91cyBsb29wIG1vdGlvbiBmcm9tIHNjZW5lIHRpbWVcbiAgICBjb25zdCB3aGVlbFJwbSA9IDEuNDsgLy8gc2Vjb25kcyBwZXIgcmV2b2x1dGlvblxuICAgIGNvbnN0IHdoZWVsQW5nbGUgPSAoKHRpbWVsaW5lLnNlY29uZHMgLyB3aGVlbFJwbSkgKiAzNjApICUgMzYwO1xuICAgIGNvbnN0IHBlbGljYW5Cb2IgPSBNYXRoLnNpbigodGltZWxpbmUuc2Vjb25kcyAqIE1hdGguUEkgKiAyKSAvIDAuOSkgKiBoZWlnaHQgKiAwLjAwODtcbiAgICBjb25zdCBjbG91ZERyaWZ0MSA9ICh0aW1lbGluZS5zZWNvbmRzICogKHdpZHRoICogMC4wMikpICUgKHdpZHRoICogMC4wNSk7XG4gICAgY29uc3QgY2xvdWREcmlmdDIgPSAodGltZWxpbmUuc2Vjb25kcyAqICh3aWR0aCAqIDAuMDE1KSkgJSAod2lkdGggKiAwLjA0KTtcbiAgICBjb25zdCByb2FkRGFzaE9mZnNldCA9IHRpbWVsaW5lLnNlY29uZHMgKiAxNDA7XG4gICAgY29uc3QgYmlrZVRyYXZlbCA9IHN0ZC5pbnRlcnBvbGF0ZShcbiAgICAgIHQuaW4oXCJyaWRlXCIpLFxuICAgICAgWzAsIDFdLFxuICAgICAgWzAsIHdpZHRoICogMC4wOF0sXG4gICAgICBcImVhc2VJbk91dFNpbmVcIlxuICAgICk7XG5cbiAgICBjb25zdCB3aGVlbFIgPSBoZWlnaHQgKiAwLjA5NjtcbiAgICBjb25zdCBzcG9rZSA9IChsZW46IG51bWJlcikgPT4gYFxuICAgICAgPGxpbmUgeDE9XCIkey1sZW59XCIgeTE9XCIwXCIgeDI9XCIke2xlbn1cIiB5Mj1cIjBcIiBzdHJva2U9XCIke3doZWVsQ29sb3J9XCIgc3Ryb2tlLXdpZHRoPVwiM1wiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+XG4gICAgICA8bGluZSB4MT1cIjBcIiB5MT1cIiR7LWxlbn1cIiB4Mj1cIjBcIiB5Mj1cIiR7bGVufVwiIHN0cm9rZT1cIiR7d2hlZWxDb2xvcn1cIiBzdHJva2Utd2lkdGg9XCIzXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgIDxsaW5lIHgxPVwiJHstbGVuICogMC43fVwiIHkxPVwiJHstbGVuICogMC43fVwiIHgyPVwiJHtsZW4gKiAwLjd9XCIgeTI9XCIke2xlbiAqIDAuN31cIiBzdHJva2U9XCIke3doZWVsQ29sb3J9XCIgc3Ryb2tlLXdpZHRoPVwiMi41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICAgIDxsaW5lIHgxPVwiJHtsZW4gKiAwLjd9XCIgeTE9XCIkey1sZW4gKiAwLjd9XCIgeDI9XCIkey1sZW4gKiAwLjd9XCIgeTI9XCIke2xlbiAqIDAuN31cIiBzdHJva2U9XCIke3doZWVsQ29sb3J9XCIgc3Ryb2tlLXdpZHRoPVwiMi41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiLz5cbiAgICBgO1xuXG4gICAgY29uc3Qgd2hlZWwgPSAoaHViOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0pID0+IGBcbiAgICAgIDxnIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgke2h1Yi54ICsgYmlrZVRyYXZlbH0gJHtodWIueX0pXCI+XG4gICAgICAgIDxjaXJjbGUgcj1cIiR7d2hlZWxSfVwiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiJHt3aGVlbENvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjdcIi8+XG4gICAgICAgIDxnIHRyYW5zZm9ybT1cInJvdGF0ZSgke3doZWVsQW5nbGV9KVwiPiR7c3Bva2Uod2hlZWxSICogMC44Myl9PC9nPlxuICAgICAgICA8Y2lyY2xlIHI9XCI4XCIgZmlsbD1cIiR7ZnJhbWVDb2xvcn1cIi8+XG4gICAgICA8L2c+XG4gICAgYDtcblxuICAgIGNvbnN0IHBlbGljYW5YID0gc2VhdC54IC0gd2lkdGggKiAwLjAzICsgYmlrZVRyYXZlbDtcbiAgICBjb25zdCBwZWxpY2FuWSA9IHNlYXQueSAtIGhlaWdodCAqIDAuMTU1ICsgcGVsaWNhbkJvYjtcblxuICAgIHJldHVybiBgXG4gICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGgsIGhlaWdodCwgcG9zaXRpb246IFwicmVsYXRpdmVcIiB9KX1cIj5cbiAgICAgICAgPHN2ZyB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgd2lkdGg9XCIke3dpZHRofVwiIGhlaWdodD1cIiR7aGVpZ2h0fVwiIHZpZXdCb3g9XCIwIDAgJHt3aWR0aH0gJHtoZWlnaHR9XCI+XG4gICAgICAgICAgPGRlZnM+XG4gICAgICAgICAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJza3lcIiB4MT1cIjBcIiB5MT1cIjBcIiB4Mj1cIjBcIiB5Mj1cIjFcIj5cbiAgICAgICAgICAgICAgPHN0b3Agb2Zmc2V0PVwiMCVcIiBzdG9wLWNvbG9yPVwiJHtza3lUb3B9XCIvPlxuICAgICAgICAgICAgICA8c3RvcCBvZmZzZXQ9XCIxMDAlXCIgc3RvcC1jb2xvcj1cIiR7c2t5Qm90dG9tfVwiLz5cbiAgICAgICAgICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgICAgICAgICA8bGluZWFyR3JhZGllbnQgaWQ9XCJyb2FkXCIgeDE9XCIwXCIgeTE9XCIwXCIgeDI9XCIwXCIgeTI9XCIxXCI+XG4gICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjAlXCIgc3RvcC1jb2xvcj1cIiR7cm9hZH1cIi8+XG4gICAgICAgICAgICAgIDxzdG9wIG9mZnNldD1cIjEwMCVcIiBzdG9wLWNvbG9yPVwiIzM3NDE1MVwiLz5cbiAgICAgICAgICAgIDwvbGluZWFyR3JhZGllbnQ+XG4gICAgICAgICAgICA8ZmlsdGVyIGlkPVwic29mdFNoYWRvd1wiIHg9XCItMjAlXCIgeT1cIi0yMCVcIiB3aWR0aD1cIjE0MCVcIiBoZWlnaHQ9XCIxNDAlXCI+XG4gICAgICAgICAgICAgIDxmZURyb3BTaGFkb3cgZHg9XCIwXCIgZHk9XCI0XCIgc3RkRGV2aWF0aW9uPVwiNlwiIGZsb29kLWNvbG9yPVwiIzAwMDAwMDIyXCIvPlxuICAgICAgICAgICAgPC9maWx0ZXI+XG4gICAgICAgICAgPC9kZWZzPlxuXG4gICAgICAgICAgPHJlY3Qgd2lkdGg9XCIke3dpZHRofVwiIGhlaWdodD1cIiR7aGVpZ2h0fVwiIGZpbGw9XCJ1cmwoI3NreSlcIi8+XG5cbiAgICAgICAgICA8ZWxsaXBzZSBjeD1cIiR7d2lkdGggKiAwLjJ9XCIgY3k9XCIke2dyb3VuZFkgLSBoZWlnaHQgKiAwLjAzfVwiIHJ4PVwiJHt3aWR0aCAqIDAuMTJ9XCIgcnk9XCIke2hlaWdodCAqIDAuMDY1fVwiIGZpbGw9XCIke2dyYXNzfVwiIG9wYWNpdHk9XCIwLjU1XCIvPlxuICAgICAgICAgIDxlbGxpcHNlIGN4PVwiJHt3aWR0aCAqIDAuOH1cIiBjeT1cIiR7Z3JvdW5kWSAtIGhlaWdodCAqIDAuMDE1fVwiIHJ4PVwiJHt3aWR0aCAqIDAuMTR9XCIgcnk9XCIke2hlaWdodCAqIDAuMDc1fVwiIGZpbGw9XCIke2dyYXNzfVwiIG9wYWNpdHk9XCIwLjQ1XCIvPlxuXG4gICAgICAgICAgPGcgb3BhY2l0eT1cIjAuOVwiPlxuICAgICAgICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKCR7Y2xvdWREcmlmdDF9IDApXCI+XG4gICAgICAgICAgICAgIDxlbGxpcHNlIGN4PVwiJHt3aWR0aCAqIDAuMTV9XCIgY3k9XCIke2hlaWdodCAqIDAuMTZ9XCIgcng9XCIke3dpZHRoICogMC4wMjh9XCIgcnk9XCIke2hlaWdodCAqIDAuMDQ2fVwiIGZpbGw9XCIjZmZmXCIvPlxuICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIiR7d2lkdGggKiAwLjE5fVwiIGN5PVwiJHtoZWlnaHQgKiAwLjEzNX1cIiByeD1cIiR7d2lkdGggKiAwLjAyfVwiIHJ5PVwiJHtoZWlnaHQgKiAwLjA0fVwiIGZpbGw9XCIjZmZmXCIvPlxuICAgICAgICAgICAgICA8ZWxsaXBzZSBjeD1cIiR7d2lkdGggKiAwLjEyfVwiIGN5PVwiJHtoZWlnaHQgKiAwLjEzNX1cIiByeD1cIiR7d2lkdGggKiAwLjAxNn1cIiByeT1cIiR7aGVpZ2h0ICogMC4wMzN9XCIgZmlsbD1cIiNmZmZcIi8+XG4gICAgICAgICAgICA8L2c+XG4gICAgICAgICAgICA8ZyB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoJHstY2xvdWREcmlmdDJ9IDApXCI+XG4gICAgICAgICAgICAgIDxlbGxpcHNlIGN4PVwiJHt3aWR0aCAqIDAuNzV9XCIgY3k9XCIke2hlaWdodCAqIDAuMn1cIiByeD1cIiR7d2lkdGggKiAwLjAzMn1cIiByeT1cIiR7aGVpZ2h0ICogMC4wNX1cIiBmaWxsPVwiI2ZmZlwiLz5cbiAgICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCIke3dpZHRoICogMC43OX1cIiBjeT1cIiR7aGVpZ2h0ICogMC4xOH1cIiByeD1cIiR7d2lkdGggKiAwLjAyMn1cIiByeT1cIiR7aGVpZ2h0ICogMC4wNDN9XCIgZmlsbD1cIiNmZmZcIi8+XG4gICAgICAgICAgICAgIDxlbGxpcHNlIGN4PVwiJHt3aWR0aCAqIDAuNzJ9XCIgY3k9XCIke2hlaWdodCAqIDAuMTgyfVwiIHJ4PVwiJHt3aWR0aCAqIDAuMDE4fVwiIHJ5PVwiJHtoZWlnaHQgKiAwLjAzN31cIiBmaWxsPVwiI2ZmZlwiLz5cbiAgICAgICAgICAgIDwvZz5cbiAgICAgICAgICA8L2c+XG5cbiAgICAgICAgICA8cmVjdCB4PVwiMFwiIHk9XCIke2dyb3VuZFl9XCIgd2lkdGg9XCIke3dpZHRofVwiIGhlaWdodD1cIiR7aGVpZ2h0IC0gZ3JvdW5kWX1cIiBmaWxsPVwiJHtncmFzc31cIi8+XG4gICAgICAgICAgPHJlY3QgeD1cIjBcIiB5PVwiJHtncm91bmRZICsgaGVpZ2h0ICogMC4wNn1cIiB3aWR0aD1cIiR7d2lkdGh9XCIgaGVpZ2h0PVwiJHtoZWlnaHQgKiAwLjJ9XCIgZmlsbD1cInVybCgjcm9hZClcIi8+XG4gICAgICAgICAgPGxpbmUgeDE9XCIwXCIgeTE9XCIke2dyb3VuZFkgKyBoZWlnaHQgKiAwLjEyfVwiIHgyPVwiJHt3aWR0aH1cIiB5Mj1cIiR7Z3JvdW5kWSArIGhlaWdodCAqIDAuMTJ9XCJcbiAgICAgICAgICAgICAgICBzdHJva2U9XCIjRkRFNjhBXCIgc3Ryb2tlLXdpZHRoPVwiNVwiIHN0cm9rZS1kYXNoYXJyYXk9XCI0MCAzMFwiXG4gICAgICAgICAgICAgICAgc3Ryb2tlLWRhc2hvZmZzZXQ9XCIke3JvYWREYXNoT2Zmc2V0fVwiIG9wYWNpdHk9XCIwLjg1XCIvPlxuXG4gICAgICAgICAgPGcgZmlsdGVyPVwidXJsKCNzb2Z0U2hhZG93KVwiPlxuICAgICAgICAgICAgJHt3aGVlbChyZWFySHViKX1cbiAgICAgICAgICAgICR7d2hlZWwoZnJvbnRIdWIpfVxuXG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAke3JlYXJIdWIueCArIGJpa2VUcmF2ZWx9ICR7cmVhckh1Yi55fVxuICAgICAgICAgICAgICAgICAgICAgTCAke2NyYW5rLnggKyBiaWtlVHJhdmVsfSAke2NyYW5rLnl9XG4gICAgICAgICAgICAgICAgICAgICBMICR7c2VhdC54ICsgYmlrZVRyYXZlbH0gJHtzZWF0Lnl9XG4gICAgICAgICAgICAgICAgICAgICBMICR7aGFuZGxlLnggKyBiaWtlVHJhdmVsfSAke2hhbmRsZS55fVxuICAgICAgICAgICAgICAgICAgICAgTCAke2Zyb250SHViLnggKyBiaWtlVHJhdmVsfSAke2Zyb250SHViLnl9XG4gICAgICAgICAgICAgICAgICAgICBNICR7Y3JhbmsueCArIGJpa2VUcmF2ZWx9ICR7Y3JhbmsueX0gTCAke2Zyb250SHViLnggKyBiaWtlVHJhdmVsfSAke2Zyb250SHViLnl9XCJcbiAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiJHtmcmFtZUNvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjhcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIi8+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAke3NlYXQueCArIGJpa2VUcmF2ZWwgLSA4fSAke3NlYXQueSArIDR9IFEgJHtzZWF0LnggKyBiaWtlVHJhdmVsICsgMTB9ICR7c2VhdC55ICsgMTh9ICR7c2VhdC54ICsgYmlrZVRyYXZlbCArIDI4fSAke3NlYXQueSArIDZ9XCJcbiAgICAgICAgICAgICAgICAgIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiJHtmcmFtZUNvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjdcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgPGxpbmUgeDE9XCIke2hhbmRsZS54ICsgYmlrZVRyYXZlbH1cIiB5MT1cIiR7aGFuZGxlLnl9XCIgeDI9XCIke2hhbmRsZS54ICsgYmlrZVRyYXZlbCArIDR9XCIgeTI9XCIke2hhbmRsZS55IC0gaGVpZ2h0ICogMC4wN31cIlxuICAgICAgICAgICAgICAgICAgc3Ryb2tlPVwiJHtmcmFtZUNvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjdcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgPGxpbmUgeDE9XCIke2hhbmRsZS54ICsgYmlrZVRyYXZlbCAtIDIyfVwiIHkxPVwiJHtoYW5kbGUueSAtIGhlaWdodCAqIDAuMDYzfVwiIHgyPVwiJHtoYW5kbGUueCArIGJpa2VUcmF2ZWwgKyAyNn1cIiB5Mj1cIiR7aGFuZGxlLnkgLSBoZWlnaHQgKiAwLjA2M31cIlxuICAgICAgICAgICAgICAgICAgc3Ryb2tlPVwiJHtmcmFtZUNvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjdcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuXG4gICAgICAgICAgICA8ZyB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoJHtjcmFuay54ICsgYmlrZVRyYXZlbH0gJHtjcmFuay55fSlcIj5cbiAgICAgICAgICAgICAgPGcgdHJhbnNmb3JtPVwicm90YXRlKCR7d2hlZWxBbmdsZX0pXCI+XG4gICAgICAgICAgICAgICAgPGxpbmUgeDE9XCItMjZcIiB5MT1cIjBcIiB4Mj1cIjI2XCIgeTI9XCIwXCIgc3Ryb2tlPVwiJHtmcmFtZUNvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjZcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgICAgIDxyZWN0IHg9XCItMzRcIiB5PVwiLTdcIiB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTRcIiByeD1cIjNcIiBmaWxsPVwiIzExMTgyN1wiLz5cbiAgICAgICAgICAgICAgICA8cmVjdCB4PVwiMjBcIiB5PVwiLTdcIiB3aWR0aD1cIjE0XCIgaGVpZ2h0PVwiMTRcIiByeD1cIjNcIiBmaWxsPVwiIzExMTgyN1wiLz5cbiAgICAgICAgICAgICAgPC9nPlxuICAgICAgICAgICAgPC9nPlxuICAgICAgICAgIDwvZz5cblxuICAgICAgICAgIDxnIGZpbHRlcj1cInVybCgjc29mdFNoYWRvdylcIiB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoJHtwZWxpY2FuWH0gJHtwZWxpY2FuWX0pXCI+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAxMCA5NSBRIC0zMCA4MCAtMTggNTggUSAtNSA3MiAxMCA3OCBaXCIgZmlsbD1cIiR7cGVsaWNhbldpbmd9XCIvPlxuICAgICAgICAgICAgPGVsbGlwc2UgY3g9XCI3MlwiIGN5PVwiODhcIiByeD1cIjU4XCIgcnk9XCI0OFwiIGZpbGw9XCIke3BlbGljYW5Cb2R5fVwiLz5cbiAgICAgICAgICAgIDxlbGxpcHNlIGN4PVwiODhcIiBjeT1cIjEwMlwiIHJ4PVwiNDJcIiByeT1cIjM0XCIgZmlsbD1cIiR7cGVsaWNhbkJvZHl9XCIvPlxuICAgICAgICAgICAgPHBhdGggZD1cIk0gNDggNzIgUSAyMCA1MCA1OCAzOCBRIDk1IDU1IDg4IDc4IFpcIiBmaWxsPVwiJHtwZWxpY2FuV2luZ31cIi8+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSA1MiA3NCBRIDMwIDU4IDUyIDQ4XCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjOTRBM0I4XCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAxMDggNzAgUSAxMzggNDIgMTYyIDQ4IFEgMTc2IDUyIDE3MCA2NiBRIDE1OCA3OCAxMzIgODIgUSAxMTggODQgMTA4IDcwIFpcIiBmaWxsPVwiJHtwZWxpY2FuQm9keX1cIi8+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSAxNjggNTggTCAyNTAgNTIgUSAyNTggNTYgMjUyIDY0IEwgMTc2IDcwIFpcIiBmaWxsPVwiJHtiZWFrQ29sb3J9XCIvPlxuICAgICAgICAgICAgPHBhdGggZD1cIk0gMTc2IDY4IFEgMjEwIDkyIDE5OCAxMTIgUSAxODIgMTA0IDE3NCA3OCBaXCIgZmlsbD1cIiR7cG91Y2hDb2xvcn1cIiBzdHJva2U9XCIke2JlYWtDb2xvcn1cIiBzdHJva2Utd2lkdGg9XCIyXCIvPlxuICAgICAgICAgICAgPGNpcmNsZSBjeD1cIjE2NlwiIGN5PVwiNThcIiByPVwiNVwiIGZpbGw9XCIjMTExODI3XCIvPlxuICAgICAgICAgICAgPGNpcmNsZSBjeD1cIjE2OFwiIGN5PVwiNTZcIiByPVwiMS44XCIgZmlsbD1cIiNmZmZcIi8+XG4gICAgICAgICAgICA8cGF0aCBkPVwiTSA3OCAxMjggTCA3MCAxNTAgTCA1OCAxNThcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIiR7YmVha0NvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgPHBhdGggZD1cIk0gOTYgMTMwIEwgMTA0IDE1MiBMIDExOCAxNjBcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cIiR7YmVha0NvbG9yfVwiIHN0cm9rZS13aWR0aD1cIjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPlxuICAgICAgICAgICAgPHBhdGggZD1cIk0gMTI4IDc4IFEgMTQ4IDg4IDEzOCA5OCBRIDEyNiA5MiAxMjAgODIgWlwiIGZpbGw9XCIjRUY0NDQ0XCIvPlxuICAgICAgICAgIDwvZz5cbiAgICAgICAgPC9zdmc+XG5cbiAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgcG9zaXRpb246IFwiYWJzb2x1dGVcIixcbiAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgIHJpZ2h0OiAwLFxuICAgICAgICAgIHRvcDogaGVpZ2h0ICogMC4wNCxcbiAgICAgICAgICB0ZXh0QWxpZ246IFwiY2VudGVyXCIsXG4gICAgICAgICAgcG9pbnRlckV2ZW50czogXCJub25lXCIsXG4gICAgICAgIH0pfTsgJHt0aXRsZU1vdGlvbi5zdHlsZX1cIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOiR7aGVpZ2h0ICogMC4wNDZ9cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMwRjE3MkE7b3BhY2l0eTowLjlcIj5cbiAgICAgICAgICAgIFBlbGljYW4gQ29tbXV0ZVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6JHtoZWlnaHQgKiAwLjAyMn1weDtjb2xvcjojNDc1NTY5O21hcmdpbi10b3A6NnB4XCI+XG4gICAgICAgICAgICBTdXBlckltZyB2aWRlbyDCtyBpbmxpbmUgU1ZHIGFuaW1hdGlvblxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwv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