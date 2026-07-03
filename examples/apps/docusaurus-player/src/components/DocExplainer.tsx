import type { ReactNode } from "react";
import type { PlayerInput } from "superimg/react";
import SuperImgPlayer from "@site/src/components/SuperImgPlayer";
import styles from "./DocExplainer.module.css";

type DocExplainerProps = {
  title: string;
  children: ReactNode;
  template: PlayerInput;
  label?: string;
};

/** Inline docs explainer — prose on the left, compact loop preview on the right. */
export default function DocExplainer({
  title,
  children,
  template,
  label,
}: DocExplainerProps) {
  return (
    <div className={styles.explainer}>
      <div className={styles.copy}>
        <h4>{title}</h4>
        <div>{children}</div>
      </div>
      <div className={styles.player}>
        <SuperImgPlayer
          template={template}
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