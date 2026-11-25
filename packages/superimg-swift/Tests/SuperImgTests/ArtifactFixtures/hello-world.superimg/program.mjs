var __template = (function(exports) {

Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
// packages/superimg-stdlib/dist/h.js
//! Local copy of the authoring-tree shape. Keep in sync with
	//! `@superimg/types` `media-node.ts`. Types stays a leaf package.
	//! Hyperscript constructor for the authoring tree.
	function isMediaElement(value) {
		return typeof value === "object" && value !== null && value.$$typeof === "@foxworth/superimg/element" && typeof value.type === "string";
	}
	function flattenChildren(children) {
		const out = [];
		for (const child of children) {
			if (child === null || child === void 0 || child === false || child === true) continue;
			if (Array.isArray(child)) {
				out.push(...flattenChildren(child));
				continue;
			}
			out.push(child);
		}
		return out;
	}
	/**
	* Hyperscript constructor. `type` is an HTML/SVG tag or a primitive name
	* (`Frame`, `Stack`, `Text`, …).
	*/
	function h(type, props, ...children) {
		const { key, ...rest } = props ?? {};
		const fromProps = rest.children;
		const nested = Array.isArray(fromProps) ? fromProps : fromProps !== void 0 ? [fromProps] : [];
		const { children: _ignored, ...attrProps } = rest;
		return {
			$$typeof: "@foxworth/superimg/element",
			type,
			props: attrProps,
			children: flattenChildren([...nested, ...children]),
			...key !== void 0 && key !== null ? { key: String(key) } : {}
		};
	}

// packages/superimg-stdlib/dist/primitives.js
//! Layout primitives — return MediaElements; layout runs in lower().
	function isPropsBag(value) {
		if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
		if (isMediaElement(value)) return false;
		return true;
	}
	function split(propsOrChild, rest) {
		if (propsOrChild === void 0) return {
			props: {},
			children: rest
		};
		if (isPropsBag(propsOrChild)) return {
			props: propsOrChild,
			children: rest
		};
		return {
			props: {},
			children: [propsOrChild, ...rest]
		};
	}
	function Frame(propsOrChild, ...rest) {
		const { props, children } = split(propsOrChild, rest);
		return h("Frame", props, ...children);
	}
	/** Centering/distribution needs a definite box; otherwise the stack shrinks and the alignment is a no-op. */
	function impliedStackFill(props) {
		const direction = props.direction === "row" ? "row" : "column";
		const justify = props.justify;
		const align = props.align;
		const needsMain = justify === "center" || justify === "end" || justify === "space-between";
		const needsCross = align === "center" || align === "end";
		const fill = {};
		if (props.width === void 0 && (direction === "row" ? needsMain : needsCross)) fill.width = "fill";
		if (props.height === void 0 && (direction === "row" ? needsCross : needsMain)) fill.height = "fill";
		return fill;
	}
	function Stack(propsOrChild, ...rest) {
		const { props, children } = split(propsOrChild, rest);
		const positioned = props;
		if (positioned.x !== void 0 || positioned.y !== void 0) throw new Error("Stack cannot take x/y — wrap in a Frame to position or slide");
		return h("Stack", {
			direction: "column",
			...impliedStackFill(props),
			...props
		}, ...children);
	}
	/** Default ink so uncolored Text is not browser-black on a dark composite floor. */
	const DEFAULT_TEXT_COLOR = "#111827";
	function Text(propsOrChild, ...rest) {
		const { props, children } = split(propsOrChild, rest);
		return h("Text", {
			variant: "body",
			color: DEFAULT_TEXT_COLOR,
			...props
		}, ...children);
	}
	function Fill(props = {}) {
		return h("Fill", {
			width: "fill",
			height: "fill",
			...props
		});
	}

// packages/superimg-types/dist/index.js
//! Serializable JSON-shaped values for template data defaults and CLI loaders.
	//! Authoring tree — render() returns a node; the runtime lowers to HTML/SVG.
	//! Raw markup is available only through the explicit Html() node.
	/** Editing masters; source capture precision and color space remain unchanged. */
	const PRORES_MASTER_ENCODING = {
		format: "mov",
		capture: { intermediate: "png" },
		video: {
			codec: "prores",
			quality: "very-high",
			alpha: "discard"
		},
		audio: {
			codec: "aac",
			quality: "high"
		}
	};
	const PRORES_MASTER_ALPHA_ENCODING = {
		...PRORES_MASTER_ENCODING,
		video: {
			...PRORES_MASTER_ENCODING.video,
			alpha: "keep"
		}
	};
	//! Cortex task material. Not an Ops operation and not an export bundle.
	//! Untrusted JSON becomes a bundle only through parseCortexBundle.
	const EDITORIAL_INTENTS = [
		"decision_support",
		"status",
		"explanation",
		"memory"
	];
	const EDITORIAL_AUDIENCES = [
		"owner",
		"team",
		"public"
	];
	const VISUAL_ATOM_KINDS = [
		"metric",
		"series",
		"event",
		"table",
		"entity",
		"relation",
		"text",
		"image",
		"video",
		"code",
		"geo",
		"duration",
		"status",
		"evidence"
	];
	const CORTEX_ASSET_KINDS = [
		"image",
		"video",
		"file"
	];
	const INTENTS = new Set(EDITORIAL_INTENTS);
	const AUDIENCES = new Set(EDITORIAL_AUDIENCES);
	const ATOM_KIND_SET = new Set(VISUAL_ATOM_KINDS);
	const ASSET_KIND_SET = new Set(CORTEX_ASSET_KINDS);
	function googleFont(spec) {
		return {
			kind: "google",
			spec
		};
	}
	//! SuperImg Types - Core type definitions
	//! Explicit, typed, self-documenting interfaces for templates, rendering, and playback
	//! Canonical deterministic media definitions and authoring helpers.
	//!
	//! `video()`, `image()`, `svg()`, and `ogImage()` are the concise authoring
	//! surface. They all lower to the same `MediaDefinition` returned by `define()`.
	//! Delivery destinations and file paths are deliberately absent from this layer.
	function define(input) {
		const medium = input.medium ?? "html";
		const config = input.config;
		const hasResolve = typeof input.resolve === "function";
		const animated = !!config && typeof config.fps === "number" && (config.duration != null || hasResolve);
		return {
			kind: "media",
			media: medium === "svg" ? "svg" : animated ? "video" : "image",
			fallbackFormat: medium === "svg" ? "svg" : animated ? "mp4" : "png",
			medium,
			animated,
			render: input.render,
			...config !== void 0 ? { config } : {},
			...input.sample !== void 0 ? { sample: input.sample } : {},
			...input.resolve !== void 0 ? { resolve: input.resolve } : {},
			...input.editions !== void 0 ? { editions: input.editions } : {},
			...input.variants !== void 0 ? { variants: input.variants } : {},
			..."poster" in input && input.poster !== void 0 ? { poster: input.poster } : {}
		};
	}
	function recipeConfig(input, defaults) {
		const size = input.size ?? defaults;
		return {
			width: size.width,
			height: size.height,
			...input.fonts !== void 0 ? { fonts: input.fonts } : {},
			...input.inlineCss !== void 0 ? { inlineCss: input.inlineCss } : {},
			...input.stylesheets !== void 0 ? { stylesheets: input.stylesheets } : {},
			...input.tailwind !== void 0 ? { tailwind: input.tailwind } : {},
			...input.readiness !== void 0 ? { readiness: input.readiness } : {},
			...input.assets !== void 0 ? { assets: input.assets } : {},
			...input.nativeModuleSets !== void 0 ? { nativeModuleSets: input.nativeModuleSets } : {},
			...input.background !== void 0 ? { background: input.background } : {},
			...input.watermark !== void 0 ? { watermark: input.watermark } : {},
			...input.audio !== void 0 ? { audio: input.audio } : {}
		};
	}
	/** Concise animated-media recipe. Defaults to 1920x1080 at 30 fps. */
	function video(input) {
		const config = {
			...recipeConfig(input, {
				width: 1920,
				height: 1080
			}),
			fps: input.fps ?? 30,
			duration: input.duration,
			temporal: input.temporal ?? "once"
		};
		return define({
			...input,
			medium: "html",
			config
		});
	}
	//! Shared execution controls for bounded, cancellable render work.
	//! Result types and structured errors
	//! Discriminated unions for async operations with actionable error messages
	//! Player input guards shared across packages.
	//! Canonical PlayerOptions / PlayerEvents live in @superimg/player.
	//! MediaIR — experimental draft intermediate representation between authoring and render.
	//! Browser-safe contracts only (no DOM/Node types).
	/** Placeholder 64-char hex for stub hashes (not real content digests). */
	const MEDIA_IR_STUB_HASH = "a".repeat(64);
	//! Public, value-first runtime contracts.
	//!
	//! These types deliberately contain no source paths, host identities, URLs,
	//! filesystem handles, Buffer, or Blob. Hosts may associate an authored value
	//! with their own identity before or after invoking the runtime.
	//! Deterministic collection authoring contracts.
	//!
	//! A collection runs one media definition against a complete, finite entry
	//! snapshot. Entry providers are server-only and are projected out before any
	//! browser program is bundled.
	//! SuperImg Types - Pure TypeScript type definitions
	//! Core types, interfaces, and error classes for templates, rendering, and playback

// examples/basics/hello-world/hello-world.media.ts
	const PAPER = "#F1EBE1";
	const INK = "#17140F";
	const COOL = "#1B4A9B";
	const SANS = "'Archivo', 'Helvetica Neue', system-ui, sans-serif";
	const MONO = "'IBM Plex Mono', ui-monospace, monospace";
	var hello_world_media_default = video({
		duration: "5.5s",
		fonts: [googleFont("Archivo:wght@500;800"), googleFont("IBM+Plex+Mono:wght@400;500")],
		sample: {
			title: "Hello, world",
			accent: "#E2452B"
		},
		render(ctx) {
			const { std, width, height, data } = ctx;
			const { title, accent } = data;
			const t = ctx.director({
				enter: "18%",
				hold: "66%",
				exit: "16%"
			});
			const s = Math.min(width / 1920, height / 1080);
			const px = (value) => Math.round(value * s);
			const margin = Math.round(width * .115);
			const barSpan = Math.round(width * .4);
			const barHeight = Math.round(height * .014);
			const warm = t.tween(0, 1, {
				id: "ink.warm",
				during: "enter",
				at: "0%",
				for: "44%",
				easing: "easeOutQuint"
			});
			const cool = t.tween(0, 1, {
				id: "ink.cool",
				during: "enter",
				at: "12%",
				for: "44%",
				easing: "easeOutQuint"
			});
			const label = t.motion({
				id: "slug",
				during: "enter",
				at: "6%",
				for: "26%",
				y: -12
			});
			const hero = t.motion({
				id: "title",
				during: "enter",
				at: "22%",
				for: "34%",
				y: 34
			});
			const note = t.motion({
				id: "note",
				during: "enter",
				at: "46%",
				for: "30%",
				y: 16
			});
			const part = std.interpolate(t.in("exit"), [0, .8], [0, 1], "easeInCubic");
			const inkOpacity = 1 - std.interpolate(t.in("exit"), [.3, 1], [0, 1], "easeInCubic");
			return Frame({
				id: "stage",
				width,
				height
			}, Fill({ color: PAPER }), Frame({
				id: "trim",
				x: margin - px(56),
				y: 0,
				width: 2,
				height
			}, Fill({ color: std.color.alpha(INK, .1) })), Stack({
				id: "page",
				width: "fill",
				height: "fill",
				justify: "center",
				pad: { x: margin },
				gap: 10
			}, Text({
				id: "slug",
				variant: "label",
				size: px(22),
				weight: 500,
				color: std.color.alpha(INK, .5),
				letterSpacing: px(3),
				fontFamily: MONO,
				motion: label
			}, "hello-world.media.ts"), Text({
				id: "title",
				variant: "display",
				size: px(156),
				weight: 800,
				color: INK,
				letterSpacing: px(-6),
				lineHeight: 1.02,
				maxWidth: width - margin * 2,
				fontFamily: SANS,
				motion: hero
			}, title), Frame({
				id: "rule",
				width: "fill",
				height: Math.round(barHeight * 4.2)
			}, Fill({
				id: "ink-warm",
				x: -part * 44,
				y: barHeight,
				width: Math.max(2, Math.round(barSpan * warm)),
				height: barHeight,
				color: accent,
				opacity: inkOpacity
			}), Fill({
				id: "ink-cool",
				x: Math.round(barSpan * .24) + part * 44,
				y: Math.round(barHeight * 1.9),
				width: Math.max(2, Math.round(barSpan * .62 * cool)),
				height: barHeight,
				color: COOL,
				opacity: inkOpacity,
				blendMode: "multiply"
			})), Text({
				id: "note",
				variant: "body",
				size: px(30),
				weight: 400,
				color: std.color.alpha(INK, .62),
				fontFamily: MONO,
				motion: note
			}, "one file · a function of time · any destination")));
		}
	});

// \0superimg-selection:/Users/fox/src/nine-gen/superimg-public/examples/basics/hello-world/hello-world.media.ts
	const selected = hello_world_media_default?.kind === "media" ? (function selectMediaDefinition(media, options = {}) {
		const variantId = options.variantId ?? "default";
		const patch = variantId === "default" ? void 0 : media.variants?.[variantId];
		if (variantId !== "default" && patch === void 0) throw new TypeError(`Unknown media variant ${JSON.stringify(variantId)}`);
		const editionId = options.editionId ?? "default";
		const edition = editionId === "default" ? void 0 : media.editions?.[editionId];
		if (editionId !== "default" && edition === void 0) throw new TypeError(`Unknown media edition ${JSON.stringify(editionId)}`);
		const sample = Object.freeze({
			...options.entryData ?? {
				...media.sample ?? {},
				...options.data ?? {}
			},
			...patch ?? {}
		});
		return {
			...media,
			sample,
			...edition === void 0 ? {} : {
				render: edition.render ?? media.render,
				config: {
					...media.config,
					width: edition.size.width,
					height: edition.size.height
				}
			}
		};
	})(hello_world_media_default, {}) : { ...hello_world_media_default };
	Object.defineProperty(selected, "mediaCapabilities", {
		value: {
			"version": 0,
			"names": [
				"color",
				"interpolate",
				"fonts"
			]
		},
		enumerable: true,
		configurable: true,
		writable: true
	});

exports.default = selected;
return exports;
})({});
//# sourceMappingURL=hello-world.media.js.map