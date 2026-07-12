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
	//#region examples/vector/lottie-logo/lottie-logo.media.ts
	/**
	* Multi-shape logo mark (valid Bodymovin JSON):
	* rounded tile + three staggered bars + accent dot.
	* Driven by std.viz.lottie seek (progress 0→1).
	*/
	function kf1(t0, s0, t1, s1) {
		return [{
			t: t0,
			s: s0,
			i: {
				x: s0.map(() => .4),
				y: s0.map(() => 1)
			},
			o: {
				x: s0.map(() => .6),
				y: s0.map(() => 0)
			}
		}, {
			t: t1,
			s: s1
		}];
	}
	function shapeLayer(opts) {
		return {
			ddd: 0,
			ind: opts.ind,
			ty: 4,
			nm: opts.name,
			sr: 1,
			ks: {
				o: opts.opacity ? {
					a: 1,
					k: opts.opacity
				} : {
					a: 0,
					k: 100
				},
				r: opts.rotation ? {
					a: 1,
					k: opts.rotation
				} : {
					a: 0,
					k: 0
				},
				p: {
					a: 0,
					k: [
						opts.pos[0],
						opts.pos[1],
						0
					]
				},
				a: {
					a: 0,
					k: [
						0,
						0,
						0
					]
				},
				s: opts.scale ? {
					a: 1,
					k: opts.scale
				} : {
					a: 0,
					k: [
						100,
						100,
						100
					]
				}
			},
			ao: 0,
			shapes: opts.shapes,
			ip: opts.ip ?? 0,
			op: opts.op ?? 90,
			st: 0,
			bm: 0
		};
	}
	function rectGroup(name, w, h, color, corner = 16, localPos = [0, 0]) {
		return {
			ty: "gr",
			nm: name,
			it: [
				{
					ty: "rc",
					p: {
						a: 0,
						k: [0, 0]
					},
					s: {
						a: 0,
						k: [w, h]
					},
					r: {
						a: 0,
						k: corner
					},
					nm: "Rect"
				},
				{
					ty: "fl",
					c: {
						a: 0,
						k: [...color, 1]
					},
					o: {
						a: 0,
						k: 100
					},
					r: 1,
					nm: "Fill"
				},
				{
					ty: "tr",
					p: {
						a: 0,
						k: localPos
					},
					a: {
						a: 0,
						k: [0, 0]
					},
					s: {
						a: 0,
						k: [100, 100]
					},
					r: {
						a: 0,
						k: 0
					},
					o: {
						a: 0,
						k: 100
					},
					sk: {
						a: 0,
						k: 0
					},
					sa: {
						a: 0,
						k: 0
					},
					nm: "Transform"
				}
			]
		};
	}
	function ellipseGroup(name, size, color, localPos = [0, 0]) {
		return {
			ty: "gr",
			nm: name,
			it: [
				{
					ty: "el",
					p: {
						a: 0,
						k: [0, 0]
					},
					s: {
						a: 0,
						k: size
					},
					nm: "Ellipse"
				},
				{
					ty: "fl",
					c: {
						a: 0,
						k: [...color, 1]
					},
					o: {
						a: 0,
						k: 100
					},
					r: 1,
					nm: "Fill"
				},
				{
					ty: "tr",
					p: {
						a: 0,
						k: localPos
					},
					a: {
						a: 0,
						k: [0, 0]
					},
					s: {
						a: 0,
						k: [100, 100]
					},
					r: {
						a: 0,
						k: 0
					},
					o: {
						a: 0,
						k: 100
					},
					sk: {
						a: 0,
						k: 0
					},
					sa: {
						a: 0,
						k: 0
					},
					nm: "Transform"
				}
			]
		};
	}
	const BLUE = [
		.357,
		.549,
		1
	];
	const LOGO_LOTTIE = {
		v: "5.7.4",
		fr: 30,
		ip: 0,
		op: 90,
		w: 512,
		h: 512,
		nm: "superimg-logo-mark",
		ddd: 0,
		assets: [],
		layers: [
			shapeLayer({
				ind: 1,
				name: "Tile",
				pos: [256, 256],
				shapes: [rectGroup("tile", 280, 280, [
					.12,
					.16,
					.27
				], 48)],
				scale: kf1(0, [
					0,
					0,
					100
				], 18, [
					100,
					100,
					100
				]),
				opacity: kf1(0, [0], 12, [100])
			}),
			shapeLayer({
				ind: 2,
				name: "BarTop",
				pos: [256, 200],
				shapes: [rectGroup("bar", 160, 28, BLUE, 14)],
				scale: kf1(10, [
					0,
					100,
					100
				], 32, [
					100,
					100,
					100
				]),
				opacity: kf1(10, [0], 18, [100])
			}),
			shapeLayer({
				ind: 3,
				name: "BarMid",
				pos: [256, 256],
				shapes: [rectGroup("bar", 200, 28, [
					.31,
					.82,
					.77
				], 14)],
				scale: kf1(18, [
					0,
					100,
					100
				], 42, [
					100,
					100,
					100
				]),
				opacity: kf1(18, [0], 26, [100])
			}),
			shapeLayer({
				ind: 4,
				name: "BarBot",
				pos: [256, 312],
				shapes: [rectGroup("bar", 120, 28, [
					.94,
					.58,
					.98
				], 14)],
				scale: kf1(26, [
					0,
					100,
					100
				], 52, [
					100,
					100,
					100
				]),
				opacity: kf1(26, [0], 34, [100])
			}),
			shapeLayer({
				ind: 5,
				name: "Dot",
				pos: [340, 200],
				shapes: [ellipseGroup("dot", [36, 36], [
					.94,
					.96,
					1
				])],
				scale: kf1(40, [
					0,
					0,
					100
				], 58, [
					100,
					100,
					100
				]),
				opacity: kf1(40, [0], 48, [100])
			}),
			shapeLayer({
				ind: 6,
				name: "Ring",
				pos: [256, 256],
				shapes: [{
					ty: "gr",
					nm: "ring",
					it: [
						{
							ty: "el",
							p: {
								a: 0,
								k: [0, 0]
							},
							s: {
								a: 0,
								k: [340, 340]
							},
							nm: "Ellipse"
						},
						{
							ty: "st",
							c: {
								a: 0,
								k: [...BLUE, 1]
							},
							o: {
								a: 0,
								k: 40
							},
							w: {
								a: 0,
								k: 3
							},
							lc: 2,
							lj: 2,
							nm: "Stroke"
						},
						{
							ty: "tr",
							p: {
								a: 0,
								k: [0, 0]
							},
							a: {
								a: 0,
								k: [0, 0]
							},
							s: {
								a: 0,
								k: [100, 100]
							},
							r: {
								a: 0,
								k: 0
							},
							o: {
								a: 0,
								k: 100
							},
							sk: {
								a: 0,
								k: 0
							},
							sa: {
								a: 0,
								k: 0
							},
							nm: "Transform"
						}
					]
				}],
				scale: kf1(48, [
					70,
					70,
					100
				], 75, [
					100,
					100,
					100
				]),
				opacity: [
					{
						t: 48,
						s: [0],
						i: {
							x: [.5],
							y: [1]
						},
						o: {
							x: [.5],
							y: [0]
						}
					},
					{
						t: 62,
						s: [80],
						i: {
							x: [.5],
							y: [1]
						},
						o: {
							x: [.5],
							y: [0]
						}
					},
					{
						t: 90,
						s: [40]
					}
				]
			})
		]
	};
	//#endregion
	exports.default = define({
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "4s",
			fonts: ["Inter:wght@400;600;700"]
		},
		render(ctx) {
			const { std, width, height, timeline } = ctx;
			const t = ctx.director({
				enter: "85%",
				hold: "15%"
			});
			const progress = t.in("enter") < 1 ? t.in("enter") : 1;
			return `
<div style="position:relative;width:${width}px;height:${height}px;background:#06060f;display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif">
  <div style="position:absolute;top:72px;left:0;right:0;text-align:center;color:#f0f4ff;pointer-events:none">
    <div style="font-size:22px;font-weight:600;letter-spacing:6px;color:#5b8cff">LOTTIE</div>
    <div style="font-size:40px;font-weight:700;margin-top:8px">Logo mark reveal</div>
  </div>
  ${std.viz.lottie({
				animationData: LOGO_LOTTIE,
				progress,
				width: 560,
				height: 560,
				player: "light",
				background: "transparent"
			})}
  <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;color:#6b7795;font-size:18px;opacity:${t.in("hold").toFixed(3)}">
    tile + staggered bars + accent · seek ${progress.toFixed(2)} · ${timeline.seconds.toFixed(2)}s
  </div>
</div>`;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG90dGllLWxvZ28ubWVkaWEuanMiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvc3VwZXJpbWctdHlwZXMvZGlzdC9pbmRleC5qcyIsIi4uL2V4YW1wbGVzL3ZlY3Rvci9sb3R0aWUtbG9nby9sb3R0aWUtbG9nby5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsImltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG4vKipcbiAqIE11bHRpLXNoYXBlIGxvZ28gbWFyayAodmFsaWQgQm9keW1vdmluIEpTT04pOlxuICogcm91bmRlZCB0aWxlICsgdGhyZWUgc3RhZ2dlcmVkIGJhcnMgKyBhY2NlbnQgZG90LlxuICogRHJpdmVuIGJ5IHN0ZC52aXoubG90dGllIHNlZWsgKHByb2dyZXNzIDDihpIxKS5cbiAqL1xuZnVuY3Rpb24ga2YxKFxuICB0MDogbnVtYmVyLFxuICBzMDogbnVtYmVyW10sXG4gIHQxOiBudW1iZXIsXG4gIHMxOiBudW1iZXJbXSxcbik6IG9iamVjdFtdIHtcbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICB0OiB0MCxcbiAgICAgIHM6IHMwLFxuICAgICAgaTogeyB4OiBzMC5tYXAoKCkgPT4gMC40KSwgeTogczAubWFwKCgpID0+IDEpIH0sXG4gICAgICBvOiB7IHg6IHMwLm1hcCgoKSA9PiAwLjYpLCB5OiBzMC5tYXAoKCkgPT4gMCkgfSxcbiAgICB9LFxuICAgIHsgdDogdDEsIHM6IHMxIH0sXG4gIF07XG59XG5cbmZ1bmN0aW9uIHNoYXBlTGF5ZXIob3B0czoge1xuICBpbmQ6IG51bWJlcjtcbiAgbmFtZTogc3RyaW5nO1xuICAvKiogbGF5ZXIgcG9zaXRpb24gKi9cbiAgcG9zOiBbbnVtYmVyLCBudW1iZXJdO1xuICAvKiogc2hhcGVzIGluIGxvY2FsIHNwYWNlICovXG4gIHNoYXBlczogb2JqZWN0W107XG4gIC8qKiBzY2FsZSBrZXlmcmFtZXMgW3N4LHN5LHN6XSAqL1xuICBzY2FsZT86IG9iamVjdFtdO1xuICAvKiogb3BhY2l0eSBrZXlmcmFtZXMgW29dICovXG4gIG9wYWNpdHk/OiBvYmplY3RbXTtcbiAgLyoqIHJvdGF0aW9uIGtleWZyYW1lcyBbZGVnXSAqL1xuICByb3RhdGlvbj86IG9iamVjdFtdO1xuICBpcD86IG51bWJlcjtcbiAgb3A/OiBudW1iZXI7XG59KTogb2JqZWN0IHtcbiAgcmV0dXJuIHtcbiAgICBkZGQ6IDAsXG4gICAgaW5kOiBvcHRzLmluZCxcbiAgICB0eTogNCxcbiAgICBubTogb3B0cy5uYW1lLFxuICAgIHNyOiAxLFxuICAgIGtzOiB7XG4gICAgICBvOiBvcHRzLm9wYWNpdHlcbiAgICAgICAgPyB7IGE6IDEsIGs6IG9wdHMub3BhY2l0eSB9XG4gICAgICAgIDogeyBhOiAwLCBrOiAxMDAgfSxcbiAgICAgIHI6IG9wdHMucm90YXRpb25cbiAgICAgICAgPyB7IGE6IDEsIGs6IG9wdHMucm90YXRpb24gfVxuICAgICAgICA6IHsgYTogMCwgazogMCB9LFxuICAgICAgcDogeyBhOiAwLCBrOiBbb3B0cy5wb3NbMF0sIG9wdHMucG9zWzFdLCAwXSB9LFxuICAgICAgYTogeyBhOiAwLCBrOiBbMCwgMCwgMF0gfSxcbiAgICAgIHM6IG9wdHMuc2NhbGVcbiAgICAgICAgPyB7IGE6IDEsIGs6IG9wdHMuc2NhbGUgfVxuICAgICAgICA6IHsgYTogMCwgazogWzEwMCwgMTAwLCAxMDBdIH0sXG4gICAgfSxcbiAgICBhbzogMCxcbiAgICBzaGFwZXM6IG9wdHMuc2hhcGVzLFxuICAgIGlwOiBvcHRzLmlwID8/IDAsXG4gICAgb3A6IG9wdHMub3AgPz8gOTAsXG4gICAgc3Q6IDAsXG4gICAgYm06IDAsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlY3RHcm91cChcbiAgbmFtZTogc3RyaW5nLFxuICB3OiBudW1iZXIsXG4gIGg6IG51bWJlcixcbiAgY29sb3I6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSxcbiAgY29ybmVyID0gMTYsXG4gIGxvY2FsUG9zOiBbbnVtYmVyLCBudW1iZXJdID0gWzAsIDBdLFxuKTogb2JqZWN0IHtcbiAgcmV0dXJuIHtcbiAgICB0eTogXCJnclwiLFxuICAgIG5tOiBuYW1lLFxuICAgIGl0OiBbXG4gICAgICB7XG4gICAgICAgIHR5OiBcInJjXCIsXG4gICAgICAgIHA6IHsgYTogMCwgazogWzAsIDBdIH0sXG4gICAgICAgIHM6IHsgYTogMCwgazogW3csIGhdIH0sXG4gICAgICAgIHI6IHsgYTogMCwgazogY29ybmVyIH0sXG4gICAgICAgIG5tOiBcIlJlY3RcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5OiBcImZsXCIsXG4gICAgICAgIGM6IHsgYTogMCwgazogWy4uLmNvbG9yLCAxXSB9LFxuICAgICAgICBvOiB7IGE6IDAsIGs6IDEwMCB9LFxuICAgICAgICByOiAxLFxuICAgICAgICBubTogXCJGaWxsXCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eTogXCJ0clwiLFxuICAgICAgICBwOiB7IGE6IDAsIGs6IGxvY2FsUG9zIH0sXG4gICAgICAgIGE6IHsgYTogMCwgazogWzAsIDBdIH0sXG4gICAgICAgIHM6IHsgYTogMCwgazogWzEwMCwgMTAwXSB9LFxuICAgICAgICByOiB7IGE6IDAsIGs6IDAgfSxcbiAgICAgICAgbzogeyBhOiAwLCBrOiAxMDAgfSxcbiAgICAgICAgc2s6IHsgYTogMCwgazogMCB9LFxuICAgICAgICBzYTogeyBhOiAwLCBrOiAwIH0sXG4gICAgICAgIG5tOiBcIlRyYW5zZm9ybVwiLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xufVxuXG5mdW5jdGlvbiBlbGxpcHNlR3JvdXAoXG4gIG5hbWU6IHN0cmluZyxcbiAgc2l6ZTogW251bWJlciwgbnVtYmVyXSxcbiAgY29sb3I6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSxcbiAgbG9jYWxQb3M6IFtudW1iZXIsIG51bWJlcl0gPSBbMCwgMF0sXG4pOiBvYmplY3Qge1xuICByZXR1cm4ge1xuICAgIHR5OiBcImdyXCIsXG4gICAgbm06IG5hbWUsXG4gICAgaXQ6IFtcbiAgICAgIHtcbiAgICAgICAgdHk6IFwiZWxcIixcbiAgICAgICAgcDogeyBhOiAwLCBrOiBbMCwgMF0gfSxcbiAgICAgICAgczogeyBhOiAwLCBrOiBzaXplIH0sXG4gICAgICAgIG5tOiBcIkVsbGlwc2VcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5OiBcImZsXCIsXG4gICAgICAgIGM6IHsgYTogMCwgazogWy4uLmNvbG9yLCAxXSB9LFxuICAgICAgICBvOiB7IGE6IDAsIGs6IDEwMCB9LFxuICAgICAgICByOiAxLFxuICAgICAgICBubTogXCJGaWxsXCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eTogXCJ0clwiLFxuICAgICAgICBwOiB7IGE6IDAsIGs6IGxvY2FsUG9zIH0sXG4gICAgICAgIGE6IHsgYTogMCwgazogWzAsIDBdIH0sXG4gICAgICAgIHM6IHsgYTogMCwgazogWzEwMCwgMTAwXSB9LFxuICAgICAgICByOiB7IGE6IDAsIGs6IDAgfSxcbiAgICAgICAgbzogeyBhOiAwLCBrOiAxMDAgfSxcbiAgICAgICAgc2s6IHsgYTogMCwgazogMCB9LFxuICAgICAgICBzYTogeyBhOiAwLCBrOiAwIH0sXG4gICAgICAgIG5tOiBcIlRyYW5zZm9ybVwiLFxuICAgICAgfSxcbiAgICBdLFxuICB9O1xufVxuXG5jb25zdCBCTFVFOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl0gPSBbMC4zNTcsIDAuNTQ5LCAxXTtcbmNvbnN0IENZQU46IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSA9IFswLjMxLCAwLjgyLCAwLjc3XTtcbmNvbnN0IFBJTks6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSA9IFswLjk0LCAwLjU4LCAwLjk4XTtcbmNvbnN0IFRJTEU6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSA9IFswLjEyLCAwLjE2LCAwLjI3XTtcbmNvbnN0IFdISVRFOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl0gPSBbMC45NCwgMC45NiwgMV07XG5cbmNvbnN0IExPR09fTE9UVElFID0ge1xuICB2OiBcIjUuNy40XCIsXG4gIGZyOiAzMCxcbiAgaXA6IDAsXG4gIG9wOiA5MCxcbiAgdzogNTEyLFxuICBoOiA1MTIsXG4gIG5tOiBcInN1cGVyaW1nLWxvZ28tbWFya1wiLFxuICBkZGQ6IDAsXG4gIGFzc2V0czogW10sXG4gIGxheWVyczogW1xuICAgIC8vIDEpIERhcmsgcm91bmRlZCB0aWxlIChwb3BzIGluKVxuICAgIHNoYXBlTGF5ZXIoe1xuICAgICAgaW5kOiAxLFxuICAgICAgbmFtZTogXCJUaWxlXCIsXG4gICAgICBwb3M6IFsyNTYsIDI1Nl0sXG4gICAgICBzaGFwZXM6IFtyZWN0R3JvdXAoXCJ0aWxlXCIsIDI4MCwgMjgwLCBUSUxFLCA0OCldLFxuICAgICAgc2NhbGU6IGtmMSgwLCBbMCwgMCwgMTAwXSwgMTgsIFsxMDAsIDEwMCwgMTAwXSksXG4gICAgICBvcGFjaXR5OiBrZjEoMCwgWzBdLCAxMiwgWzEwMF0pLFxuICAgIH0pLFxuICAgIC8vIDIpIFRvcCBiYXIgKGdyb3dzIGZyb20gbGVmdClcbiAgICBzaGFwZUxheWVyKHtcbiAgICAgIGluZDogMixcbiAgICAgIG5hbWU6IFwiQmFyVG9wXCIsXG4gICAgICBwb3M6IFsyNTYsIDIwMF0sXG4gICAgICBzaGFwZXM6IFtyZWN0R3JvdXAoXCJiYXJcIiwgMTYwLCAyOCwgQkxVRSwgMTQpXSxcbiAgICAgIHNjYWxlOiBrZjEoMTAsIFswLCAxMDAsIDEwMF0sIDMyLCBbMTAwLCAxMDAsIDEwMF0pLFxuICAgICAgb3BhY2l0eToga2YxKDEwLCBbMF0sIDE4LCBbMTAwXSksXG4gICAgfSksXG4gICAgLy8gMykgTWlkZGxlIGJhciAod2lkZXIsIHN0YWdnZXJlZClcbiAgICBzaGFwZUxheWVyKHtcbiAgICAgIGluZDogMyxcbiAgICAgIG5hbWU6IFwiQmFyTWlkXCIsXG4gICAgICBwb3M6IFsyNTYsIDI1Nl0sXG4gICAgICBzaGFwZXM6IFtyZWN0R3JvdXAoXCJiYXJcIiwgMjAwLCAyOCwgQ1lBTiwgMTQpXSxcbiAgICAgIHNjYWxlOiBrZjEoMTgsIFswLCAxMDAsIDEwMF0sIDQyLCBbMTAwLCAxMDAsIDEwMF0pLFxuICAgICAgb3BhY2l0eToga2YxKDE4LCBbMF0sIDI2LCBbMTAwXSksXG4gICAgfSksXG4gICAgLy8gNCkgQm90dG9tIGJhclxuICAgIHNoYXBlTGF5ZXIoe1xuICAgICAgaW5kOiA0LFxuICAgICAgbmFtZTogXCJCYXJCb3RcIixcbiAgICAgIHBvczogWzI1NiwgMzEyXSxcbiAgICAgIHNoYXBlczogW3JlY3RHcm91cChcImJhclwiLCAxMjAsIDI4LCBQSU5LLCAxNCldLFxuICAgICAgc2NhbGU6IGtmMSgyNiwgWzAsIDEwMCwgMTAwXSwgNTIsIFsxMDAsIDEwMCwgMTAwXSksXG4gICAgICBvcGFjaXR5OiBrZjEoMjYsIFswXSwgMzQsIFsxMDBdKSxcbiAgICB9KSxcbiAgICAvLyA1KSBBY2NlbnQgZG90IChwb3BzIGxhdGUpXG4gICAgc2hhcGVMYXllcih7XG4gICAgICBpbmQ6IDUsXG4gICAgICBuYW1lOiBcIkRvdFwiLFxuICAgICAgcG9zOiBbMzQwLCAyMDBdLFxuICAgICAgc2hhcGVzOiBbZWxsaXBzZUdyb3VwKFwiZG90XCIsIFszNiwgMzZdLCBXSElURSldLFxuICAgICAgc2NhbGU6IGtmMSg0MCwgWzAsIDAsIDEwMF0sIDU4LCBbMTAwLCAxMDAsIDEwMF0pLFxuICAgICAgb3BhY2l0eToga2YxKDQwLCBbMF0sIDQ4LCBbMTAwXSksXG4gICAgfSksXG4gICAgLy8gNikgU29mdCBvdXRlciByaW5nIChvcHRpb25hbCBwdWxzZSBhdCBlbmQpXG4gICAgc2hhcGVMYXllcih7XG4gICAgICBpbmQ6IDYsXG4gICAgICBuYW1lOiBcIlJpbmdcIixcbiAgICAgIHBvczogWzI1NiwgMjU2XSxcbiAgICAgIHNoYXBlczogW1xuICAgICAgICB7XG4gICAgICAgICAgdHk6IFwiZ3JcIixcbiAgICAgICAgICBubTogXCJyaW5nXCIsXG4gICAgICAgICAgaXQ6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgdHk6IFwiZWxcIixcbiAgICAgICAgICAgICAgcDogeyBhOiAwLCBrOiBbMCwgMF0gfSxcbiAgICAgICAgICAgICAgczogeyBhOiAwLCBrOiBbMzQwLCAzNDBdIH0sXG4gICAgICAgICAgICAgIG5tOiBcIkVsbGlwc2VcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHR5OiBcInN0XCIsXG4gICAgICAgICAgICAgIGM6IHsgYTogMCwgazogWy4uLkJMVUUsIDFdIH0sXG4gICAgICAgICAgICAgIG86IHsgYTogMCwgazogNDAgfSxcbiAgICAgICAgICAgICAgdzogeyBhOiAwLCBrOiAzIH0sXG4gICAgICAgICAgICAgIGxjOiAyLFxuICAgICAgICAgICAgICBsajogMixcbiAgICAgICAgICAgICAgbm06IFwiU3Ryb2tlXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0eTogXCJ0clwiLFxuICAgICAgICAgICAgICBwOiB7IGE6IDAsIGs6IFswLCAwXSB9LFxuICAgICAgICAgICAgICBhOiB7IGE6IDAsIGs6IFswLCAwXSB9LFxuICAgICAgICAgICAgICBzOiB7IGE6IDAsIGs6IFsxMDAsIDEwMF0gfSxcbiAgICAgICAgICAgICAgcjogeyBhOiAwLCBrOiAwIH0sXG4gICAgICAgICAgICAgIG86IHsgYTogMCwgazogMTAwIH0sXG4gICAgICAgICAgICAgIHNrOiB7IGE6IDAsIGs6IDAgfSxcbiAgICAgICAgICAgICAgc2E6IHsgYTogMCwgazogMCB9LFxuICAgICAgICAgICAgICBubTogXCJUcmFuc2Zvcm1cIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBzY2FsZToga2YxKDQ4LCBbNzAsIDcwLCAxMDBdLCA3NSwgWzEwMCwgMTAwLCAxMDBdKSxcbiAgICAgIG9wYWNpdHk6IFtcbiAgICAgICAge1xuICAgICAgICAgIHQ6IDQ4LFxuICAgICAgICAgIHM6IFswXSxcbiAgICAgICAgICBpOiB7IHg6IFswLjVdLCB5OiBbMV0gfSxcbiAgICAgICAgICBvOiB7IHg6IFswLjVdLCB5OiBbMF0gfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHQ6IDYyLFxuICAgICAgICAgIHM6IFs4MF0sXG4gICAgICAgICAgaTogeyB4OiBbMC41XSwgeTogWzFdIH0sXG4gICAgICAgICAgbzogeyB4OiBbMC41XSwgeTogWzBdIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHsgdDogOTAsIHM6IFs0MF0gfSxcbiAgICAgIF0sXG4gICAgfSksXG4gIF0sXG59O1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBjb25maWc6IHtcbiAgICB3aWR0aDogMTkyMCxcbiAgICBoZWlnaHQ6IDEwODAsXG4gICAgZnBzOiAzMCxcbiAgICBkdXJhdGlvbjogXCI0c1wiLFxuICAgIGZvbnRzOiBbXCJJbnRlcjp3Z2h0QDQwMDs2MDA7NzAwXCJdLFxuICB9LFxuICByZW5kZXIoY3R4KSB7XG4gICAgY29uc3QgeyBzdGQsIHdpZHRoLCBoZWlnaHQsIHRpbWVsaW5lIH0gPSBjdHg7XG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3Rvcih7IGVudGVyOiBcIjg1JVwiLCBob2xkOiBcIjE1JVwiIH0pO1xuICAgIC8vIFNjcnViIHRoZSB3aG9sZSBtYXJrIG9uIGVudGVyLCBmcmVlemUgZmluYWwgcG9zZSBvbiBob2xkXG4gICAgY29uc3QgcHJvZ3Jlc3MgPSB0LmluKFwiZW50ZXJcIikgPCAxID8gdC5pbihcImVudGVyXCIpIDogMTtcblxuICAgIGNvbnN0IGxvZ28gPSBzdGQudml6LmxvdHRpZSh7XG4gICAgICBhbmltYXRpb25EYXRhOiBMT0dPX0xPVFRJRSxcbiAgICAgIHByb2dyZXNzLFxuICAgICAgd2lkdGg6IDU2MCxcbiAgICAgIGhlaWdodDogNTYwLFxuICAgICAgcGxheWVyOiBcImxpZ2h0XCIsXG4gICAgICBiYWNrZ3JvdW5kOiBcInRyYW5zcGFyZW50XCIsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYFxuPGRpdiBzdHlsZT1cInBvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOiR7d2lkdGh9cHg7aGVpZ2h0OiR7aGVpZ2h0fXB4O2JhY2tncm91bmQ6IzA2MDYwZjtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1mYW1pbHk6SW50ZXIsc3lzdGVtLXVpLHNhbnMtc2VyaWZcIj5cbiAgPGRpdiBzdHlsZT1cInBvc2l0aW9uOmFic29sdXRlO3RvcDo3MnB4O2xlZnQ6MDtyaWdodDowO3RleHQtYWxpZ246Y2VudGVyO2NvbG9yOiNmMGY0ZmY7cG9pbnRlci1ldmVudHM6bm9uZVwiPlxuICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6MjJweDtmb250LXdlaWdodDo2MDA7bGV0dGVyLXNwYWNpbmc6NnB4O2NvbG9yOiM1YjhjZmZcIj5MT1RUSUU8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOjQwcHg7Zm9udC13ZWlnaHQ6NzAwO21hcmdpbi10b3A6OHB4XCI+TG9nbyBtYXJrIHJldmVhbDwvZGl2PlxuICA8L2Rpdj5cbiAgJHtsb2dvfVxuICA8ZGl2IHN0eWxlPVwicG9zaXRpb246YWJzb2x1dGU7Ym90dG9tOjQ4cHg7bGVmdDowO3JpZ2h0OjA7dGV4dC1hbGlnbjpjZW50ZXI7Y29sb3I6IzZiNzc5NTtmb250LXNpemU6MThweDtvcGFjaXR5OiR7dC5pbihcImhvbGRcIikudG9GaXhlZCgzKX1cIj5cbiAgICB0aWxlICsgc3RhZ2dlcmVkIGJhcnMgKyBhY2NlbnQgwrcgc2VlayAke3Byb2dyZXNzLnRvRml4ZWQoMil9IMK3ICR7dGltZWxpbmUuc2Vjb25kcy50b0ZpeGVkKDIpfXNcbiAgPC9kaXY+XG48L2Rpdj5gO1xuICB9LFxufSk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBNkJBLFNBQVMsT0FBTyxPQUFPO0VBQ3RCLE1BQU0sU0FBUyxNQUFNLFVBQVU7RUFDL0IsTUFBTSxJQUFJLE1BQU07RUFDaEIsTUFBTSxhQUFhLE9BQU8sTUFBTSxZQUFZO0VBQzVDLE9BQU87R0FDTjtHQUNBLFVBQVUsQ0FBQyxDQUFDLEtBQUssT0FBTyxFQUFFLFFBQVEsYUFBYSxFQUFFLFlBQVksUUFBUTtHQUNyRSxRQUFRLE1BQU07R0FDZCxHQUFHLE1BQU0sV0FBVyxLQUFLLElBQUksRUFBRSxRQUFRLE1BQU0sT0FBTyxJQUFJLENBQUM7R0FDekQsR0FBRyxNQUFNLFdBQVcsS0FBSyxJQUFJLEVBQUUsUUFBUSxNQUFNLE9BQU8sSUFBSSxDQUFDO0dBQ3pELEdBQUcsYUFBYSxFQUFFLFNBQVMsTUFBTSxRQUFRLElBQUksQ0FBQztFQUMvQztDQUNEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NDbENBLFNBQVMsSUFDUCxJQUNBLElBQ0EsSUFDQSxJQUNVO0VBQ1YsT0FBTyxDQUNMO0dBQ0UsR0FBRztHQUNILEdBQUc7R0FDSCxHQUFHO0lBQUUsR0FBRyxHQUFHLFVBQVUsRUFBRztJQUFHLEdBQUcsR0FBRyxVQUFVLENBQUM7R0FBRTtHQUM5QyxHQUFHO0lBQUUsR0FBRyxHQUFHLFVBQVUsRUFBRztJQUFHLEdBQUcsR0FBRyxVQUFVLENBQUM7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