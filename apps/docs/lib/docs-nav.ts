export interface NavItem {
  title: string
  slug: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/**
 * User-facing docs IA: Author (default) · Embed · Extend.
 * Every slug must have content/docs/<slug>.mdx.
 */
export const docsNav: NavSection[] = [
  {
    title: 'Author',
    items: [
      { title: 'Introduction', slug: 'introduction' },
      { title: 'Getting Started', slug: 'getting-started' },
      { title: 'Concepts', slug: 'concepts' },
      { title: 'Animation Basics', slug: 'animation' },
      { title: 'Timing With Director And Tracks', slug: 'timing' },
      { title: 'Data And Formats', slug: 'data-and-formats' },
      { title: 'CLI', slug: 'cli' },
      { title: 'Determinism', slug: 'determinism' },
      { title: 'Comparison', slug: 'comparison' },
    ],
  },
  {
    title: 'Embed',
    items: [
      { title: 'Player', slug: 'player' },
      { title: 'Browser Inspection', slug: 'inspection' },
      { title: 'Embed In Apps', slug: 'embed-in-apps' },
      { title: 'Interactive Scenes', slug: 'semantic-scenes' },
      { title: 'Interactive Guides', slug: 'scene-guide' },
    ],
  },
  {
    title: 'Extend',
    items: [
      { title: 'How It Works', slug: 'how-it-works' },
      { title: 'Surfaces', slug: 'package-surface' },
      { title: 'Runtime & Interactions', slug: 'node-api' },
    ],
  },
]

export function getAllDocSlugs(): string[][] {
  return docsNav.flatMap((section) =>
    section.items.map((item) => item.slug.split('/'))
  )
}
