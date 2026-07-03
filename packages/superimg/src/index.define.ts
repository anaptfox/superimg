//! Node-free template authoring entry — define helpers + types only.
//! Safe for Gumbo scene subprocess alias (gumbo/media → superimg/define).

export { define, defineConfig, defineBatch } from "@superimg/types";

export type {
  DefineInput,
  DefineHtmlAnimatedInput,
  DefineHtmlStaticInput,
  DefineSvgAnimatedInput,
  DefineSvgStaticInput,
  TemplateConfig,
  ProjectConfig,
  BatchEntry,
  BatchProvider,
  ImageRenderContext,
  SvgRenderContext,
  SvgAnimatedRenderContext,
  AnimatedTemplateModule,
  StaticTemplateModule,
  TemplateModule,
  TailwindConfig,
  AssetDeclaration,
} from "@superimg/types";