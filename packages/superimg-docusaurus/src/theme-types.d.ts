/**
 * Ambient types for Docusaurus theme aliases provided by @superimg/docusaurus.
 * Consumers get these when the package is installed (TypeScript project references
 * or `compilerOptions.types` / module resolution of the package).
 */
declare module "@theme/SuperImgPlayer" {
  import type { ComponentType, CSSProperties, ReactNode } from "react";
  import type { PlayerProps } from "@foxworth/superimg/react/player";

  export type SuperImgPlayerProps = Omit<PlayerProps, "ref"> & {
    /** Optional corner label over the frame. */
    label?: string;
    /** SSR / pre-hydration fallback. @default "Loading preview…" */
    fallbackText?: string;
    className?: string;
    frameStyle?: CSSProperties;
  };

  const SuperImgPlayer: ComponentType<SuperImgPlayerProps>;
  export default SuperImgPlayer;
}

declare module "@theme/AnimatedFigure" {
  import type { ComponentType, ReactNode } from "react";
  import type { PlayerInput } from "@foxworth/superimg/react/player";

  export type AnimatedFigureProps = {
    title: string;
    children: ReactNode;
    media: PlayerInput;
    label?: string;
  };

  const AnimatedFigure: ComponentType<AnimatedFigureProps>;
  export default AnimatedFigure;
}
