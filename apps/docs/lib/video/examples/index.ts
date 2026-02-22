import { HELLO_WORLD, ANIMATED_TEXT, GRADIENT } from "./basics";
import { STAR_HISTORY, NPM_STATS, BENCHMARK, TIMELINE } from "./charts";
import { TESTIMONIALS, MILESTONE, MRR, WEEKLY_SCHEDULE, TWITTER_POST } from "./social";
import { CODE_TYPEWRITER, GIT_DIFF, TERMINAL, GIT_BRANCH, GITHUB_README, CHANGELOG } from "./developer";
import { PRODUCT_HUNT, YEAR_IN_REVIEW, COUNTDOWN, LOGO_ANIMATION, PERSONALIZED_VIDEO } from "./marketing";

export interface EditorExample {
  id: string;
  title: string;
  category: "getting-started" | "marketing" | "social" | "data" | "developer";
  code: string;
}

export const EXAMPLE_CATEGORIES = [
  { id: "getting-started", title: "Getting Started" },
  { id: "marketing", title: "Marketing" },
  { id: "social", title: "Social" },
  { id: "data", title: "Data" },
  { id: "developer", title: "Developer" },
] as const;

export const EDITOR_EXAMPLES: EditorExample[] = [
  // Getting Started
  { id: "hello-world", title: "Hello World", category: "getting-started", code: HELLO_WORLD },
  { id: "animated-text", title: "Animated Text", category: "getting-started", code: ANIMATED_TEXT },
  { id: "gradient", title: "Gradient Background", category: "getting-started", code: GRADIENT },

  // Marketing
  { id: "product-hunt", title: "Product Hunt Launch Card", category: "marketing", code: PRODUCT_HUNT },
  { id: "year-in-review", title: "Year in Review / Wrapped", category: "marketing", code: YEAR_IN_REVIEW },
  { id: "countdown", title: "Countdown Timer", category: "marketing", code: COUNTDOWN },
  { id: "logo-animation", title: "Logo Animation", category: "marketing", code: LOGO_ANIMATION },
  { id: "personalized-video", title: "Personalized Video", category: "marketing", code: PERSONALIZED_VIDEO },

  // Social
  { id: "testimonials", title: "Testimonial Wall", category: "social", code: TESTIMONIALS },
  { id: "milestone", title: "Follower Milestone", category: "social", code: MILESTONE },
  { id: "mrr", title: "MRR Counter", category: "social", code: MRR },
  { id: "weekly-schedule", title: "Weekly Schedule", category: "social", code: WEEKLY_SCHEDULE },
  { id: "twitter-post", title: "Twitter/X Post Animation", category: "social", code: TWITTER_POST },

  // Data
  { id: "star-history", title: "Star History", category: "data", code: STAR_HISTORY },
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

export const getExamplesByCategory = (cat: string) =>
  EDITOR_EXAMPLES.filter((e) => e.category === cat);

export const getExampleById = (id: string) =>
  EDITOR_EXAMPLES.find((e) => e.id === id);
