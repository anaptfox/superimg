import { HELLO_WORLD, ANIMATED_TEXT, GRADIENT, COMPLETE_TEMPLATE } from "./basics";
import { STAR_HISTORY, NPM_STATS, BENCHMARK, TIMELINE } from "./charts";
import { TESTIMONIALS, MILESTONE, MRR, WEEKLY_SCHEDULE, TWITTER_POST } from "./social";
import { CODE_TYPEWRITER, GIT_DIFF, TERMINAL, GIT_BRANCH, GITHUB_README, CHANGELOG } from "./developer";
import { PRODUCT_HUNT, YEAR_IN_REVIEW, COUNTDOWN, LOGO_ANIMATION, PERSONALIZED_VIDEO } from "./marketing";
import { TEMPLATE_EXAMPLES } from "./from-templates";

export type ExampleCategoryId =
  | "basics"
  | "marketing"
  | "events"
  | "social"
  | "interfaces"
  | "data"
  | "vector"
  | "developer";

export interface EditorExample {
  id: string;
  title: string;
  category: ExampleCategoryId;
  code: string;
}

export const EXAMPLE_CATEGORIES = [
  { id: "basics", title: "Basics" },
  { id: "marketing", title: "Marketing" },
  { id: "events", title: "Events" },
  { id: "social", title: "Social" },
  { id: "interfaces", title: "Interfaces" },
  { id: "data", title: "Data" },
  { id: "vector", title: "Vector" },
  { id: "developer", title: "Developer" },
] as const satisfies ReadonlyArray<{ id: ExampleCategoryId; title: string }>;

// Existing examples (from string literals in this repo)
const BUILTIN_EXAMPLES: EditorExample[] = [
  // Basics
  { id: "complete-template", title: "Complete Template (config + defaults)", category: "basics", code: COMPLETE_TEMPLATE },
  { id: "hello-world", title: "Hello World", category: "basics", code: HELLO_WORLD },
  { id: "animated-text", title: "Animated Text", category: "basics", code: ANIMATED_TEXT },
  { id: "gradient", title: "Gradient Background", category: "basics", code: GRADIENT },

  // Marketing
  { id: "product-hunt", title: "Product Hunt Launch Card", category: "marketing", code: PRODUCT_HUNT },
  { id: "year-in-review", title: "Year in Review / Wrapped", category: "marketing", code: YEAR_IN_REVIEW },
  { id: "countdown", title: "Countdown Timer", category: "marketing", code: COUNTDOWN },
  { id: "logo-animation", title: "Logo Animation", category: "marketing", code: LOGO_ANIMATION },
  { id: "personalized-video", title: "Personalized Video", category: "marketing", code: PERSONALIZED_VIDEO },
  { id: "testimonials", title: "Testimonial Wall", category: "marketing", code: TESTIMONIALS },

  // Events
  { id: "weekly-schedule", title: "Weekly Schedule", category: "events", code: WEEKLY_SCHEDULE },

  // Social
  { id: "milestone", title: "Follower Milestone", category: "social", code: MILESTONE },
  { id: "twitter-post", title: "Twitter/X Post Animation", category: "social", code: TWITTER_POST },

  // Data
  { id: "star-history", title: "Star History", category: "data", code: STAR_HISTORY },
  { id: "mrr", title: "MRR Counter", category: "data", code: MRR },
  { id: "npm-stats", title: "NPM Downloads", category: "data", code: NPM_STATS },
  { id: "benchmark", title: "Benchmark Bars", category: "data", code: BENCHMARK },
  { id: "timeline", title: "Animated Timeline", category: "data", code: TIMELINE },

  // Developer
  { id: "code-typewriter", title: "Code Typewriter", category: "developer", code: CODE_TYPEWRITER },
  { id: "git-diff", title: "Git Diff", category: "developer", code: GIT_DIFF },
  { id: "terminal", title: "Terminal Session", category: "developer", code: TERMINAL },
  { id: "git-branch", title: "Git Branch", category: "developer", code: GIT_BRANCH },
  { id: "github-readme", title: "GitHub README Animation", category: "developer", code: GITHUB_README },
  { id: "changelog", title: "Changelog/Release Notes", category: "developer", code: CHANGELOG },
];

// Merge: templates from examples/<category>/ folders take precedence over built-in
const templateIds = new Set(TEMPLATE_EXAMPLES.map((t) => t.id));
const filteredBuiltin = BUILTIN_EXAMPLES.filter((e) => !templateIds.has(e.id));

export const EDITOR_EXAMPLES: EditorExample[] = [
  ...TEMPLATE_EXAMPLES,
  ...filteredBuiltin,
];

export const getExamplesByCategory = (cat: string) =>
  EDITOR_EXAMPLES.filter((e) => e.category === cat);

export const getExampleById = (id: string) =>
  EDITOR_EXAMPLES.find((e) => e.id === id);
