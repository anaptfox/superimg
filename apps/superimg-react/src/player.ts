//! SuperImg React Player - SSR-safe entry point
//! Only exports the Player component and its types.
//! Import from "superimg-react/player" instead of "superimg-react" for SSR compatibility.

export { Player, type PlayerProps, type PlayerRef } from "./components/Player.js";

export type {
  RenderContext,
  TemplateModule,
  TemplateConfig,
  PlayerInput,
  PlaybackMode,
  LoadMode,
  HoverBehavior,
  LoadResult,
} from "superimg/player";
