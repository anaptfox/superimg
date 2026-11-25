import type { StaticStdlib } from "./stdlib.js";
import type { StdlibCapability } from "./stdlib-capability-types.js";

/** Install one optional pack into a specific session-local stdlib instance. */
export async function applyStdlibCapability(
  target: StaticStdlib,
  capability: StdlibCapability,
): Promise<void> {
  if (capability === "math") {
    const math = await import("@superimg/stdlib/math");
    target.math = Object.fromEntries(
      Object.entries(math).filter(([key]) => key !== "lerp"),
    ) as StaticStdlib["math"];
  } else if (capability === "color") {
    const [color, interpolation] = await Promise.all([
      import("@superimg/stdlib/color"),
      import("@superimg/stdlib/interpolate"),
    ]);
    target.color = color;
    target.interpolateColor = interpolation.interpolateColor;
  } else if (capability === "date") {
    target.date = await import("@superimg/stdlib/date");
  } else if (capability === "text") {
    target.text = await import("@superimg/stdlib/text");
  } else if (capability === "layout") {
    target.layout = await import("@superimg/stdlib/layout");
  } else if (capability === "svg") {
    Object.assign(target.svg, await import("@superimg/stdlib/svg/base"));
  } else if (capability === "viz") {
    Object.assign(target.viz, await import("@superimg/stdlib/viz"));
  } else if (capability === "subtitle") {
    target.subtitle = await import("@superimg/stdlib/subtitle");
  } else if (capability === "backgrounds") {
    target.backgrounds = await import("@superimg/stdlib/backgrounds");
  } else if (capability === "montage") {
    target.montage = (await import("@superimg/stdlib/montage")).montage;
  } else if (capability === "path") {
    const module = await import("@superimg/stdlib/path");
    target.path = Object.assign(module.path.bind(undefined), {
      parse: module.createMotionPath,
    }) as StaticStdlib["path"];
  } else if (capability === "reveal") {
    target.reveal = (await import("@superimg/stdlib/reveal")).revealFx;
  } else if (capability === "responsive") {
    const module = await import("@superimg/stdlib/responsive");
    target.responsive = module;
    target.createResponsive = module.createResponsive;
  } else if (capability === "carousel") {
    target.carousel = (await import("@superimg/stdlib/carousel")).carousel;
  } else if (capability === "stack") {
    target.stack = (await import("@superimg/stdlib/stack")).stack;
  } else if (capability === "spring") {
    target.spring = (await import("@superimg/stdlib/spring")).spring;
  } else if (capability === "stagger") {
    target.stagger = (await import("@superimg/stdlib/stagger")).stagger;
  } else if (capability === "timing") {
    target.timing = (await import("@superimg/stdlib/timing")).timing;
  } else if (capability === "phases") {
    target.phases = (await import("@superimg/stdlib/phase-recipes")).phases;
  } else if (capability === "motion") {
    target.motion = (await import("@superimg/stdlib/motion-presets")).motion;
  } else if (capability === "safe-area") {
    const module = await import("@superimg/stdlib/safe-area");
    target.safeArea = module.getSafeArea;
    target.safeBox = module.getSafeBox;
  } else if (capability === "oscillate") {
    const module = await import("@superimg/stdlib/oscillate");
    target.oscillate = module.oscillate;
    target.loop = module.loop;
    target.pingpong = module.pingpong;
    target.wiggle = module.wiggle;
  } else if (capability === "ready") {
    target.ready = (await import("@superimg/stdlib/ready")).ready;
  } else if (capability === "layout-timeline") {
    target.layoutTimeline = (await import("@superimg/stdlib/layout-timeline")).layoutTimeline;
  } else if (capability === "interpolate") {
    target.interpolate = (await import("@superimg/stdlib/interpolate-number")).interpolate;
  } else if (capability === "code") {
    target.code = await import("@superimg/stdlib/code");
  } else if (capability === "rough") {
    target.svg.rough = await import("@superimg/stdlib/svg/rough");
  } else if (capability === "three") {
    // Kept for existing programs and artifacts. New authoring uses an
    // ordinary NativeSurface module and the public viz type omits this helper.
    Object.assign(target.viz, { three: await import("@superimg/stdlib/compat/three") });
  } else if (capability === "lottie") {
    const module = await import("@superimg/stdlib/viz/lottie");
    Object.assign(target.viz, {
      lottie: module.lottie,
      lottieApi: module,
      lottieDurationFrames: module.durationFrames,
      lottieDurationSeconds: module.durationSeconds,
      LOTTIE_VERSION: module.LOTTIE_VERSION,
      LOTTIE_MODULE_LIGHT: module.LOTTIE_MODULE_LIGHT,
      LOTTIE_MODULE_FULL: module.LOTTIE_MODULE_FULL,
    });
  } else if (capability === "mermaid") {
    const module = await import("@superimg/stdlib/viz/mermaid");
    target.viz.mermaid = module.mermaid;
  } else if (capability === "katex") {
    const module = await import("@superimg/stdlib/viz/katex");
    Object.assign(target.viz, {
      equation: module.equation,
      equationSteps: module.equationSteps,
      equationMatch: module.equationMatch,
      parseEquationSteps: module.parseEquationSteps,
      katexCss: module.css,
      katex: module,
    });
  } else {
    capability satisfies never;
  }
}
