import BrowserOnly from "@docusaurus/BrowserOnly";
import { Player, type PlayerProps } from "superimg/react";
import styles from "./SuperImgPlayer.module.css";

type SuperImgPlayerProps = Omit<PlayerProps, "ref"> & {
  label?: string;
};

export default function SuperImgPlayer({ label, ...props }: SuperImgPlayerProps) {
  return (
    <div className={styles.frame}>
      {label ? <div className={styles.label}>{label}</div> : null}
      <BrowserOnly fallback={<div className={styles.fallback}>Loading preview…</div>}>
        {() => <Player {...props} style={{ width: "100%", height: "100%", ...props.style }} />}
      </BrowserOnly>
    </div>
  );
}