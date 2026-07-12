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
			month: "March",
			year: "2026",
			hookLine1: "5 meetups.",
			hookLine2: "This month.",
			tagline: "Find your people.",
			cta: "All free. All welcome.",
			ctaUrl: "meetup.com/techlahoma",
			techlahomaSvg: "https://www.techlahoma.org/wp-content/uploads/2024/09/cropped-techlahoma_horizontaltext-white.png",
			backgroundImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1920",
			events: [
				{
					date: "Mar 4",
					day: "TUE",
					time: "11 AM",
					group: "OKC Coffee & Code",
					title: "Coworking Session",
					location: "8th Street Market",
					color: "#f65858"
				},
				{
					date: "Mar 7",
					day: "FRI",
					time: "6:30 PM",
					group: "Tulsa Web Devs",
					title: "React 19 Deep Dive",
					location: "36 Degrees North",
					color: "#3b82f6"
				},
				{
					date: "Mar 12",
					day: "WED",
					time: "6 PM",
					group: "OKC Python",
					title: "Intro to FastAPI",
					location: "Tailwind HQ",
					color: "#10b981"
				},
				{
					date: "Mar 18",
					day: "TUE",
					time: "7 PM",
					group: "Techlahoma Foundation",
					title: "Monthly Board Meeting",
					location: "Virtual",
					color: "#8b5cf6"
				},
				{
					date: "Mar 25",
					day: "TUE",
					time: "6 PM",
					group: "OKC Design+Dev",
					title: "Design Systems Workshop",
					location: "Starspace46",
					color: "#f59e0b"
				}
			]
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
			const { std, width, height, data } = ctx;
			const { month, year, hookLine1, hookLine2, tagline, cta, ctaUrl, techlahomaSvg, backgroundImage, events } = data;
			const r = std.createResponsive(ctx);
			const t = ctx.director({
				hook: "2.0s",
				events: "9.0s",
				recap: "2.5s",
				outro: "1.5s"
			});
			const bg = std.backgrounds.kenBurns({
				src: backgroundImage,
				progress: ctx.timeline.progress,
				zoomTo: 1.12,
				overlay: "rgba(0, 0, 0, 0.6)"
			});
			if (t.active === "recap") {
				t.in("recap");
				const recapBg = std.backgrounds.kenBurns({
					src: backgroundImage,
					progress: ctx.timeline.progress,
					zoomTo: 1.12,
					overlay: "rgba(0, 0, 0, 0.7)"
				});
				const recapRows = events.map((event, i) => {
					const anim = t.motion({
						during: "recap",
						at: `${((.1 / 2.5 + i * .08 / 2.5) * 100).toFixed(1)}%`,
						for: `${(.3 / 2.5 * 100).toFixed(1)}%`,
						y: 20
					});
					r({
						portrait: 72,
						square: 56,
						default: 64
					});
					const dateBadgeWidth = r({
						portrait: 60,
						square: 48,
						default: 56
					});
					const groupFontSize = r({
						portrait: 22,
						square: 16,
						default: 20
					});
					const timeFontSize = r({
						portrait: 18,
						square: 14,
						default: 16
					});
					r({
						portrait: "92%",
						square: "85%",
						default: "70%"
					});
					const rowPadding = r({
						portrait: "12px 16px",
						default: "10px 14px"
					});
					const rowGap = r({
						portrait: 16,
						default: 12
					});
					const dayFontSize = r({
						portrait: 10,
						default: 8
					});
					const dateFontSize = r({
						portrait: 22,
						default: 18
					});
					return `
          <div style="${std.css({
						display: "flex",
						alignItems: "center",
						gap: rowGap,
						padding: rowPadding,
						background: "rgba(0, 0, 0, 0.8)",
						borderLeft: `4px solid ${event.color}`,
						borderRadius: 8,
						opacity: anim.opacity,
						transform: `translateY(${anim.y}px)`
					})}">
            <div style="${std.css({
						width: dateBadgeWidth,
						height: dateBadgeWidth,
						background: event.color,
						borderRadius: 8,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0
					})}">
              <div style="${std.css({
						fontSize: dayFontSize,
						fontWeight: 700,
						color: "#fff",
						letterSpacing: "0.1em"
					})}">${event.day}</div>
              <div style="${std.css({
						fontSize: dateFontSize,
						fontWeight: 800,
						color: "#fff",
						lineHeight: 1
					})}">${event.date.split(" ")[1]}</div>
            </div>
            <div style="${std.css({
						flex: 1,
						fontSize: groupFontSize,
						fontWeight: 600,
						color: "#fff",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					})}">${event.group}</div>
            <div style="${std.css({
						fontSize: timeFontSize,
						fontWeight: 500,
						color: "rgba(255,255,255,0.8)",
						whiteSpace: "nowrap"
					})}">${event.time}</div>
          </div>
        `;
				}).join("");
				return `
        <div style="${std.css({
					width,
					height,
					position: "relative",
					overflow: "hidden"
				})}">
          ${recapBg.html}
          <div style="${std.css({
					position: "relative",
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: r({
						portrait: 32,
						default: 40
					})
				})}">
            <div style="${std.css({
					width: r({
						portrait: "92%",
						default: "70%"
					}),
					maxWidth: 960,
					display: "flex",
					flexDirection: "column",
					gap: 12
				})}">
              ${recapRows}
            </div>
          </div>
        </div>
      `;
			}
			if (t.active === "outro") {
				t.in("outro");
				const logoWidth = r({
					portrait: 500,
					square: 400,
					default: 480
				});
				const ctaAnim = t.motion({
					during: "outro",
					at: `${(.2 / 1.5 * 100).toFixed(1)}%`,
					for: `${(.3 / 1.5 * 100).toFixed(1)}%`,
					y: 20
				});
				const logoAnim = t.motion({
					during: "outro",
					at: "0%",
					for: `${(.16 / 1.5 * 100).toFixed(1)}%`,
					scale: .1
				});
				const fadeOut = t.tween(0, 1, {
					during: "outro",
					at: `${(.6 / 1.5 * 100).toFixed(1)}%`,
					for: `${(.4 / 1.5 * 100).toFixed(1)}%`,
					easing: "easeInCubic"
				});
				return `
        <div style="${std.css({
					width,
					height,
					background: "#000",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: r({
						portrait: 48,
						default: 32
					}),
					opacity: 1 - fadeOut
				})}">
          <div style="${std.css({
					fontSize: r({
						portrait: 36,
						default: 32
					}),
					fontWeight: 600,
					color: "#fff"
				})};${ctaAnim.style}">${cta}</div>
          <img src="${techlahomaSvg}" style="${std.css({ width: logoWidth })};${logoAnim.style}" />
          <div style="${std.css({
					fontSize: r({
						portrait: 28,
						default: 24
					}),
					fontWeight: 500,
					color: "rgba(255,255,255,0.7)"
				})};${ctaAnim.style}">${ctaUrl}</div>
        </div>
      `;
			}
			if (t.active === "hook") {
				const hook1P = t.tween(0, 1, {
					during: "hook",
					at: "0%",
					for: `${(.6 / 2 * 100).toFixed(1)}%`
				});
				const hook2P = t.tween(0, 1, {
					during: "hook",
					at: `${(.9 / 2 * 100).toFixed(1)}%`,
					for: `${(.5 / 2 * 100).toFixed(1)}%`
				});
				const taglineP = t.tween(0, 1, {
					during: "hook",
					at: `${(1.4 / 2 * 100).toFixed(1)}%`,
					for: `${(.5 / 2 * 100).toFixed(1)}%`
				});
				const hook1Visible = std.text.type(hookLine1, hook1P).visible;
				const hook2Visible = std.text.type(hookLine2, hook2P).visible;
				const taglineVisible = std.text.type(tagline, taglineP).visible;
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
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
					gap: 16
				})}">
            <div style="${std.css({
					fontSize: r({
						portrait: 72,
						default: 64
					}),
					fontWeight: 800,
					color: "#fff"
				})}">${hook1Visible}</div>
            <div style="${std.css({
					fontSize: r({
						portrait: 72,
						default: 64
					}),
					fontWeight: 800,
					color: "#fff"
				})}">${hook2Visible}</div>
            <div style="${std.css({
					fontSize: r({
						portrait: 32,
						default: 28
					}),
					fontWeight: 500,
					color: "rgba(255,255,255,0.8)",
					marginTop: 16
				})}">${taglineVisible}</div>
          </div>
        </div>
      `;
			}
			const eventCards = events.map((event, i) => {
				const exitStart = (2 + (i + 1) * (1 / events.length) * .9 * 9) / 15;
				const cardAnim = t.motion({
					during: "events",
					at: `${(i * (1 / events.length) * .8 * 100).toFixed(1)}%`,
					for: `${(.7 / 9 * 100).toFixed(1)}%`,
					scale: .05,
					y: 60,
					exit: {
						window: [exitStart, exitStart + .5 / 15],
						y: 0,
						scale: 1
					}
				});
				if (!cardAnim.visible) return "";
				const cardWidth = r({
					portrait: "88%",
					square: "80%",
					default: "70%"
				});
				const dateBadgeSize = r({
					portrait: 80,
					square: 60,
					default: 70
				});
				return `
        <div style="${std.css({
					position: "absolute",
					width: cardWidth,
					maxWidth: 900,
					background: "rgba(0, 0, 0, 0.85)",
					borderRadius: 16,
					padding: "24px 28px",
					display: "flex",
					alignItems: "center",
					gap: 20,
					boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
					borderLeft: `4px solid ${event.color}`
				})};${cardAnim.style}">
          <div style="${std.css({
					width: dateBadgeSize,
					height: dateBadgeSize,
					background: event.color,
					borderRadius: 12,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0
				})}">
            <div style="${std.css({
					fontSize: r({
						portrait: 14,
						default: 11
					}),
					fontWeight: 700,
					color: "#fff"
				})}">${event.day}</div>
            <div style="${std.css({
					fontSize: r({
						portrait: 28,
						default: 22
					}),
					fontWeight: 800,
					color: "#fff",
					lineHeight: 1
				})}">${event.date.split(" ")[1]}</div>
          </div>
          <div style="${std.css({
					flex: 1,
					display: "flex",
					flexDirection: "column",
					gap: 6
				})}">
            <div style="${std.css({
					fontSize: r({
						portrait: 28,
						default: 24
					}),
					fontWeight: 700,
					color: event.color
				})}">${event.group}</div>
            <div style="${std.css({
					fontSize: r({
						portrait: 36,
						default: 32
					}),
					fontWeight: 600,
					color: "#fff",
					lineHeight: 1.2
				})}">${event.title}</div>
            <div style="${std.css({
					fontSize: r({
						portrait: 24,
						default: 22
					}),
					fontWeight: 400,
					color: "rgba(255,255,255,0.7)"
				})}">${event.location}</div>
          </div>
          <div style="${std.css({
					padding: "8px 16px",
					background: "rgba(255,255,255,0.1)",
					borderRadius: 8,
					fontSize: r({
						portrait: 20,
						default: 18
					}),
					fontWeight: 600,
					color: "#fff",
					whiteSpace: "nowrap"
				})}">${event.time}</div>
        </div>
      `;
			}).join("");
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
				justifyContent: "center"
			})}">
          ${eventCards}
        </div>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9udGhseS1ldmVudHMubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL2V2ZW50cy9tb250aGx5LWV2ZW50cy9tb250aGx5LWV2ZW50cy5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5pbnRlcmZhY2UgVGVjaGxhaG9tRXZlbnQge1xuICBkYXRlOiBzdHJpbmc7XG4gIGRheTogc3RyaW5nO1xuICB0aW1lOiBzdHJpbmc7XG4gIGdyb3VwOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGxvY2F0aW9uOiBzdHJpbmc7XG4gIGNvbG9yOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZSh7XG4gIHNhbXBsZToge1xuICAgIG1vbnRoOiBcIk1hcmNoXCIsXG4gICAgeWVhcjogXCIyMDI2XCIsXG4gICAgaG9va0xpbmUxOiBcIjUgbWVldHVwcy5cIixcbiAgICBob29rTGluZTI6IFwiVGhpcyBtb250aC5cIixcbiAgICB0YWdsaW5lOiBcIkZpbmQgeW91ciBwZW9wbGUuXCIsXG4gICAgY3RhOiBcIkFsbCBmcmVlLiBBbGwgd2VsY29tZS5cIixcbiAgICBjdGFVcmw6IFwibWVldHVwLmNvbS90ZWNobGFob21hXCIsXG4gICAgdGVjaGxhaG9tYVN2ZzogXCJodHRwczovL3d3dy50ZWNobGFob21hLm9yZy93cC1jb250ZW50L3VwbG9hZHMvMjAyNC8wOS9jcm9wcGVkLXRlY2hsYWhvbWFfaG9yaXpvbnRhbHRleHQtd2hpdGUucG5nXCIsXG4gICAgYmFja2dyb3VuZEltYWdlOiBcImh0dHBzOi8vaW1hZ2VzLnVuc3BsYXNoLmNvbS9waG90by0xNTQwNTc1NDY3MDYzLTE3OGE1MGMyZGY4Nz93PTE5MjBcIixcblxuICAgIGV2ZW50czogW1xuICAgICAgeyBkYXRlOiBcIk1hciA0XCIsIGRheTogXCJUVUVcIiwgdGltZTogXCIxMSBBTVwiLCBncm91cDogXCJPS0MgQ29mZmVlICYgQ29kZVwiLCB0aXRsZTogXCJDb3dvcmtpbmcgU2Vzc2lvblwiLCBsb2NhdGlvbjogXCI4dGggU3RyZWV0IE1hcmtldFwiLCBjb2xvcjogXCIjZjY1ODU4XCIgfSxcbiAgICAgIHsgZGF0ZTogXCJNYXIgN1wiLCBkYXk6IFwiRlJJXCIsIHRpbWU6IFwiNjozMCBQTVwiLCBncm91cDogXCJUdWxzYSBXZWIgRGV2c1wiLCB0aXRsZTogXCJSZWFjdCAxOSBEZWVwIERpdmVcIiwgbG9jYXRpb246IFwiMzYgRGVncmVlcyBOb3J0aFwiLCBjb2xvcjogXCIjM2I4MmY2XCIgfSxcbiAgICAgIHsgZGF0ZTogXCJNYXIgMTJcIiwgZGF5OiBcIldFRFwiLCB0aW1lOiBcIjYgUE1cIiwgZ3JvdXA6IFwiT0tDIFB5dGhvblwiLCB0aXRsZTogXCJJbnRybyB0byBGYXN0QVBJXCIsIGxvY2F0aW9uOiBcIlRhaWx3aW5kIEhRXCIsIGNvbG9yOiBcIiMxMGI5ODFcIiB9LFxuICAgICAgeyBkYXRlOiBcIk1hciAxOFwiLCBkYXk6IFwiVFVFXCIsIHRpbWU6IFwiNyBQTVwiLCBncm91cDogXCJUZWNobGFob21hIEZvdW5kYXRpb25cIiwgdGl0bGU6IFwiTW9udGhseSBCb2FyZCBNZWV0aW5nXCIsIGxvY2F0aW9uOiBcIlZpcnR1YWxcIiwgY29sb3I6IFwiIzhiNWNmNlwiIH0sXG4gICAgICB7IGRhdGU6IFwiTWFyIDI1XCIsIGRheTogXCJUVUVcIiwgdGltZTogXCI2IFBNXCIsIGdyb3VwOiBcIk9LQyBEZXNpZ24rRGV2XCIsIHRpdGxlOiBcIkRlc2lnbiBTeXN0ZW1zIFdvcmtzaG9wXCIsIGxvY2F0aW9uOiBcIlN0YXJzcGFjZTQ2XCIsIGNvbG9yOiBcIiNmNTllMGJcIiB9LFxuICAgIF0gYXMgVGVjaGxhaG9tRXZlbnRbXSxcbiAgfSxcblxuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCIxNXNcIixcbiAgICBmb250czogW1wiSW50ZXI6d2dodEA0MDA7NTAwOzYwMDs3MDA7ODAwXCJdLFxuICAgIGF1ZGlvOiB7XG4gICAgICBpZDogXCJiZWRcIixcbiAgICAgIHNyYzogXCIuLi8uLi9fYXNzZXRzL2xvZmktYmcubXAzXCIsXG4gICAgICByb2xlOiBcIm11c2ljXCIsXG4gICAgICB2b2x1bWU6IDAuNixcbiAgICAgIGZhZGVJbjogXCIwLjVzXCIsXG4gICAgICBmYWRlT3V0OiBcIjEuNXNcIixcbiAgICAgIGxvb3A6IHRydWUsXG4gICAgfSxcbiAgICBvdXRwdXRzOiB7XG4gICAgICBsYW5kc2NhcGU6IHsgd2lkdGg6IDE5MjAsIGhlaWdodDogMTA4MCB9LFxuICAgICAgc3F1YXJlOiB7IHdpZHRoOiAxMDgwLCBoZWlnaHQ6IDEwODAgfSxcbiAgICAgIHN0b3J5OiB7IHdpZHRoOiAxMDgwLCBoZWlnaHQ6IDE5MjAgfSxcbiAgICB9LFxuICAgIGlubGluZUNzczogW2BcbiAgICAgICogeyBtYXJnaW46IDA7IHBhZGRpbmc6IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH1cbiAgICAgIGJvZHkgeyBmb250LWZhbWlseTogJ0ludGVyJywgc2Fucy1zZXJpZjsgb3ZlcmZsb3c6IGhpZGRlbjsgfVxuICAgIGBdLFxuICB9LFxuXG4gIHJlbmRlcihjdHgpIHtcbiAgICBjb25zdCB7IHN0ZCwgd2lkdGgsIGhlaWdodCwgZGF0YSB9ID0gY3R4O1xuICAgIGNvbnN0IHsgbW9udGgsIHllYXIsIGhvb2tMaW5lMSwgaG9va0xpbmUyLCB0YWdsaW5lLCBjdGEsIGN0YVVybCwgdGVjaGxhaG9tYVN2ZywgYmFja2dyb3VuZEltYWdlLCBldmVudHMgfSA9IGRhdGE7XG5cbiAgICBjb25zdCByID0gc3RkLmNyZWF0ZVJlc3BvbnNpdmUoY3R4KTtcblxuICAgIC8vID09PSBUSU1FTElORSBQSEFTRVMgPT09XG4gICAgLy8gaG9vazogMnMsIGV2ZW50czogOXMsIHJlY2FwOiAyLjVzLCBvdXRybzogMS41c1xuICAgIGNvbnN0IHQgPSBjdHguZGlyZWN0b3Ioe1xuICAgICAgaG9vazogXCIyLjBzXCIsXG4gICAgICBldmVudHM6IFwiOS4wc1wiLFxuICAgICAgcmVjYXA6IFwiMi41c1wiLFxuICAgICAgb3V0cm86IFwiMS41c1wiXG4gICAgfSk7XG5cbiAgICAvLyBLZW4gQnVybnMgYmFja2dyb3VuZCAoc2hhcmVkKVxuICAgIGNvbnN0IGJnID0gc3RkLmJhY2tncm91bmRzLmtlbkJ1cm5zKHtcbiAgICAgIHNyYzogYmFja2dyb3VuZEltYWdlLFxuICAgICAgcHJvZ3Jlc3M6IGN0eC50aW1lbGluZS5wcm9ncmVzcyxcbiAgICAgIHpvb21UbzogMS4xMixcbiAgICAgIG92ZXJsYXk6IFwicmdiYSgwLCAwLCAwLCAwLjYpXCIsXG4gICAgfSk7XG5cbiAgICAvLyA9PT0gUkVDQVAgUEhBU0UgPT09XG4gICAgaWYgKHQuYWN0aXZlID09PSBcInJlY2FwXCIpIHtcbiAgICAgIGNvbnN0IHJlY2FwUCA9IHQuaW4oXCJyZWNhcFwiKTtcbiAgICAgIGNvbnN0IHJlY2FwQmcgPSBzdGQuYmFja2dyb3VuZHMua2VuQnVybnMoeyBzcmM6IGJhY2tncm91bmRJbWFnZSwgcHJvZ3Jlc3M6IGN0eC50aW1lbGluZS5wcm9ncmVzcywgem9vbVRvOiAxLjEyLCBvdmVybGF5OiBcInJnYmEoMCwgMCwgMCwgMC43KVwiIH0pO1xuXG4gICAgICAvLyBTdGFnZ2VyIHJvd3MgdXNpbmcgZGlyZWN0b3JcbiAgICAgIGNvbnN0IHJlY2FwUm93cyA9IGV2ZW50cy5tYXAoKGV2ZW50OiBUZWNobGFob21FdmVudCwgaTogbnVtYmVyKSA9PiB7XG4gICAgICAgIGNvbnN0IGFuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJyZWNhcFwiLCBhdDogYCR7KCgwLjEvMi41ICsgaSAqIDAuMDgvMi41KSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZm9yOiBgJHsoKDAuMy8yLjUpICogMTAwKS50b0ZpeGVkKDEpfSVgLCB5OiAyMCB9KTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHJvd0hlaWdodCA9IHIoeyBwb3J0cmFpdDogNzIsIHNxdWFyZTogNTYsIGRlZmF1bHQ6IDY0IH0pO1xuICAgICAgICBjb25zdCBkYXRlQmFkZ2VXaWR0aCA9IHIoeyBwb3J0cmFpdDogNjAsIHNxdWFyZTogNDgsIGRlZmF1bHQ6IDU2IH0pO1xuICAgICAgICBjb25zdCBncm91cEZvbnRTaXplID0gcih7IHBvcnRyYWl0OiAyMiwgc3F1YXJlOiAxNiwgZGVmYXVsdDogMjAgfSk7XG4gICAgICAgIGNvbnN0IHRpbWVGb250U2l6ZSA9IHIoeyBwb3J0cmFpdDogMTgsIHNxdWFyZTogMTQsIGRlZmF1bHQ6IDE2IH0pO1xuICAgICAgICBjb25zdCBjb250YWluZXJXaWR0aCA9IHIoeyBwb3J0cmFpdDogXCI5MiVcIiwgc3F1YXJlOiBcIjg1JVwiLCBkZWZhdWx0OiBcIjcwJVwiIH0pO1xuICAgICAgICBjb25zdCByb3dQYWRkaW5nID0gcih7IHBvcnRyYWl0OiBcIjEycHggMTZweFwiLCBkZWZhdWx0OiBcIjEwcHggMTRweFwiIH0pO1xuICAgICAgICBjb25zdCByb3dHYXAgPSByKHsgcG9ydHJhaXQ6IDE2LCBkZWZhdWx0OiAxMiB9KTtcbiAgICAgICAgY29uc3QgZGF5Rm9udFNpemUgPSByKHsgcG9ydHJhaXQ6IDEwLCBkZWZhdWx0OiA4IH0pO1xuICAgICAgICBjb25zdCBkYXRlRm9udFNpemUgPSByKHsgcG9ydHJhaXQ6IDIyLCBkZWZhdWx0OiAxOCB9KTtcblxuICAgICAgICByZXR1cm4gYFxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGdhcDogcm93R2FwLCBwYWRkaW5nOiByb3dQYWRkaW5nLFxuICAgICAgICAgICAgYmFja2dyb3VuZDogXCJyZ2JhKDAsIDAsIDAsIDAuOClcIiwgYm9yZGVyTGVmdDogYDRweCBzb2xpZCAke2V2ZW50LmNvbG9yfWAsIGJvcmRlclJhZGl1czogOCxcbiAgICAgICAgICAgIG9wYWNpdHk6IGFuaW0ub3BhY2l0eSwgdHJhbnNmb3JtOiBgdHJhbnNsYXRlWSgke2FuaW0ueX1weClgLFxuICAgICAgICAgIH0pfVwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7XG4gICAgICAgICAgICAgIHdpZHRoOiBkYXRlQmFkZ2VXaWR0aCwgaGVpZ2h0OiBkYXRlQmFkZ2VXaWR0aCwgYmFja2dyb3VuZDogZXZlbnQuY29sb3IsIGJvcmRlclJhZGl1czogOCxcbiAgICAgICAgICAgICAgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiLCBmbGV4U2hyaW5rOiAwLFxuICAgICAgICAgICAgfSl9XCI+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogZGF5Rm9udFNpemUsIGZvbnRXZWlnaHQ6IDcwMCwgY29sb3I6IFwiI2ZmZlwiLCBsZXR0ZXJTcGFjaW5nOiBcIjAuMWVtXCIgfSl9XCI+JHtldmVudC5kYXl9PC9kaXY+XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogZGF0ZUZvbnRTaXplLCBmb250V2VpZ2h0OiA4MDAsIGNvbG9yOiBcIiNmZmZcIiwgbGluZUhlaWdodDogMSB9KX1cIj4ke2V2ZW50LmRhdGUuc3BsaXQoXCIgXCIpWzFdfTwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZmxleDogMSwgZm9udFNpemU6IGdyb3VwRm9udFNpemUsIGZvbnRXZWlnaHQ6IDYwMCwgY29sb3I6IFwiI2ZmZlwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiLCBvdmVyZmxvdzogXCJoaWRkZW5cIiwgdGV4dE92ZXJmbG93OiBcImVsbGlwc2lzXCIgfSl9XCI+JHtldmVudC5ncm91cH08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogdGltZUZvbnRTaXplLCBmb250V2VpZ2h0OiA1MDAsIGNvbG9yOiBcInJnYmEoMjU1LDI1NSwyNTUsMC44KVwiLCB3aGl0ZVNwYWNlOiBcIm5vd3JhcFwiIH0pfVwiPiR7ZXZlbnQudGltZX08L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICAgIH0pLmpvaW4oXCJcIik7XG5cbiAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyB3aWR0aCwgaGVpZ2h0LCBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLCBvdmVyZmxvdzogXCJoaWRkZW5cIiB9KX1cIj5cbiAgICAgICAgICAke3JlY2FwQmcuaHRtbH1cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgcG9zaXRpb246IFwicmVsYXRpdmVcIiwgd2lkdGg6IFwiMTAwJVwiLCBoZWlnaHQ6IFwiMTAwJVwiLCBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsIHBhZGRpbmc6IHIoeyBwb3J0cmFpdDogMzIsIGRlZmF1bHQ6IDQwIH0pIH0pfVwiPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoOiByKHsgcG9ydHJhaXQ6IFwiOTIlXCIsIGRlZmF1bHQ6IFwiNzAlXCIgfSksIG1heFdpZHRoOiA5NjAsIGRpc3BsYXk6IFwiZmxleFwiLCBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLCBnYXA6IDEyIH0pfVwiPlxuICAgICAgICAgICAgICAke3JlY2FwUm93c31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIGA7XG4gICAgfVxuXG4gICAgLy8gPT09IE9VVFJPIFBIQVNFID09PVxuICAgIGlmICh0LmFjdGl2ZSA9PT0gXCJvdXRyb1wiKSB7XG4gICAgICBjb25zdCBvdXRyb1AgPSB0LmluKFwib3V0cm9cIik7XG4gICAgICBjb25zdCBsb2dvV2lkdGggPSByKHsgcG9ydHJhaXQ6IDUwMCwgc3F1YXJlOiA0MDAsIGRlZmF1bHQ6IDQ4MCB9KTtcblxuICAgICAgY29uc3QgY3RhQW5pbSA9IHQubW90aW9uKHsgZHVyaW5nOiBcIm91dHJvXCIsIGF0OiBgJHsoKDAuMi8xLjUpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBmb3I6IGAkeygoMC4zLzEuNSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIHk6IDIwIH0pO1xuICAgICAgY29uc3QgbG9nb0FuaW0gPSB0Lm1vdGlvbih7IGR1cmluZzogXCJvdXRyb1wiLCBhdDogXCIwJVwiLCBmb3I6IGAkeygoMC4xNi8xLjUpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBzY2FsZTogMC4xIH0pO1xuICAgICAgY29uc3QgZmFkZU91dCA9IHQudHdlZW4oMCwgMSwgeyBkdXJpbmc6IFwib3V0cm9cIiwgYXQ6IGAkeygoMC42LzEuNSkgKiAxMDApLnRvRml4ZWQoMSl9JWAsIGZvcjogYCR7KCgwLjQvMS41KSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZWFzaW5nOiBcImVhc2VJbkN1YmljXCIgfSk7XG5cbiAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyB3aWR0aCwgaGVpZ2h0LCBiYWNrZ3JvdW5kOiBcIiMwMDBcIiwgZGlzcGxheTogXCJmbGV4XCIsIGZsZXhEaXJlY3Rpb246IFwiY29sdW1uXCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIGp1c3RpZnlDb250ZW50OiBcImNlbnRlclwiLCBnYXA6IHIoeyBwb3J0cmFpdDogNDgsIGRlZmF1bHQ6IDMyIH0pLCBvcGFjaXR5OiAxIC0gZmFkZU91dCB9KX1cIj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogMzYsIGRlZmF1bHQ6IDMyIH0pLCBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiBcIiNmZmZcIiB9KX07JHtjdGFBbmltLnN0eWxlfVwiPiR7Y3RhfTwvZGl2PlxuICAgICAgICAgIDxpbWcgc3JjPVwiJHt0ZWNobGFob21hU3ZnfVwiIHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGg6IGxvZ29XaWR0aCB9KX07JHtsb2dvQW5pbS5zdHlsZX1cIiAvPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogcih7IHBvcnRyYWl0OiAyOCwgZGVmYXVsdDogMjQgfSksIGZvbnRXZWlnaHQ6IDUwMCwgY29sb3I6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjcpXCIgfSl9OyR7Y3RhQW5pbS5zdHlsZX1cIj4ke2N0YVVybH08L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICBgO1xuICAgIH1cblxuICAgIC8vID09PSBIT09LIFBIQVNFID09PVxuICAgIGlmICh0LmFjdGl2ZSA9PT0gXCJob29rXCIpIHtcbiAgICAgIGNvbnN0IGhvb2sxUCA9IHQudHdlZW4oMCwgMSwgeyBkdXJpbmc6IFwiaG9va1wiLCBhdDogXCIwJVwiLCBmb3I6IGAkeygoMC42LzIpICogMTAwKS50b0ZpeGVkKDEpfSVgfSk7XG4gICAgICBjb25zdCBob29rMlAgPSB0LnR3ZWVuKDAsIDEsIHsgZHVyaW5nOiBcImhvb2tcIiwgYXQ6IGAkeygoMC45LzIpICogMTAwKS50b0ZpeGVkKDEpfSVgLCBmb3I6IGAkeygoMC41LzIpICogMTAwKS50b0ZpeGVkKDEpfSVgfSk7XG4gICAgICAvLyBTdGFydCBlYXJseSBlbm91Z2ggdGhhdCB0aGUgdGFnbGluZSBmaW5pc2hlcyB0eXBpbmcgYmVmb3JlIHRoZSBob29rIHBoYXNlIGVuZHMgYXQgMnNcbiAgICAgIGNvbnN0IHRhZ2xpbmVQID0gdC50d2VlbigwLCAxLCB7IGR1cmluZzogXCJob29rXCIsIGF0OiBgJHsoKDEuNC8yKSAqIDEwMCkudG9GaXhlZCgxKX0lYCwgZm9yOiBgJHsoKDAuNS8yKSAqIDEwMCkudG9GaXhlZCgxKX0lYH0pO1xuICAgICAgXG4gICAgICBjb25zdCBob29rMVZpc2libGUgPSBzdGQudGV4dC50eXBlKGhvb2tMaW5lMSwgaG9vazFQKS52aXNpYmxlO1xuICAgICAgY29uc3QgaG9vazJWaXNpYmxlID0gc3RkLnRleHQudHlwZShob29rTGluZTIsIGhvb2syUCkudmlzaWJsZTtcbiAgICAgIGNvbnN0IHRhZ2xpbmVWaXNpYmxlID0gc3RkLnRleHQudHlwZSh0YWdsaW5lLCB0YWdsaW5lUCkudmlzaWJsZTtcblxuICAgICAgcmV0dXJuIGBcbiAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IHdpZHRoLCBoZWlnaHQsIHBvc2l0aW9uOiBcInJlbGF0aXZlXCIsIG92ZXJmbG93OiBcImhpZGRlblwiIH0pfVwiPlxuICAgICAgICAgICR7YmcuaHRtbH1cbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgcG9zaXRpb246IFwicmVsYXRpdmVcIiwgd2lkdGg6IFwiMTAwJVwiLCBoZWlnaHQ6IFwiMTAwJVwiLCBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsIHRleHRBbGlnbjogXCJjZW50ZXJcIiwgZ2FwOiAxNiB9KX1cIj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogcih7IHBvcnRyYWl0OiA3MiwgZGVmYXVsdDogNjQgfSksIGZvbnRXZWlnaHQ6IDgwMCwgY29sb3I6IFwiI2ZmZlwiIH0pfVwiPiR7aG9vazFWaXNpYmxlfTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDcyLCBkZWZhdWx0OiA2NCB9KSwgZm9udFdlaWdodDogODAwLCBjb2xvcjogXCIjZmZmXCIgfSl9XCI+JHtob29rMlZpc2libGV9PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogMzIsIGRlZmF1bHQ6IDI4IH0pLCBmb250V2VpZ2h0OiA1MDAsIGNvbG9yOiBcInJnYmEoMjU1LDI1NSwyNTUsMC44KVwiLCBtYXJnaW5Ub3A6IDE2IH0pfVwiPiR7dGFnbGluZVZpc2libGV9PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICB9XG5cbiAgICAvLyA9PT0gRVZFTlRTIFBIQVNFID09PVxuICAgIGNvbnN0IGV2ZW50Q2FyZHMgPSBldmVudHMubWFwKChldmVudDogVGVjaGxhaG9tRXZlbnQsIGk6IG51bWJlcikgPT4ge1xuICAgICAgLy8gU3RhZ2dlciBldmVudHMgYWNyb3NzIHRoZSA5cyBwaGFzZVxuICAgICAgLy8gRWFjaCBjYXJkIGVudGVycyBvdmVyIDAuN3MsIGhvbGRzLCB0aGVuIGZhZGVzIG91dCAwLjVzIGJlZm9yZSB0aGUgbmV4dFxuICAgICAgLy8gY2FyZCdzIGJlYXQuIEV4aXQgd2luZG93cyBhcmUgYWJzb2x1dGUgc2NlbmUgZnJhY3Rpb25zICgxNXMgc2NlbmUsXG4gICAgICAvLyBldmVudHMgcGhhc2Ugc3RhcnRzIGF0IDJzKS5cbiAgICAgIGNvbnN0IGV4aXRTdGFydCA9ICgyICsgKGkgKyAxKSAqICgxIC8gZXZlbnRzLmxlbmd0aCkgKiAwLjkgKiA5KSAvIDE1O1xuICAgICAgY29uc3QgY2FyZEFuaW0gPSB0Lm1vdGlvbih7XG4gICAgICAgIGR1cmluZzogXCJldmVudHNcIixcbiAgICAgICAgYXQ6IGAkeygoaSAqICgxL2V2ZW50cy5sZW5ndGgpICogMC44KSAqIDEwMCkudG9GaXhlZCgxKX0lYCxcbiAgICAgICAgZm9yOiBgJHsoKDAuNy85KSAqIDEwMCkudG9GaXhlZCgxKX0lYCxcbiAgICAgICAgc2NhbGU6IDAuMDUsXG4gICAgICAgIHk6IDYwLFxuICAgICAgICBleGl0OiB7IHdpbmRvdzogW2V4aXRTdGFydCwgZXhpdFN0YXJ0ICsgMC41IC8gMTVdLCB5OiAwLCBzY2FsZTogMSB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKCFjYXJkQW5pbS52aXNpYmxlKSByZXR1cm4gXCJcIjtcblxuICAgICAgY29uc3QgY2FyZFdpZHRoID0gcih7IHBvcnRyYWl0OiBcIjg4JVwiLCBzcXVhcmU6IFwiODAlXCIsIGRlZmF1bHQ6IFwiNzAlXCIgfSk7XG4gICAgICBjb25zdCBkYXRlQmFkZ2VTaXplID0gcih7IHBvcnRyYWl0OiA4MCwgc3F1YXJlOiA2MCwgZGVmYXVsdDogNzAgfSk7XG5cbiAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsIHdpZHRoOiBjYXJkV2lkdGgsIG1heFdpZHRoOiA5MDAsIGJhY2tncm91bmQ6IFwicmdiYSgwLCAwLCAwLCAwLjg1KVwiLFxuICAgICAgICAgIGJvcmRlclJhZGl1czogMTYsIHBhZGRpbmc6IFwiMjRweCAyOHB4XCIsIGRpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBnYXA6IDIwLFxuICAgICAgICAgIGJveFNoYWRvdzogXCIwIDIwcHggNjBweCByZ2JhKDAsIDAsIDAsIDAuNSlcIiwgYm9yZGVyTGVmdDogYDRweCBzb2xpZCAke2V2ZW50LmNvbG9yfWAsXG4gICAgICAgIH0pfTske2NhcmRBbmltLnN0eWxlfVwiPlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3Moe1xuICAgICAgICAgICAgd2lkdGg6IGRhdGVCYWRnZVNpemUsIGhlaWdodDogZGF0ZUJhZGdlU2l6ZSwgYmFja2dyb3VuZDogZXZlbnQuY29sb3IsIGJvcmRlclJhZGl1czogMTIsXG4gICAgICAgICAgICBkaXNwbGF5OiBcImZsZXhcIiwgZmxleERpcmVjdGlvbjogXCJjb2x1bW5cIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIsIGZsZXhTaHJpbms6IDAsXG4gICAgICAgICAgfSl9XCI+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogMTQsIGRlZmF1bHQ6IDExIH0pLCBmb250V2VpZ2h0OiA3MDAsIGNvbG9yOiBcIiNmZmZcIiB9KX1cIj4ke2V2ZW50LmRheX08L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBmb250U2l6ZTogcih7IHBvcnRyYWl0OiAyOCwgZGVmYXVsdDogMjIgfSksIGZvbnRXZWlnaHQ6IDgwMCwgY29sb3I6IFwiI2ZmZlwiLCBsaW5lSGVpZ2h0OiAxIH0pfVwiPiR7ZXZlbnQuZGF0ZS5zcGxpdChcIiBcIilbMV19PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZsZXg6IDEsIGRpc3BsYXk6IFwiZmxleFwiLCBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLCBnYXA6IDYgfSl9XCI+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogMjgsIGRlZmF1bHQ6IDI0IH0pLCBmb250V2VpZ2h0OiA3MDAsIGNvbG9yOiBldmVudC5jb2xvciB9KX1cIj4ke2V2ZW50Lmdyb3VwfTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDM2LCBkZWZhdWx0OiAzMiB9KSwgZm9udFdlaWdodDogNjAwLCBjb2xvcjogXCIjZmZmXCIsIGxpbmVIZWlnaHQ6IDEuMiB9KX1cIj4ke2V2ZW50LnRpdGxlfTwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIiR7c3RkLmNzcyh7IGZvbnRTaXplOiByKHsgcG9ydHJhaXQ6IDI0LCBkZWZhdWx0OiAyMiB9KSwgZm9udFdlaWdodDogNDAwLCBjb2xvcjogXCJyZ2JhKDI1NSwyNTUsMjU1LDAuNylcIiB9KX1cIj4ke2V2ZW50LmxvY2F0aW9ufTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyBwYWRkaW5nOiBcIjhweCAxNnB4XCIsIGJhY2tncm91bmQ6IFwicmdiYSgyNTUsMjU1LDI1NSwwLjEpXCIsIGJvcmRlclJhZGl1czogOCwgZm9udFNpemU6IHIoeyBwb3J0cmFpdDogMjAsIGRlZmF1bHQ6IDE4IH0pLCBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiBcIiNmZmZcIiwgd2hpdGVTcGFjZTogXCJub3dyYXBcIiB9KX1cIj4ke2V2ZW50LnRpbWV9PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYDtcbiAgICB9KS5qb2luKFwiXCIpO1xuXG4gICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCIke3N0ZC5jc3MoeyB3aWR0aCwgaGVpZ2h0LCBwb3NpdGlvbjogXCJyZWxhdGl2ZVwiLCBvdmVyZmxvdzogXCJoaWRkZW5cIiB9KX1cIj5cbiAgICAgICAgJHtiZy5odG1sfVxuICAgICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgcG9zaXRpb246IFwicmVsYXRpdmVcIiwgd2lkdGg6IFwiMTAwJVwiLCBoZWlnaHQ6IFwiMTAwJVwiLCBkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwganVzdGlmeUNvbnRlbnQ6IFwiY2VudGVyXCIgfSl9XCI+XG4gICAgICAgICAgJHtldmVudENhcmRzfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gIH0sXG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixNQUFNLElBQUksTUFBTTtFQUNoQixNQUFNLGFBQWEsT0FBTyxNQUFNLFlBQVk7RUFDNUMsT0FBTztHQUNOO0dBQ0EsVUFBVSxDQUFDLENBQUMsS0FBSyxPQUFPLEVBQUUsUUFBUSxhQUFhLEVBQUUsWUFBWSxRQUFRO0dBQ3JFLFFBQVEsTUFBTTtHQUNkLEdBQUcsTUFBTSxXQUFXLEtBQUssSUFBSSxFQUFFLFFBQVEsTUFBTSxPQUFPLElBQUksQ0FBQztHQUN6RCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxhQUFhLEVBQUUsU0FBUyxNQUFNLFFBQVEsSUFBSSxDQUFDO0VBQy9DO0NBQ0Q7Ozs7Ozs7Ozs7Ozs7Ozs7bUJDN0JlLE9BQU87RUFDcEIsUUFBUTtHQUNOLE9BQU87R0FDUCxNQUFNO0dBQ04sV0FBVztHQUNYLFdBQVc7R0FDWCxTQUFTO0dBQ1QsS0FBSztHQUNMLFFBQVE7R0FDUixlQUFlO0dBQ2YsaUJBQWlCO0dBRWpCLFFBQVE7SUFDTjtLQUFFLE1BQU07S0FBUyxLQUFLO0tBQU8sTUFBTTtLQUFTLE9BQU87S0FBcUIsT0FBTztLQUFxQixVQUFVO0tBQXFCLE9BQU87SUFBVTtJQUNwSjtLQUFFLE1BQU07S0FBUyxLQUFLO0tBQU8sTUFBTTtL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