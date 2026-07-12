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
			ink: "#2b2b2b",
			paper: "#ffffff",
			panel: "#3f3f3f",
			fillGray: "#e2e2e4",
			lemonade: "#f5ef9e",
			money: "#b9ac3f"
		},
		config: {
			width: 1920,
			height: 1080,
			fps: 30,
			duration: "9s",
			inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #ffffff; overflow: hidden; font-family: system-ui, sans-serif; }
    `]
		},
		render(ctx) {
			const { std, width, height, data } = ctx;
			const { ink, paper, panel, fillGray, lemonade, money } = data;
			const t = ctx.director({
				labels: "0.8s",
				left: "2.4s",
				right: "2.4s",
				stamp: "0.8s",
				payoff: "0.8s",
				hold: "1.8s"
			});
			const zig = (x1, x2, y, amp, teeth) => {
				const step = (x2 - x1) / teeth;
				let d = `M ${x1} ${y}`;
				for (let i = 0; i < teeth; i++) d += ` L ${x1 + step * (i + .5)} ${y + amp} L ${x1 + step * (i + 1)} ${y}`;
				return d;
			};
			const rotRect = (cx, cy, w, h, deg) => {
				const r = deg * Math.PI / 180;
				const cos = Math.cos(r), sin = Math.sin(r);
				const pts = [
					[-w / 2, -h / 2],
					[w / 2, -h / 2],
					[w / 2, h / 2],
					[-w / 2, h / 2]
				].map(([x, y]) => `${cx + x * cos - y * sin} ${cy + x * sin + y * cos}`);
				return `M ${pts[0]} L ${pts[1]} L ${pts[2]} L ${pts[3]} Z`;
			};
			const LEFT = [
				{
					d: "M 318 332 L 318 292 L 342 292 L 342 276 L 476 276 L 476 292 L 500 292 L 500 332",
					fill: fillGray
				},
				{
					d: rotRect(409, 303, 132, 30, -2),
					fill: paper
				},
				{
					d: "M 302 332 L 516 332 L 552 386 L 266 386 Z",
					fill: fillGray
				},
				{
					d: zig(266, 552, 386, 13, 13),
					w: 2.5
				},
				{
					d: "M 288 386 L 288 606 L 534 606 L 534 386",
					fill: fillGray
				},
				{
					d: "M 288 606 L 316 616 L 316 398",
					w: 2
				},
				{
					d: "M 316 616 L 540 616 L 534 606",
					w: 2
				},
				{ d: rotRect(438, 438, 176, 66, -1.5) },
				{
					d: rotRect(408, 505, 296, 74, -14),
					fill: paper,
					w: 3
				}
			];
			const plankXs = Array.from({ length: 8 }, (_, i) => 742 + i * 30);
			const RIGHT = [
				{
					d: rotRect(742, 448, 18, 260, 1),
					fill: fillGray
				},
				{
					d: rotRect(952, 462, 18, 290, -1),
					fill: fillGray
				},
				{
					d: rotRect(850, 366, 300, 24, -1.2),
					fill: fillGray
				},
				{
					d: rotRect(852, 398, 296, 22, .8),
					fill: fillGray
				},
				{
					d: rotRect(858, 380, 150, 42, -2),
					fill: paper,
					w: 3
				},
				{
					d: "M 706 482 L 1000 478 L 1010 492 L 716 497 Z",
					fill: fillGray
				},
				{
					d: "M 722 497 L 722 594 L 976 590 L 976 494",
					fill: fillGray
				},
				...plankXs.map((x) => ({
					d: `M ${x} 497 L ${x} 592`,
					w: 2
				})),
				{
					d: "M 838 476 Q 830 456 836 440 L 832 432 L 864 432 L 860 440 Q 866 456 858 476 Q 848 480 838 476 Z",
					fill: paper,
					w: 2.5
				},
				{
					d: "M 862 442 Q 874 450 862 464",
					w: 2.5
				},
				{
					d: "M 748 592 Q 728 588 730 570 Q 724 556 740 550 L 750 546 Q 746 538 754 536 L 766 536 Q 774 538 770 546 L 780 552 Q 794 558 786 572 Q 792 588 772 592 Q 760 596 748 592 Z",
					fill: fillGray,
					w: 2.5
				},
				{
					d: "M 786 594 Q 770 590 774 574 Q 770 562 784 558 L 792 554 Q 790 548 796 546 L 806 546 Q 812 548 810 554 L 818 560 Q 828 566 822 578 Q 826 590 810 594 Q 798 598 786 594 Z",
					fill: fillGray,
					w: 2.5
				},
				{
					d: "M 750 544 Q 758 548 768 544 M 792 552 Q 799 556 808 552",
					w: 2
				}
			];
			const drawGroup = (paths, progress, fillOpacity) => std.stagger.ms(paths, progress, {
				windowSeconds: 2,
				eachMs: 45,
				capMs: 500
			}).filter(({ progress: p }) => p > 0).map(({ item, progress: p }) => {
				const draw = std.svg.draw(item.d, p);
				const fill = item.fill ? `fill="${item.fill}" fill-opacity="${(fillOpacity * p).toFixed(3)}"` : `fill="none"`;
				return `<path d="${item.d}" ${fill}
            stroke="${ink}" stroke-width="${item.w ?? 3}"
            stroke-linecap="round" stroke-linejoin="round"
            stroke-dasharray="${draw.strokeDasharray}"
            stroke-dashoffset="${draw.strokeDashoffset}" />`;
			}).join("\n");
			const leftP = t.in("left");
			const rightP = t.in("right");
			const stampP = t.in("stamp");
			const payoffP = t.in("payoff");
			const leftFill = std.interpolate(leftP, [.75, 1], [0, 1]);
			const rightFill = std.interpolate(rightP, [.75, 1], [0, 1]);
			const bestLemOp = std.interpolate(leftP, [.82, .96], [0, 1], "easeOutCubic");
			const lemonadeOp = std.interpolate(rightP, [.82, .96], [0, 1], "easeOutCubic");
			const stampScale = std.interpolate(stampP, [0, 1], [1.3, 1], "easeOutCubic");
			const stampOp = std.interpolate(stampP, [0, .45], [0, 1]);
			const pourP = std.interpolate(payoffP, [0, .6], [0, 1], "easeOutCubic");
			const d1 = std.interpolate(payoffP, [.15, .75], [0, 1], "easeOutBack");
			const d2 = std.interpolate(payoffP, [.3, .9], [0, 1], "easeOutBack");
			const lemonadeFill = `
      <clipPath id="pour"><rect x="828" y="${476 - 32 * pourP}" width="40" height="36" /></clipPath>
      <path d="M 840 472 Q 834 458 838 448 L 858 448 Q 862 458 856 472 Q 848 475 840 472 Z"
            fill="${lemonade}" clip-path="url(#pour)" />
      <g transform="translate(759 570) scale(${Math.max(0, d1)})" opacity="${std.clamp01(d1)}">
        <text y="8" font-size="24" font-weight="700" fill="${money}" text-anchor="middle">$</text>
      </g>
      <g transform="translate(798 575) scale(${Math.max(0, d2)})" opacity="${std.clamp01(d2) * .85}">
        <text y="7" font-size="20" font-weight="700" fill="${money}" text-anchor="middle">$</text>
      </g>
    `;
			const lettering = `
      <text x="409" y="309" transform="rotate(-2 409 303)" text-anchor="middle"
            font-size="15" font-weight="800" letter-spacing="1.5" fill="${ink}"
            opacity="${bestLemOp}">BEST LEMONADE</text>
      <text x="408" y="514" text-anchor="middle"
            transform="rotate(-14 408 505) translate(408 505) scale(${stampScale}) translate(-408 -505)"
            font-size="28" font-weight="600" letter-spacing="4" fill="${ink}"
            font-family="Georgia, serif" opacity="${stampOp}">COMING SOON</text>
      <text x="858" y="389" transform="rotate(-2 858 380)" text-anchor="middle"
            font-size="24" letter-spacing="2" fill="${ink}"
            font-family="'Comic Sans MS', 'Segoe Print', cursive"
            opacity="${lemonadeOp}">LEMONADE</text>
    `;
			const labelPs = std.stagger.ms(2, t.in("labels"), {
				windowSeconds: .8,
				eachMs: 80,
				capMs: 200
			});
			const label = (x, w, text, p) => {
				return `
        <g opacity="${p}" transform="translate(0 ${std.interpolate(p, [0, 1], [16, 0])})">
          <rect x="${x}" y="96" width="${w}" height="64" fill="${panel}" />
          <text x="${x + w / 2}" y="139" text-anchor="middle" font-size="30"
                font-weight="800" letter-spacing="7" fill="${paper}">${text}</text>
        </g>
      `;
			};
			return `
      <div style="${std.css({
				width,
				height,
				background: paper
			})}; ${std.css.center()}">
        <svg width="${width}" height="${height}" viewBox="0 0 1200 675"
             xmlns="http://www.w3.org/2000/svg">
          ${label(258, 268, "PERFECT", labelPs[0] ?? 0)}
          ${label(688, 324, "GOOD ENOUGH", labelPs[1] ?? 0)}
          ${drawGroup(LEFT, leftP, leftFill)}
          ${drawGroup(RIGHT, rightP, rightFill)}
          ${lemonadeFill}
          ${lettering}
        </svg>
      </div>
    `;
		}
	});
	return exports;
})({});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGVyZmVjdC12cy1nb29kLWVub3VnaC5tZWRpYS5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9zdXBlcmltZy10eXBlcy9kaXN0L2luZGV4LmpzIiwiLi4vZXhhbXBsZXMvdmVjdG9yL3BlcmZlY3QtdnMtZ29vZC1lbm91Z2gvcGVyZmVjdC12cy1nb29kLWVub3VnaC5tZWRpYS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2pzb24udHNcbi8vISBTZXJpYWxpemFibGUgSlNPTi1zaGFwZWQgdmFsdWVzIGZvciB0ZW1wbGF0ZSBkYXRhIGRlZmF1bHRzIGFuZCBDTEkgbG9hZGVycy5cbmZ1bmN0aW9uIGlzSnNvbk9iamVjdCh2YWx1ZSkge1xuXHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiICYmIHZhbHVlICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHZhbHVlKTtcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy90eXBlcy50c1xuLy8hIFN1cGVySW1nIFR5cGVzIC0gQ29yZSB0eXBlIGRlZmluaXRpb25zXG4vLyEgRXhwbGljaXQsIHR5cGVkLCBzZWxmLWRvY3VtZW50aW5nIGludGVyZmFjZXMgZm9yIHRlbXBsYXRlcywgcmVuZGVyaW5nLCBhbmQgcGxheWJhY2tcbi8qKlxuKiBEZWZpbmUgYSBwcm9qZWN0L2ZvbGRlciBjb25maWcgZm9yIF9jb25maWcudHMgZmlsZXMuXG4qIFByb3ZpZGVzIHR5cGUgaW5mZXJlbmNlIGFuZCB2YWxpZGF0aW9uLlxuKi9cbmZ1bmN0aW9uIGRlZmluZUNvbmZpZyhjb25maWcpIHtcblx0cmV0dXJuIGNvbmZpZztcbn1cbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9kZWZpbmUudHNcbi8vISBUaGUgdW5pZmllZCBgZGVmaW5lKClgIHRlbXBsYXRlIGZhY3RvcnkuXG4vLyFcbi8vISBVbmlmaWVkIHRlbXBsYXRlIGZhY3Rvcnkg4oCUIG9uZSBgZGVmaW5lKClgIGZvciBhbGwgb3V0cHV0IGtpbmRzLlxuLy8hIFRocmVlIG9ydGhvZ29uYWwgYXhlcyBzZWxlY3QgYmVoYXZpb3VyOlxuLy8hICAtIG1lZGl1bTogICBcImh0bWxcIiAoQ2hyb21pdW0pIHwgXCJzdmdcIiAocmVzdmctd2FzbSwgYnJvd3Nlci1mcmVlLCBlZGdlKS5cbi8vISAgLSBhbmltYXRlZDogaW5mZXJyZWQgZnJvbSB0aGUgY29uZmlnIOKAlCB0cnVlIGlmZiBpdCBkZWNsYXJlcyBmcHMgQU5EXG4vLyEgICAgICAgICAgICAgIChkdXJhdGlvbiBPUiBhIGByZXNvbHZlYCBob29rIHRoYXQgd2lsbCBzdXBwbHkgZHVyYXRpb24pLlxuLy8hICAtIHNpbms6ICAgICBjaG9zZW4gbGF0ZXIgKGNvbmZpZy5vdXRwdXRzIC8gQ0xJIC8gYGFzYCksIG5vdCBhdCBhdXRob3JpbmcgdGltZS5cbi8vIVxuLy8hIFR5cGVTY3JpcHQgbmFycm93cyBgY3R4YCB0byB0aGUgcmlnaHQgdmFyaWFudCBhdCB0aGUgY2FsbCBzaXRlIHZpYSBvdmVybG9hZHM6XG4vLyEgbWVkaXVtIHBpY2tzIHRoZSBzdGRsaWIgZmxhdm91ciwgYW5pbWF0ZWQgYWRkcyB0aGUgdGVtcG9yYWwgZmllbGRzICsgaGVscGVycy5cbmZ1bmN0aW9uIGRlZmluZShpbnB1dCkge1xuXHRjb25zdCBtZWRpdW0gPSBpbnB1dC5tZWRpdW0gPz8gXCJodG1sXCI7XG5cdGNvbnN0IGMgPSBpbnB1dC5jb25maWc7XG5cdGNvbnN0IGhhc1Jlc29sdmUgPSB0eXBlb2YgaW5wdXQucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiO1xuXHRyZXR1cm4ge1xuXHRcdG1lZGl1bSxcblx0XHRhbmltYXRlZDogISFjICYmIHR5cGVvZiBjLmZwcyA9PT0gXCJudW1iZXJcIiAmJiAoYy5kdXJhdGlvbiAhPSBudWxsIHx8IGhhc1Jlc29sdmUpLFxuXHRcdHJlbmRlcjogaW5wdXQucmVuZGVyLFxuXHRcdC4uLmlucHV0LmNvbmZpZyAhPT0gdm9pZCAwID8geyBjb25maWc6IGlucHV0LmNvbmZpZyB9IDoge30sXG5cdFx0Li4uaW5wdXQuc2FtcGxlICE9PSB2b2lkIDAgPyB7IHNhbXBsZTogaW5wdXQuc2FtcGxlIH0gOiB7fSxcblx0XHQuLi5oYXNSZXNvbHZlID8geyByZXNvbHZlOiBpbnB1dC5yZXNvbHZlIH0gOiB7fVxuXHR9O1xufVxuLyoqIE5hcnJvdyBhIHRlbXBsYXRlIG1vZHVsZSB0byBhbmltYXRlZCAoZnBzICsgZHVyYXRpb24gYXQgYXV0aG9yaW5nIHRpbWUpLiAqL1xuZnVuY3Rpb24gaXNBbmltYXRlZFRlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gdHJ1ZTtcbn1cbi8qKiBOYXJyb3cgYSB0ZW1wbGF0ZSBtb2R1bGUgdG8gc3RhdGljIChzdGlsbCAvIHNpbmdsZS1mcmFtZSkuICovXG5mdW5jdGlvbiBpc1N0YXRpY1RlbXBsYXRlKHRlbXBsYXRlKSB7XG5cdHJldHVybiB0ZW1wbGF0ZS5hbmltYXRlZCA9PT0gZmFsc2U7XG59XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcmVzdWx0cy50c1xuLy8hIFJlc3VsdCB0eXBlcyBhbmQgc3RydWN0dXJlZCBlcnJvcnNcbi8vISBEaXNjcmltaW5hdGVkIHVuaW9ucyBmb3IgYXN5bmMgb3BlcmF0aW9ucyB3aXRoIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZXNcbi8qKlxuKiBCYXNlIGVycm9yIGNsYXNzIGZvciBhbGwgU3VwZXJJbWcgZXJyb3JzXG4qL1xudmFyIFN1cGVySW1nRXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcblx0Y29kZTtcblx0ZGV0YWlscztcblx0c3VnZ2VzdGlvbjtcblx0ZG9jc1VybDtcblx0LyoqIE1hcHBlZCBzb3VyY2UgbG9jYXRpb24gKHBvcHVsYXRlZCBieSBlbnJpY2hFcnJvciB3aGVuIHNvdXJjZW1hcCBhdmFpbGFibGUpICovXG5cdGxvY2F0aW9uO1xuXHQvKiogVml0ZS1zdHlsZSBjb2RlIGZyYW1lIHN0cmluZyAocG9wdWxhdGVkIGJ5IGVucmljaEVycm9yIHdoZW4gc291cmNlIGNvbnRlbnQgYXZhaWxhYmxlKSAqL1xuXHRjb2RlRnJhbWU7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2UsIGNvZGUsIGRldGFpbHMsIHN1Z2dlc3Rpb24sIGRvY3NVcmwpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLmNvZGUgPSBjb2RlO1xuXHRcdHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG5cdFx0dGhpcy5zdWdnZXN0aW9uID0gc3VnZ2VzdGlvbjtcblx0XHR0aGlzLmRvY3NVcmwgPSBkb2NzVXJsO1xuXHRcdHRoaXMubmFtZSA9IFwiU3VwZXJJbWdFcnJvclwiO1xuXHRcdGNvbnN0IGNhcHR1cmVTdGFja1RyYWNlID0gRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2U7XG5cdFx0aWYgKGNhcHR1cmVTdGFja1RyYWNlKSBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCB0aGlzLmNvbnN0cnVjdG9yKTtcblx0fVxuXHQvKiogQ29udmVydCB0byBhIHBsYWluIG9iamVjdCBmb3IgbG9nZ2luZy9zZXJpYWxpemF0aW9uICovXG5cdHRvSlNPTigpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0Y29kZTogdGhpcy5jb2RlLFxuXHRcdFx0bWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuXHRcdFx0ZGV0YWlsczogdGhpcy5kZXRhaWxzLFxuXHRcdFx0c3VnZ2VzdGlvbjogdGhpcy5zdWdnZXN0aW9uLFxuXHRcdFx0Li4udGhpcy5kb2NzVXJsICE9PSB2b2lkIDAgPyB7IGRvY3NVcmw6IHRoaXMuZG9jc1VybCB9IDoge30sXG5cdFx0XHQuLi50aGlzLmxvY2F0aW9uICE9PSB2b2lkIDAgPyB7IGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uIH0gOiB7fSxcblx0XHRcdC4uLnRoaXMuY29kZUZyYW1lICE9PSB2b2lkIDAgPyB7IGNvZGVGcmFtZTogdGhpcy5jb2RlRnJhbWUgfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWRcbiovXG52YXIgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IGxvY2F0aW9uID0gZGV0YWlscy5saW5lID8gYCBhdCBsaW5lICR7ZGV0YWlscy5saW5lfWAgOiBcIlwiO1xuXHRcdGNvbnN0IGRlZmF1bHRTdWdnZXN0aW9uID0gYENoZWNrIHRoZSB0ZW1wbGF0ZSBzeW50YXgke2xvY2F0aW9ufS4gRW5zdXJlIHRoZSByZW5kZXIgZnVuY3Rpb24gcmV0dXJucyBhIHN0cmluZy5gO1xuXHRcdHN1cGVyKGBUZW1wbGF0ZSBjb21waWxhdGlvbiBmYWlsZWQke2xvY2F0aW9ufTogJHtkZXRhaWxzLnN5bnRheEVycm9yfWAsIFwiVEVNUExBVEVfQ09NUElMQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVGVtcGxhdGVDb21waWxhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBUZW1wbGF0ZSB0aHJldyBhbiBlcnJvciBkdXJpbmcgcmVuZGVyXG4qL1xudmFyIFRlbXBsYXRlUnVudGltZUVycm9yID0gY2xhc3MgZXh0ZW5kcyBTdXBlckltZ0Vycm9yIHtcblx0Y29uc3RydWN0b3IoZGV0YWlscykge1xuXHRcdGNvbnN0IHRpbWVJbmZvID0gZGV0YWlscy50aW1lQ29udGV4dCA/IGAgKCR7ZGV0YWlscy50aW1lQ29udGV4dC50aW1lbGluZVNlY29uZHMudG9GaXhlZCgzKX1zLCAkeyhkZXRhaWxzLnRpbWVDb250ZXh0LnRpbWVsaW5lUHJvZ3Jlc3MgKiAxMDApLnRvRml4ZWQoMSl9JSBwcm9ncmVzcylgIDogXCJcIjtcblx0XHRzdXBlcihgVGVtcGxhdGUgZXJyb3IgYXQgZnJhbWUgJHtkZXRhaWxzLmZyYW1lfSR7dGltZUluZm99OiAke2RldGFpbHMub3JpZ2luYWxFcnJvcn1gLCBcIlRFTVBMQVRFX1JVTlRJTUVfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGBUaGUgcmVuZGVyIGZ1bmN0aW9uIHRocmV3IGFuIGVycm9yLiBDaGVjayB0aGF0IGFsbCBkYXRhIHByb3BlcnRpZXMgZXhpc3QgYW5kIHZhbHVlcyBhcmVuJ3QgTmFOL3VuZGVmaW5lZCBhdCB0aGlzIHBvaW50IGluIHRoZSB0aW1lbGluZS5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzI2RlYnVnZ2luZ1wiKTtcblx0XHR0aGlzLm5hbWUgPSBcIlRlbXBsYXRlUnVudGltZUVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBEYXRhIHZhbGlkYXRpb24gZmFpbGVkXG4qL1xudmFyIFZhbGlkYXRpb25FcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKGRldGFpbHMpIHtcblx0XHRjb25zdCBkZWZhdWx0U3VnZ2VzdGlvbiA9IGBFeHBlY3RlZCAke2RldGFpbHMuZXhwZWN0ZWRUeXBlfSBidXQgcmVjZWl2ZWQgJHt0eXBlb2YgZGV0YWlscy5yZWNlaXZlZFZhbHVlfS4gQ2hlY2sgeW91ciBkYXRhIG9iamVjdC5gO1xuXHRcdHN1cGVyKGBWYWxpZGF0aW9uIGZhaWxlZCBmb3IgZmllbGQgXCIke2RldGFpbHMuZmllbGR9XCJgLCBcIlZBTElEQVRJT05fRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdGVtcGxhdGVzXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiVmFsaWRhdGlvbkVycm9yXCI7XG5cdFx0aWYgKGRldGFpbHMuZmlsZSAmJiBkZXRhaWxzLmxpbmUgIT09IHZvaWQgMCkgdGhpcy5sb2NhdGlvbiA9IHtcblx0XHRcdGZpbGU6IGRldGFpbHMuZmlsZSxcblx0XHRcdGxpbmU6IGRldGFpbHMubGluZSxcblx0XHRcdC4uLmRldGFpbHMuY29sdW1uICE9PSB2b2lkIDAgPyB7IGNvbHVtbjogZGV0YWlscy5jb2x1bW4gfSA6IHt9XG5cdFx0fTtcblx0fVxufTtcbi8qKlxuKiBSZW5kZXIgZmFpbGVkIChlbmNvZGluZywgYnJvd3NlciwgZXRjLilcbiovXG52YXIgUmVuZGVyRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFN1Z2dlc3Rpb24gPSBkZXRhaWxzLmh0bWxFcnJvciA/IGBUaGUgdGVtcGxhdGUgcmV0dXJuZWQgaW52YWxpZCBIVE1MLiBDaGVjayB5b3VyIHJlbmRlciBmdW5jdGlvbiBvdXRwdXQuYCA6IGRldGFpbHMuZW5jb2RlckVycm9yID8gYEVuY29kZXIgZXJyb3IuIFRyeSByZWR1Y2luZyByZXNvbHV0aW9uIG9yIGNoYW5naW5nIGNvZGVjLmAgOiBgQnJvd3NlciBlcnJvci4gQ2hlY2sgZm9yIGJyb3dzZXIgY29tcGF0aWJpbGl0eSBpc3N1ZXMuYDtcblx0XHRzdXBlcihgUmVuZGVyIGZhaWxlZCBhdCBmcmFtZSAke2RldGFpbHMuZnJhbWV9YCwgXCJSRU5ERVJfRVJST1JcIiwgZGV0YWlscywgZGV0YWlscy5zdWdnZXN0aW9uID8/IGRlZmF1bHRTdWdnZXN0aW9uLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiUmVuZGVyRXJyb3JcIjtcblx0XHRpZiAoZGV0YWlscy5maWxlICYmIGRldGFpbHMubGluZSAhPT0gdm9pZCAwKSB0aGlzLmxvY2F0aW9uID0ge1xuXHRcdFx0ZmlsZTogZGV0YWlscy5maWxlLFxuXHRcdFx0bGluZTogZGV0YWlscy5saW5lLFxuXHRcdFx0Li4uZGV0YWlscy5jb2x1bW4gIT09IHZvaWQgMCA/IHsgY29sdW1uOiBkZXRhaWxzLmNvbHVtbiB9IDoge31cblx0XHR9O1xuXHR9XG59O1xuLyoqXG4qIEZpbGUgSS9PIGVycm9yXG4qL1xudmFyIElPRXJyb3IgPSBjbGFzcyBleHRlbmRzIFN1cGVySW1nRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihkZXRhaWxzKSB7XG5cdFx0c3VwZXIoYEZhaWxlZCB0byAke2RldGFpbHMub3BlcmF0aW9ufSBmaWxlOiAke2RldGFpbHMucGF0aH1gLCBcIklPX0VSUk9SXCIsIGRldGFpbHMsIGRldGFpbHMub3BlcmF0aW9uID09PSBcIndyaXRlXCIgPyBgQ2hlY2sgdGhhdCB0aGUgZGlyZWN0b3J5IGV4aXN0cyBhbmQgeW91IGhhdmUgd3JpdGUgcGVybWlzc2lvbnMuYCA6IGBDaGVjayB0aGF0IHRoZSBmaWxlIGV4aXN0cyBhbmQgeW91IGhhdmUgcmVhZCBwZXJtaXNzaW9ucy5gLCBcImh0dHBzOi8vc3VwZXJpbWcuZGV2L2RvY3MvdHJvdWJsZXNob290aW5nI2lvXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiSU9FcnJvclwiO1xuXHR9XG59O1xuLyoqXG4qIFBsYXllciBub3QgcmVhZHkgZXJyb3JcbiovXG52YXIgUGxheWVyTm90UmVhZHlFcnJvciA9IGNsYXNzIGV4dGVuZHMgU3VwZXJJbWdFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG9wZXJhdGlvbikge1xuXHRcdHN1cGVyKGBQbGF5ZXIgbm90IHJlYWR5IGZvciBvcGVyYXRpb246ICR7b3BlcmF0aW9ufWAsIFwiUExBWUVSX05PVF9SRUFEWVwiLCB7IG9wZXJhdGlvbiB9LCBgQ2FsbCBsb2FkKCkgYW5kIHdhaXQgZm9yIGl0IHRvIGNvbXBsZXRlIGJlZm9yZSBjYWxsaW5nICR7b3BlcmF0aW9ufSgpLmAsIFwiaHR0cHM6Ly9zdXBlcmltZy5kZXYvZG9jcy9wbGF5ZXJcIik7XG5cdFx0dGhpcy5uYW1lID0gXCJQbGF5ZXJOb3RSZWFkeUVycm9yXCI7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBzcmMvcGxheWVyLnRzXG4vLyEgUGxheWVyIHR5cGVzIC0gVXNlci1mYWNpbmcgb3B0aW9ucywgZXZlbnRzLCBhbmQgaW5wdXQgdHlwZXMgZm9yIHRoZSBicm93c2VyIHBsYXllclxuLy8hIEltcGxlbWVudGF0aW9uIHR5cGVzIChQbGF5ZXJTdGF0ZSwgUGxheWVyU3RvcmUsIGV0Yy4pIGxpdmUgaW4gQHN1cGVyaW1nL3BsYXllclxuLyoqIFR5cGUgZ3VhcmQgZm9yIENvbXBvc2VkVGVtcGxhdGUgKi9cbmZ1bmN0aW9uIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkge1xuXHRyZXR1cm4gdHlwZW9mIGlucHV0ID09PSBcIm9iamVjdFwiICYmIGlucHV0ICE9PSBudWxsICYmIFwidHlwZVwiIGluIGlucHV0ICYmIGlucHV0LnR5cGUgPT09IFwiY29tcG9zZWRcIjtcbn1cbi8qKiBAZGVwcmVjYXRlZCBVc2UgaXNDb21wb3NlZFRlbXBsYXRlICovXG5jb25zdCBpc0FueUNvbXBvc2VkVGVtcGxhdGUgPSBpc0NvbXBvc2VkVGVtcGxhdGU7XG4vKiogQGRlcHJlY2F0ZWQgUmVtb3ZlZCDigJQgdXNlIGlzQ29tcG9zZWRUZW1wbGF0ZSBhbmQgY2hlY2sgbWVkaXVtID09PSBcInN2Z1wiICovXG5mdW5jdGlvbiBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUoaW5wdXQpIHtcblx0cmV0dXJuIGlzQ29tcG9zZWRUZW1wbGF0ZShpbnB1dCkgJiYgaW5wdXQubWVkaXVtID09PSBcInN2Z1wiO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2V2ZW50cy50c1xuLy8hIFR5cGVkLCB2ZXJzaW9uZWQgZXZlbnQgY29udHJhY3QgZm9yIHN1cGVyaW1nIGJ1aWxkIGludGVncmF0aW9ucy5cbi8vISBCb3RoIEpTIGNvbnN1bWVycyAocmVuZGVyIHdyYXBwZXJzKSBhbmQgUnVzdCBkZXNlcmlhbGl6ZXJzIChlLmcuIGd1bWJvKVxuLy8hIHNob3VsZCBrZXkgb24gdGhlIGB2YCBmaWVsZCBiZWZvcmUgcmVhZGluZyBldmVudC1zcGVjaWZpYyBmaWVsZHMuXG4vLyEgQnVtcCBgdmAgb24gYW55IGJyZWFraW5nIGZpZWxkIHJlbmFtZSBvciByZW1vdmFsOyBhZGRpdGl2ZSBmaWVsZHMgYXJlIG5vbi1icmVha2luZy5cbmNvbnN0IFJFTkRFUl9FVkVOVF9WRVJTSU9OID0gMTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy9iYXRjaC10eXBlcy50c1xuLy8hIFN1cGVySW1nIEJhdGNoIFR5cGVzXG4vLyEgQ28tbG9jYXRlZCBgZXhwb3J0IGNvbnN0IGJhdGNoYCBjb252ZW50aW9uIGZvciBidWlsZC10aW1lIGZhbi1vdXQuXG4vLyEgQSB0ZW1wbGF0ZSBtb2R1bGUgb3B0aW9uYWxseSBleHBvcnRzIGBiYXRjaGAgKGJ1aWx0IHdpdGggYGRlZmluZUJhdGNoYCkgdG9cbi8vISBnZW5lcmF0ZSBtYW55IG91dHB1dHMgZnJvbSBvbmUgdGVtcGxhdGUg4oCUIG5vIHNlcGFyYXRlIGxvYWRlciBmaWxlLlxuLyoqXG4qIFR5cGUgYSBjby1sb2NhdGVkIGBiYXRjaGAgZXhwb3J0IGFnYWluc3QgaXRzIHRlbXBsYXRlLlxuKlxuKiBgVERhdGFgIGZsb3dzIGZyb20gdGhlIHRlbXBsYXRlIHZhbHVlIOKAlCBjaGFuZ2UgdGhlIHRlbXBsYXRlJ3MgYHNhbXBsZWBcbiogc2hhcGUgYW5kIHRoZSBgZGF0YTpgIHNpdGVzIGJlbG93IHR5cGUtZXJyb3IuIFRoZSB0ZW1wbGF0ZSBhcmd1bWVudCBpc1xuKiBpbmZlcmVuY2Utb25seTsgYXQgcnVudGltZSB0aGUgcHJvdmlkZXIgaXMgcmV0dXJuZWQgdW5jaGFuZ2VkLlxuKlxuKiBQdXQgYW55IHNlcnZlci9kYXRhIGltcG9ydHMgKmluc2lkZSogdGhlIHByb3ZpZGVyIHdpdGggYGF3YWl0IGltcG9ydCguLi4pYFxuKiBzbyB0aGUgY2xpZW50IHBsYXllciBidW5kbGUgKHdoaWNoIGltcG9ydHMgdGhlIHRlbXBsYXRlKSB0cmVlLXNoYWtlcyB0aGVtIG91dC5cbipcbiogQGV4YW1wbGVcbiogYGBgdHlwZXNjcmlwdFxuKiAvLyBvZy5tZWRpYS50c1xuKiBpbXBvcnQgeyBkZWZpbmUsIGRlZmluZUJhdGNoIH0gZnJvbSBcInN1cGVyaW1nXCI7XG4qXG4qIGNvbnN0IHRlbXBsYXRlID0gZGVmaW5lKHsgc2FtcGxlOiB7IHRpdGxlOiBcIkhpXCIgfSwgY29uZmlnOiB7IHdpZHRoOiAxMjAwLCBoZWlnaHQ6IDYzMCB9LCByZW5kZXIgfSk7XG4qIGV4cG9ydCBkZWZhdWx0IHRlbXBsYXRlO1xuKlxuKiBleHBvcnQgY29uc3QgYmF0Y2ggPSBkZWZpbmVCYXRjaCh0ZW1wbGF0ZSwgYXN5bmMgKCkgPT4ge1xuKiAgIGNvbnN0IHsgZ2V0UG9zdHMgfSA9IGF3YWl0IGltcG9ydChcIi4uL2NvbnRlbnRcIik7XG4qICAgcmV0dXJuIChhd2FpdCBnZXRQb3N0cygpKS5tYXAocCA9PiAoeyBzbHVnOiBwLnNsdWcsIHNhbXBsZTogeyB0aXRsZTogcC50aXRsZSB9IH0pKTtcbiogfSk7XG4qIGBgYFxuKi9cbmZ1bmN0aW9uIGRlZmluZUJhdGNoKF90ZW1wbGF0ZSwgcHJvdmlkZXIpIHtcblx0cmV0dXJuIHByb3ZpZGVyO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vLyEgU3VwZXJJbWcgVHlwZXMgLSBQdXJlIFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9uc1xuLy8hIENvcmUgdHlwZXMsIGludGVyZmFjZXMsIGFuZCBlcnJvciBjbGFzc2VzIGZvciB0ZW1wbGF0ZXMsIHJlbmRlcmluZywgYW5kIHBsYXliYWNrXG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IElPRXJyb3IsIFBsYXllck5vdFJlYWR5RXJyb3IsIFJFTkRFUl9FVkVOVF9WRVJTSU9OLCBSZW5kZXJFcnJvciwgU3VwZXJJbWdFcnJvciwgVGVtcGxhdGVDb21waWxhdGlvbkVycm9yLCBUZW1wbGF0ZVJ1bnRpbWVFcnJvciwgVmFsaWRhdGlvbkVycm9yLCBkZWZpbmUsIGRlZmluZUJhdGNoLCBkZWZpbmVDb25maWcsIGlzQW5pbWF0ZWRUZW1wbGF0ZSwgaXNBbnlDb21wb3NlZFRlbXBsYXRlLCBpc0NvbXBvc2VkU3ZnVGVtcGxhdGUsIGlzQ29tcG9zZWRUZW1wbGF0ZSwgaXNKc29uT2JqZWN0LCBpc1N0YXRpY1RlbXBsYXRlIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsIi8vIFBlcmZlY3QgdnMgR29vZCBFbm91Z2gg4oCUIGhhbmQtZHJhd24gbGVtb25hZGUgc3RhbmQgY29tcGFyaXNvblxuLy8gRGVtb25zdHJhdGVzOiBzdGQuc3ZnLmRyYXcgKyBzdGQuc3RhZ2dlciBmb3IgbXVsdGktZ3JvdXAgbGluZS1hcnQgcmV2ZWFsc1xuLy8gQmFzZWQgb24gdGhlIGNsYXNzaWMgXCJwZXJmZWN0IChjb21pbmcgc29vbikgdnMgZ29vZCBlbm91Z2ggKHNlbGxpbmcpXCIgc2tldGNoXG5cbmltcG9ydCB7IGRlZmluZSB9IGZyb20gXCJzdXBlcmltZ1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmUoe1xuICBzYW1wbGU6IHtcbiAgICBpbms6IFwiIzJiMmIyYlwiLFxuICAgIHBhcGVyOiBcIiNmZmZmZmZcIixcbiAgICBwYW5lbDogXCIjM2YzZjNmXCIsXG4gICAgZmlsbEdyYXk6IFwiI2UyZTJlNFwiLFxuICAgIGxlbW9uYWRlOiBcIiNmNWVmOWVcIixcbiAgICBtb25leTogXCIjYjlhYzNmXCIsXG4gIH0sXG5cbiAgY29uZmlnOiB7XG4gICAgd2lkdGg6IDE5MjAsXG4gICAgaGVpZ2h0OiAxMDgwLFxuICAgIGZwczogMzAsXG4gICAgZHVyYXRpb246IFwiOXNcIixcbiAgICBpbmxpbmVDc3M6IFtgXG4gICAgICAqIHsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9XG4gICAgICBib2R5IHsgYmFja2dyb3VuZDogI2ZmZmZmZjsgb3ZlcmZsb3c6IGhpZGRlbjsgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgc2Fucy1zZXJpZjsgfVxuICAgIGBdLFxuICB9LFxuXG4gIHJlbmRlcihjdHgpIHtcbiAgICBjb25zdCB7IHN0ZCwgd2lkdGgsIGhlaWdodCwgZGF0YSB9ID0gY3R4O1xuICAgIGNvbnN0IHsgaW5rLCBwYXBlciwgcGFuZWwsIGZpbGxHcmF5LCBsZW1vbmFkZSwgbW9uZXkgfSA9IGRhdGE7XG5cbiAgICAvLyBlc3RhYmxpc2ggKGxhYmVscykg4oaSIGRldmVsb3AgKGRyYXcgbGVmdCwgZHJhdyByaWdodCkg4oaSIHJlc29sdmVcbiAgICAvLyAocHVuY2hsaW5lIHN0YW1wLCB0aGVuIHRoZSBtb25leSBwYXlvZmYpIOKGkiBob2xkIOKJpTFzIG9uIHRoZSBzZXR0bGVkIGZyYW1lXG4gICAgY29uc3QgdCA9IGN0eC5kaXJlY3Rvcih7XG4gICAgICBsYWJlbHM6IFwiMC44c1wiLFxuICAgICAgbGVmdDogXCIyLjRzXCIsXG4gICAgICByaWdodDogXCIyLjRzXCIsXG4gICAgICBzdGFtcDogXCIwLjhzXCIsXG4gICAgICBwYXlvZmY6IFwiMC44c1wiLFxuICAgICAgaG9sZDogXCIxLjhzXCIsXG4gICAgfSk7XG5cbiAgICAvLyAtLS0gUGF0aCBoZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIC8vIFppZ3phZyB0cmltIChhd25pbmcgZnJpbmdlKSwgdGVldGggcG9pbnRpbmcgZG93blxuICAgIGNvbnN0IHppZyA9ICh4MTogbnVtYmVyLCB4MjogbnVtYmVyLCB5OiBudW1iZXIsIGFtcDogbnVtYmVyLCB0ZWV0aDogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCBzdGVwID0gKHgyIC0geDEpIC8gdGVldGg7XG4gICAgICBsZXQgZCA9IGBNICR7eDF9ICR7eX1gO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZWV0aDsgaSsrKSB7XG4gICAgICAgIGQgKz0gYCBMICR7eDEgKyBzdGVwICogKGkgKyAwLjUpfSAke3kgKyBhbXB9IEwgJHt4MSArIHN0ZXAgKiAoaSArIDEpfSAke3l9YDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkO1xuICAgIH07XG5cbiAgICAvLyBSZWN0YW5nbGUgcm90YXRlZCBgZGVnYCBhcm91bmQgaXRzIGNlbnRlciwgYXMgYSBjbG9zZWQgcGF0aFxuICAgIGNvbnN0IHJvdFJlY3QgPSAoY3g6IG51bWJlciwgY3k6IG51bWJlciwgdzogbnVtYmVyLCBoOiBudW1iZXIsIGRlZzogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCByID0gKGRlZyAqIE1hdGguUEkpIC8gMTgwO1xuICAgICAgY29uc3QgY29zID0gTWF0aC5jb3MociksIHNpbiA9IE1hdGguc2luKHIpO1xuICAgICAgY29uc3QgcHRzID0gW1xuICAgICAgICBbLXcgLyAyLCAtaCAvIDJdLCBbdyAvIDIsIC1oIC8gMl0sIFt3IC8gMiwgaCAvIDJdLCBbLXcgLyAyLCBoIC8gMl0sXG4gICAgICBdLm1hcCgoW3gsIHldKSA9PiBgJHtjeCArIHggKiBjb3MgLSB5ICogc2lufSAke2N5ICsgeCAqIHNpbiArIHkgKiBjb3N9YCk7XG4gICAgICByZXR1cm4gYE0gJHtwdHNbMF19IEwgJHtwdHNbMV19IEwgJHtwdHNbMl19IEwgJHtwdHNbM119IFpgO1xuICAgIH07XG5cbiAgICB0eXBlIFN0cm9rZSA9IHsgZDogc3RyaW5nOyB3PzogbnVtYmVyOyBmaWxsPzogc3RyaW5nIH07XG5cbiAgICAvLyAtLS0gTGVmdCBzdGFuZDogdGhlIFwicGVyZmVjdFwiIGJvb3RoICh2aWV3Qm94IDEyMDB4Njc1KSAtLS0tLS0tLS0tLVxuXG4gICAgY29uc3QgTEVGVDogU3Ryb2tlW10gPSBbXG4gICAgICAvLyBTdGVwcGVkIG1hcnF1ZWUgY3Jvd25cbiAgICAgIHsgZDogXCJNIDMxOCAzMzIgTCAzMTggMjkyIEwgMzQyIDI5MiBMIDM0MiAyNzYgTCA0NzYgMjc2IEwgNDc2IDI5MiBMIDUwMCAyOTIgTCA1MDAgMzMyXCIsIGZpbGw6IGZpbGxHcmF5IH0sXG4gICAgICAvLyBcIkJFU1QgTEVNT05BREVcIiBzaWduIHBsYXRlXG4gICAgICB7IGQ6IHJvdFJlY3QoNDA5LCAzMDMsIDEzMiwgMzAsIC0yKSwgZmlsbDogcGFwZXIgfSxcbiAgICAgIC8vIEF3bmluZzogZmxhcmVzIG91dHdhcmRcbiAgICAgIHsgZDogXCJNIDMwMiAzMzIgTCA1MTYgMzMyIEwgNTUyIDM4NiBMIDI2NiAzODYgWlwiLCBmaWxsOiBmaWxsR3JheSB9LFxuICAgICAgeyBkOiB6aWcoMjY2LCA1NTIsIDM4NiwgMTMsIDEzKSwgdzogMi41IH0sXG4gICAgICAvLyBCb290aCBib2R5XG4gICAgICB7IGQ6IFwiTSAyODggMzg2IEwgMjg4IDYwNiBMIDUzNCA2MDYgTCA1MzQgMzg2XCIsIGZpbGw6IGZpbGxHcmF5IH0sXG4gICAgICAvLyBMZWZ0IGZyb250IGVkZ2UgKHBlcnNwZWN0aXZlIGhpbnQpICsgYmFzZSBsaW5lXG4gICAgICB7IGQ6IFwiTSAyODggNjA2IEwgMzE2IDYxNiBMIDMxNiAzOThcIiwgdzogMiB9LFxuICAgICAgeyBkOiBcIk0gMzE2IDYxNiBMIDU0MCA2MTYgTCA1MzQgNjA2XCIsIHc6IDIgfSxcbiAgICAgIC8vIFNlcnZpbmcgd2luZG93IChib2FyZGVkIHVwIGJlaGluZCB0aGUgYmFubmVyKVxuICAgICAgeyBkOiByb3RSZWN0KDQzOCwgNDM4LCAxNzYsIDY2LCAtMS41KSB9LFxuICAgICAgLy8gQ09NSU5HIFNPT04gYmFubmVyLCBzbGFwcGVkIG9uIGRpYWdvbmFsbHlcbiAgICAgIHsgZDogcm90UmVjdCg0MDgsIDUwNSwgMjk2LCA3NCwgLTE0KSwgZmlsbDogcGFwZXIsIHc6IDMgfSxcbiAgICBdO1xuXG4gICAgLy8gLS0tIFJpZ2h0IHN0YW5kOiBcImdvb2QgZW5vdWdoXCIgYW5kIG9wZW4gZm9yIGJ1c2luZXNzIC0tLS0tLS0tLS0tLS0tXG5cbiAgICBjb25zdCBwbGFua1hzID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogOCB9LCAoXywgaSkgPT4gNzQyICsgaSAqIDMwKTtcbiAgICBjb25zdCBSSUdIVDogU3Ryb2tlW10gPSBbXG4gICAgICAvLyBUd28gdXByaWdodCBwb3N0c1xuICAgICAgeyBkOiByb3RSZWN0KDc0MiwgNDQ4LCAxOCwgMjYwLCAxKSwgZmlsbDogZmlsbEdyYXkgfSxcbiAgICAgIHsgZDogcm90UmVjdCg5NTIsIDQ2MiwgMTgsIDI5MCwgLTEpLCBmaWxsOiBmaWxsR3JheSB9LFxuICAgICAgLy8gVG9wIGNyb3NzYm9hcmRzIChzbGlnaHRseSBhc2tldylcbiAgICAgIHsgZDogcm90UmVjdCg4NTAsIDM2NiwgMzAwLCAyNCwgLTEuMiksIGZpbGw6IGZpbGxHcmF5IH0sXG4gICAgICB7IGQ6IHJvdFJlY3QoODUyLCAzOTgsIDI5NiwgMjIsIDAuOCksIGZpbGw6IGZpbGxHcmF5IH0sXG4gICAgICAvLyBMRU1PTkFERSBzaWduIG5haWxlZCBvdmVyIHRoZSBib2FyZHNcbiAgICAgIHsgZDogcm90UmVjdCg4NTgsIDM4MCwgMTUwLCA0MiwgLTIpLCBmaWxsOiBwYXBlciwgdzogMyB9LFxuICAgICAgLy8gQ291bnRlciBzbGFiXG4gICAgICB7IGQ6IFwiTSA3MDYgNDgyIEwgMTAwMCA0NzggTCAxMDEwIDQ5MiBMIDcxNiA0OTcgWlwiLCBmaWxsOiBmaWxsR3JheSB9LFxuICAgICAgLy8gUGxhbmsgZnJvbnRcbiAgICAgIHsgZDogXCJNIDcyMiA0OTcgTCA3MjIgNTk0IEwgOTc2IDU5MCBMIDk3NiA0OTRcIiwgZmlsbDogZmlsbEdyYXkgfSxcbiAgICAgIC4uLnBsYW5rWHMubWFwKCh4KSA9PiAoeyBkOiBgTSAke3h9IDQ5NyBMICR7eH0gNTkyYCwgdzogMiB9KSksXG4gICAgICAvLyBMZW1vbmFkZSBqdWcgb24gdGhlIGNvdW50ZXJcbiAgICAgIHtcbiAgICAgICAgZDogXCJNIDgzOCA0NzYgUSA4MzAgNDU2IDgzNiA0NDAgTCA4MzIgNDMyIEwgODY0IDQzMiBMIDg2MCA0NDAgUSA4NjYgNDU2IDg1OCA0NzYgUSA4NDggNDgwIDgzOCA0NzYgWlwiLFxuICAgICAgICBmaWxsOiBwYXBlciwgdzogMi41LFxuICAgICAgfSxcbiAgICAgIHsgZDogXCJNIDg2MiA0NDIgUSA4NzQgNDUwIDg2MiA0NjRcIiwgdzogMi41IH0sXG4gICAgICAvLyBNb25leSBiYWdzIGF0IHRoZSBiYXNlXG4gICAgICB7XG4gICAgICAgIGQ6IFwiTSA3NDggNTkyIFEgNzI4IDU4OCA3MzAgNTcwIFEgNzI0IDU1NiA3NDAgNTUwIEwgNzUwIDU0NiBRIDc0NiA1MzggNzU0IDUzNiBMIDc2NiA1MzYgUSA3NzQgNTM4IDc3MCA1NDYgTCA3ODAgNTUyIFEgNzk0IDU1OCA3ODYgNTcyIFEgNzkyIDU4OCA3NzIgNTkyIFEgNzYwIDU5NiA3NDggNTkyIFpcIixcbiAgICAgICAgZmlsbDogZmlsbEdyYXksIHc6IDIuNSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGQ6IFwiTSA3ODYgNTk0IFEgNzcwIDU5MCA3NzQgNTc0IFEgNzcwIDU2MiA3ODQgNTU4IEwgNzkyIDU1NCBRIDc5MCA1NDggNzk2IDU0NiBMIDgwNiA1NDYgUSA4MTIgNTQ4IDgxMCA1NTQgTCA4MTggNTYwIFEgODI4IDU2NiA4MjIgNTc4IFEgODI2IDU5MCA4MTAgNTk0IFEgNzk4IDU5OCA3ODYgNTk0IFpcIixcbiAgICAgICAgZmlsbDogZmlsbEdyYXksIHc6IDIuNSxcbiAgICAgIH0sXG4gICAgICB7IGQ6IFwiTSA3NTAgNTQ0IFEgNzU4IDU0OCA3NjggNTQ0IE0gNzkyIDU1MiBRIDc5OSA1NTYgODA4IDU1MlwiLCB3OiAyIH0sXG4gICAgXTtcblxuICAgIC8vIC0tLSBBbmltYXRpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICBjb25zdCBkcmF3R3JvdXAgPSAocGF0aHM6IFN0cm9rZVtdLCBwcm9ncmVzczogbnVtYmVyLCBmaWxsT3BhY2l0eTogbnVtYmVyKSA9PlxuICAgICAgc3RkLnN0YWdnZXIubXMocGF0aHMsIHByb2dyZXNzLCB7XG4gICAgICAgIHdpbmRvd1NlY29uZHM6IDIsXG4gICAgICAgIGVhY2hNczogNDUsXG4gICAgICAgIGNhcE1zOiA1MDAsXG4gICAgICB9KVxuICAgICAgICAvLyBTa2lwIHVuLXN0YXJ0ZWQgcGF0aHM6IGRhc2gtbGVuZ3RoIGVzdGltYXRlcyBkaWZmZXIgc2xpZ2h0bHkgZnJvbSB0aGVcbiAgICAgICAgLy8gYnJvd3NlcidzLCB3aGljaCBvdGhlcndpc2UgbGVha3MgYSBzbGl2ZXIgb2Ygc3Ryb2tlIGF0IHByb2dyZXNzIDBcbiAgICAgICAgLmZpbHRlcigoeyBwcm9ncmVzczogcCB9KSA9PiBwID4gMClcbiAgICAgICAgLm1hcCgoeyBpdGVtLCBwcm9ncmVzczogcCB9KSA9PiB7XG4gICAgICAgICAgY29uc3QgZHJhdyA9IHN0ZC5zdmcuZHJhdyhpdGVtLmQsIHApO1xuICAgICAgICAgIGNvbnN0IGZpbGwgPSBpdGVtLmZpbGxcbiAgICAgICAgICAgID8gYGZpbGw9XCIke2l0ZW0uZmlsbH1cIiBmaWxsLW9wYWNpdHk9XCIkeyhmaWxsT3BhY2l0eSAqIHApLnRvRml4ZWQoMyl9XCJgXG4gICAgICAgICAgICA6IGBmaWxsPVwibm9uZVwiYDtcbiAgICAgICAgICByZXR1cm4gYDxwYXRoIGQ9XCIke2l0ZW0uZH1cIiAke2ZpbGx9XG4gICAgICAgICAgICBzdHJva2U9XCIke2lua31cIiBzdHJva2Utd2lkdGg9XCIke2l0ZW0udyA/PyAzfVwiXG4gICAgICAgICAgICBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIlxuICAgICAgICAgICAgc3Ryb2tlLWRhc2hhcnJheT1cIiR7ZHJhdy5zdHJva2VEYXNoYXJyYXl9XCJcbiAgICAgICAgICAgIHN0cm9rZS1kYXNob2Zmc2V0PVwiJHtkcmF3LnN0cm9rZURhc2hvZmZzZXR9XCIgLz5gO1xuICAgICAgICB9KS5qb2luKFwiXFxuXCIpO1xuXG4gICAgY29uc3QgbGVmdFAgPSB0LmluKFwibGVmdFwiKTtcbiAgICBjb25zdCByaWdodFAgPSB0LmluKFwicmlnaHRcIik7XG4gICAgY29uc3Qgc3RhbXBQID0gdC5pbihcInN0YW1wXCIpO1xuICAgIGNvbnN0IHBheW9mZlAgPSB0LmluKFwicGF5b2ZmXCIpO1xuXG4gICAgLy8gRmlsbHMgc2V0dGxlIGluIGFzIGVhY2ggc2lkZSBmaW5pc2hlcyBkcmF3aW5nIChpbmsgZmlyc3QsIHRoZW4gd2FzaClcbiAgICBjb25zdCBsZWZ0RmlsbCA9IHN0ZC5pbnRlcnBvbGF0ZShsZWZ0UCwgWzAuNzUsIDFdLCBbMCwgMV0pO1xuICAgIGNvbnN0IHJpZ2h0RmlsbCA9IHN0ZC5pbnRlcnBvbGF0ZShyaWdodFAsIFswLjc1LCAxXSwgWzAsIDFdKTtcblxuICAgIC8vIEVhY2ggc2lnbidzIGxldHRlcmluZyBhcnJpdmVzIGFzIGl0cyBvd24gc2lkZSBmaW5pc2hlcyDigJQgbmV2ZXIgYWxsIGF0IG9uY2VcbiAgICBjb25zdCBiZXN0TGVtT3AgPSBzdGQuaW50ZXJwb2xhdGUobGVmdFAsIFswLjgyLCAwLjk2XSwgWzAsIDFdLCBcImVhc2VPdXRDdWJpY1wiKTtcbiAgICBjb25zdCBsZW1vbmFkZU9wID0gc3RkLmludGVycG9sYXRlKHJpZ2h0UCwgWzAuODIsIDAuOTZdLCBbMCwgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuXG4gICAgLy8gQ09NSU5HIFNPT04gc3RhbXBzIGRvd24gb250byB0aGUgYm9vdGg6IHNjYWxlIHNldHRsZXMgMS4zIOKGkiAxXG4gICAgY29uc3Qgc3RhbXBTY2FsZSA9IHN0ZC5pbnRlcnBvbGF0ZShzdGFtcFAsIFswLCAxXSwgWzEuMywgMV0sIFwiZWFzZU91dEN1YmljXCIpO1xuICAgIGNvbnN0IHN0YW1wT3AgPSBzdGQuaW50ZXJwb2xhdGUoc3RhbXBQLCBbMCwgMC40NV0sIFswLCAxXSk7XG5cbiAgICAvLyBQYXlvZmY6IGxlbW9uYWRlIHBvdXJzLCB0aGVuIHRoZSAkIHBvcCBpbiB3aXRoIGEgc21hbGwgb3ZlcnNob290XG4gICAgY29uc3QgcG91clAgPSBzdGQuaW50ZXJwb2xhdGUocGF5b2ZmUCwgWzAsIDAuNl0sIFswLCAxXSwgXCJlYXNlT3V0Q3ViaWNcIik7XG4gICAgY29uc3QgZDEgPSBzdGQuaW50ZXJwb2xhdGUocGF5b2ZmUCwgWzAuMTUsIDAuNzVdLCBbMCwgMV0sIFwiZWFzZU91dEJhY2tcIik7XG4gICAgY29uc3QgZDIgPSBzdGQuaW50ZXJwb2xhdGUocGF5b2ZmUCwgWzAuMywgMC45XSwgWzAsIDFdLCBcImVhc2VPdXRCYWNrXCIpO1xuXG4gICAgY29uc3QgbGVtb25hZGVGaWxsID0gYFxuICAgICAgPGNsaXBQYXRoIGlkPVwicG91clwiPjxyZWN0IHg9XCI4MjhcIiB5PVwiJHs0NzYgLSAzMiAqIHBvdXJQfVwiIHdpZHRoPVwiNDBcIiBoZWlnaHQ9XCIzNlwiIC8+PC9jbGlwUGF0aD5cbiAgICAgIDxwYXRoIGQ9XCJNIDg0MCA0NzIgUSA4MzQgNDU4IDgzOCA0NDggTCA4NTggNDQ4IFEgODYyIDQ1OCA4NTYgNDcyIFEgODQ4IDQ3NSA4NDAgNDcyIFpcIlxuICAgICAgICAgICAgZmlsbD1cIiR7bGVtb25hZGV9XCIgY2xpcC1wYXRoPVwidXJsKCNwb3VyKVwiIC8+XG4gICAgICA8ZyB0cmFuc2Zvcm09XCJ0cmFuc2xhdGUoNzU5IDU3MCkgc2NhbGUoJHtNYXRoLm1heCgwLCBkMSl9KVwiIG9wYWNpdHk9XCIke3N0ZC5jbGFtcDAxKGQxKX1cIj5cbiAgICAgICAgPHRleHQgeT1cIjhcIiBmb250LXNpemU9XCIyNFwiIGZvbnQtd2VpZ2h0PVwiNzAwXCIgZmlsbD1cIiR7bW9uZXl9XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIj4kPC90ZXh0PlxuICAgICAgPC9nPlxuICAgICAgPGcgdHJhbnNmb3JtPVwidHJhbnNsYXRlKDc5OCA1NzUpIHNjYWxlKCR7TWF0aC5tYXgoMCwgZDIpfSlcIiBvcGFjaXR5PVwiJHtzdGQuY2xhbXAwMShkMikgKiAwLjg1fVwiPlxuICAgICAgICA8dGV4dCB5PVwiN1wiIGZvbnQtc2l6ZT1cIjIwXCIgZm9udC13ZWlnaHQ9XCI3MDBcIiBmaWxsPVwiJHttb25leX1cIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiPiQ8L3RleHQ+XG4gICAgICA8L2c+XG4gICAgYDtcblxuICAgIGNvbnN0IGxldHRlcmluZyA9IGBcbiAgICAgIDx0ZXh0IHg9XCI0MDlcIiB5PVwiMzA5XCIgdHJhbnNmb3JtPVwicm90YXRlKC0yIDQwOSAzMDMpXCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIlxuICAgICAgICAgICAgZm9udC1zaXplPVwiMTVcIiBmb250LXdlaWdodD1cIjgwMFwiIGxldHRlci1zcGFjaW5nPVwiMS41XCIgZmlsbD1cIiR7aW5rfVwiXG4gICAgICAgICAgICBvcGFjaXR5PVwiJHtiZXN0TGVtT3B9XCI+QkVTVCBMRU1PTkFERTwvdGV4dD5cbiAgICAgIDx0ZXh0IHg9XCI0MDhcIiB5PVwiNTE0XCIgdGV4dC1hbmNob3I9XCJtaWRkbGVcIlxuICAgICAgICAgICAgdHJhbnNmb3JtPVwicm90YXRlKC0xNCA0MDggNTA1KSB0cmFuc2xhdGUoNDA4IDUwNSkgc2NhbGUoJHtzdGFtcFNjYWxlfSkgdHJhbnNsYXRlKC00MDggLTUwNSlcIlxuICAgICAgICAgICAgZm9udC1zaXplPVwiMjhcIiBmb250LXdlaWdodD1cIjYwMFwiIGxldHRlci1zcGFjaW5nPVwiNFwiIGZpbGw9XCIke2lua31cIlxuICAgICAgICAgICAgZm9udC1mYW1pbHk9XCJHZW9yZ2lhLCBzZXJpZlwiIG9wYWNpdHk9XCIke3N0YW1wT3B9XCI+Q09NSU5HIFNPT048L3RleHQ+XG4gICAgICA8dGV4dCB4PVwiODU4XCIgeT1cIjM4OVwiIHRyYW5zZm9ybT1cInJvdGF0ZSgtMiA4NTggMzgwKVwiIHRleHQtYW5jaG9yPVwibWlkZGxlXCJcbiAgICAgICAgICAgIGZvbnQtc2l6ZT1cIjI0XCIgbGV0dGVyLXNwYWNpbmc9XCIyXCIgZmlsbD1cIiR7aW5rfVwiXG4gICAgICAgICAgICBmb250LWZhbWlseT1cIidDb21pYyBTYW5zIE1TJywgJ1NlZ29lIFByaW50JywgY3Vyc2l2ZVwiXG4gICAgICAgICAgICBvcGFjaXR5PVwiJHtsZW1vbmFkZU9wfVwiPkxFTU9OQURFPC90ZXh0PlxuICAgIGA7XG5cbiAgICAvLyBIZWFkZXIgbGFiZWxzIGRyb3AgaW4gd2l0aCBhIHNob3J0IHN0YWdnZXIg4oCUIGxlZnQgbGVhZHMsIHJpZ2h0IGZvbGxvd3NcbiAgICBjb25zdCBsYWJlbFBzID0gc3RkLnN0YWdnZXIubXMoMiwgdC5pbihcImxhYmVsc1wiKSwge1xuICAgICAgd2luZG93U2Vjb25kczogMC44LFxuICAgICAgZWFjaE1zOiA4MCxcbiAgICAgIGNhcE1zOiAyMDAsXG4gICAgfSk7XG4gICAgY29uc3QgbGFiZWwgPSAoeDogbnVtYmVyLCB3OiBudW1iZXIsIHRleHQ6IHN0cmluZywgcDogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCB5ID0gc3RkLmludGVycG9sYXRlKHAsIFswLCAxXSwgWzE2LCAwXSk7XG4gICAgICByZXR1cm4gYFxuICAgICAgICA8ZyBvcGFjaXR5PVwiJHtwfVwiIHRyYW5zZm9ybT1cInRyYW5zbGF0ZSgwICR7eX0pXCI+XG4gICAgICAgICAgPHJlY3QgeD1cIiR7eH1cIiB5PVwiOTZcIiB3aWR0aD1cIiR7d31cIiBoZWlnaHQ9XCI2NFwiIGZpbGw9XCIke3BhbmVsfVwiIC8+XG4gICAgICAgICAgPHRleHQgeD1cIiR7eCArIHcgLyAyfVwiIHk9XCIxMzlcIiB0ZXh0LWFuY2hvcj1cIm1pZGRsZVwiIGZvbnQtc2l6ZT1cIjMwXCJcbiAgICAgICAgICAgICAgICBmb250LXdlaWdodD1cIjgwMFwiIGxldHRlci1zcGFjaW5nPVwiN1wiIGZpbGw9XCIke3BhcGVyfVwiPiR7dGV4dH08L3RleHQ+XG4gICAgICAgIDwvZz5cbiAgICAgIGA7XG4gICAgfTtcblxuICAgIHJldHVybiBgXG4gICAgICA8ZGl2IHN0eWxlPVwiJHtzdGQuY3NzKHsgd2lkdGgsIGhlaWdodCwgYmFja2dyb3VuZDogcGFwZXIgfSl9OyAke3N0ZC5jc3MuY2VudGVyKCl9XCI+XG4gICAgICAgIDxzdmcgd2lkdGg9XCIke3dpZHRofVwiIGhlaWdodD1cIiR7aGVpZ2h0fVwiIHZpZXdCb3g9XCIwIDAgMTIwMCA2NzVcIlxuICAgICAgICAgICAgIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj5cbiAgICAgICAgICAke2xhYmVsKDI1OCwgMjY4LCBcIlBFUkZFQ1RcIiwgbGFiZWxQc1swXSA/PyAwKX1cbiAgICAgICAgICAke2xhYmVsKDY4OCwgMzI0LCBcIkdPT0QgRU5PVUdIXCIsIGxhYmVsUHNbMV0gPz8gMCl9XG4gICAgICAgICAgJHtkcmF3R3JvdXAoTEVGVCwgbGVmdFAsIGxlZnRGaWxsKX1cbiAgICAgICAgICAke2RyYXdHcm91cChSSUdIVCwgcmlnaHRQLCByaWdodEZpbGwpfVxuICAgICAgICAgICR7bGVtb25hZGVGaWxsfVxuICAgICAgICAgICR7bGV0dGVyaW5nfVxuICAgICAgICA8L3N2Zz5cbiAgICAgIDwvZGl2PlxuICAgIGA7XG4gIH0sXG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0E2QkEsU0FBUyxPQUFPLE9BQU87RUFDdEIsTUFBTSxTQUFTLE1BQU0sVUFBVTtFQUMvQixN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