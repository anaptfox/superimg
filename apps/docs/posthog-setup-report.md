<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the SuperImg docs/playground site. Here's a summary of all changes made:

- **`instrumentation-client.ts`** (new file): Initializes PostHog client-side using the recommended Next.js 15.3+ approach. Configured with a reverse proxy (`/ingest`), exception capture, and debug mode in development.
- **`next.config.js`**: Added PostHog reverse proxy rewrites (`/ingest/static/*` and `/ingest/*`) and `skipTrailingSlashRedirect: true` to reduce tracking blocker interference.
- **`apps/docs/.env.local`**: Added `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` environment variables (never hardcoded in source files).

## Events instrumented

| Event | Description | File |
|---|---|---|
| `hero_install_command_copied` | User copies the install command from the Hero section | `components/landing/Hero.tsx` |
| `hero_package_manager_selected` | User selects a package manager tab (npx, pnpm, bun, deno) | `components/landing/Hero.tsx` |
| `docs_get_started_clicked` | User clicks the "Get started" CTA — top of conversion funnel | `components/landing/Hero.tsx` |
| `github_link_clicked` | User clicks the GitHub link in the top nav (desktop or mobile) | `components/landing/TopNav.tsx` |
| `playground_category_filtered` | User filters templates by category in the playground grid | `components/playground/TemplateGrid.tsx` |
| `template_card_clicked` | User clicks a template card to open it in the editor | `components/playground/TemplateCard.tsx` |
| `example_selected_in_editor` | User selects an example from the panel inside the editor | `components/Editor.tsx` |
| `editor_code_copied` | User copies the current template code via the Copy button | `components/Editor.tsx` |
| `examples_format_changed` | User changes video format in the reels examples view | `app/examples/page.tsx` |
| `example_opened_in_playground` | User clicks "View Code" to open an example in the editor | `app/examples/page.tsx` |
| `editor_compile_error` | Template code compile error (pre-existing) | `components/Editor.tsx` |
| `editor_code_changed` | Template code edited (pre-existing) | `components/Editor.tsx` |
| `editor_export_started` | User starts a video export (pre-existing) | `components/Editor.tsx` |
| `editor_export_completed` | Video export completed successfully (pre-existing) | `components/Editor.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/331663/dashboard/1331306
- **Developer acquisition funnel** (Get Started → Template click → Export): https://us.posthog.com/project/331663/insights/PlrdMfme
- **Landing page CTAs** (install copies, docs clicks, GitHub clicks): https://us.posthog.com/project/331663/insights/RAyK9EKA
- **Editor engagement** (code changes, copies, exports): https://us.posthog.com/project/331663/insights/KIUh2itn
- **Template discovery** (grid clicks, editor panel, reels): https://us.posthog.com/project/331663/insights/B7Ff6ueY
- **Package manager preference** (breakdown by npx/pnpm/bun/deno): https://us.posthog.com/project/331663/insights/vxMExtnc

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
