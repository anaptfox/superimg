import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/explainer">
            See inline explainers →
          </Link>
          <Link
            className="button button--secondary button--lg margin-left--sm"
            to="/docs/player"
          >
            Integration guide
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Home"
      description="SuperImg Player embedded in Docusaurus documentation"
    >
      <HomepageHeader />
      <main className="container margin-vert--xl">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <p style={{ fontSize: "1.05rem", lineHeight: 1.7, textAlign: "center" }}>
              This example keeps video previews in <strong>MDX docs</strong> — inline next to
              explanations — not as a marketing hero. Open the explainer doc to see hover-to-play
              loops paired with prose.
            </p>
          </div>
        </div>
      </main>
    </Layout>
  );
}