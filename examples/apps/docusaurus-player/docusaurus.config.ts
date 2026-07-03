import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "SuperImg × Docusaurus",
  tagline: "Inline video explainers in MDX documentation",
  favicon: "img/favicon.ico",
  url: "https://superimg.dev",
  baseUrl: "/",
  organizationName: "anaptfox",
  projectName: "superimg",
  onBrokenLinks: "throw",
  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/anaptfox/superimg/tree/main/examples/apps/docusaurus-player/",
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    function superimgWebpackPlugin() {
      return {
        name: "superimg-webpack",
        configureWebpack(_config, isServer) {
          if (isServer) return {};
          return {
            experiments: { asyncWebAssembly: true },
          };
        },
      };
    },
  ],

  themeConfig: {
    navbar: {
      title: "SuperImg",
      logo: { alt: "SuperImg", src: "img/logo.svg" },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        { to: "/docs/explainer", label: "Explainers", position: "left" },
        {
          href: "https://github.com/anaptfox/superimg",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Introduction", to: "/docs/intro" },
            { label: "Inline explainers", to: "/docs/explainer" },
            { label: "Player in MDX", to: "/docs/player" },
          ],
        },
        {
          title: "SuperImg",
          items: [
            { label: "superimg.dev", href: "https://superimg.dev" },
            { label: "GitHub", href: "https://github.com/anaptfox/superimg" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} SuperImg. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;