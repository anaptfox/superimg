import type { ReactNode } from "react";
import SuperImgPlayer from "./SuperImgPlayer";
import type { TemplateVariant } from "../lib/templates";

type DocExplainerProps = {
  variant: TemplateVariant;
  label?: string;
  children?: ReactNode;
};

/** Compact inline preview — children are optional (prose usually lives in Astro). */
export default function DocExplainer({ variant, label, children }: DocExplainerProps) {
  return (
    <div className="doc-explainer">
      {children ? <div className="doc-explainer-copy">{children}</div> : null}
      <div className="doc-explainer-player">
        <SuperImgPlayer
          variant={variant}
          label={label}
          format="horizontal"
          playbackMode="loop"
          loadMode="lazy"
          hoverBehavior="play"
          hoverDelayMs={150}
        />
      </div>
    </div>
  );
}