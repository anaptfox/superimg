import { Player, type PlayerProps } from "superimg/react";
import { templateFor, type TemplateVariant } from "../lib/templates";

export type SuperImgPlayerProps = Omit<PlayerProps, "template" | "ref"> & {
  variant: TemplateVariant;
  label?: string;
};

export default function SuperImgPlayer({
  variant,
  label,
  ...props
}: SuperImgPlayerProps) {
  return (
    <div className="player-frame">
      {label ? <div className="player-label">{label}</div> : null}
      <Player
        template={templateFor(variant)}
        style={{ width: "100%", height: "100%", ...props.style }}
        {...props}
      />
    </div>
  );
}