# SuperImg Justfile

# Root directory of the monorepo (where this Justfile lives)
root := justfile_directory()

# Default recipe lists available commands
default:
    @just --list

# === Setup ===

# First-time setup: install deps + rebuild all packages (clean + build)
setup:
    @gum spin --spinner dot --title "Installing dependencies..." -- just install
    @gum spin --spinner dot --title "Building all packages..." -- just rebuild
    @gum style --foreground 212 "✓ Setup complete! You're ready to go."

# Install all dependencies
install:
    cd "{{root}}" && pnpm install

# === Development ===

# Start all packages in dev/watch mode
dev:
    cd "{{root}}" && pnpm run dev

# Generate playground examples from examples/<category>/
generate-examples:
    cd "{{root}}" && npx tsx scripts/generate-examples.ts

# Scaffold a Scene Studio artwork under apps/scene-studio/src/artworks/<name>/
new-artwork name:
    cd "{{root}}" && npx tsx scripts/new-artwork.ts {{name}}

# Start the docs site (port 3001) with Turbo-managed dependencies
docs:
    cd "{{root}}" && pnpm run build:docs
    cd "{{root}}" && pnpm --filter docs run dev

# Run an example by name
example name:
    cd "{{root}}/examples/{{name}}" && pnpm run dev

# Build a specific package
build-pkg name:
    cd "{{root}}" && pnpm --filter "*{{name}}*" run build

# Dev/watch a specific package
dev-pkg name:
    cd "{{root}}" && pnpm --filter "*{{name}}*" run dev

# Test a specific package (name = directory under packages/, e.g. superimg-core)
test-pkg name:
    cd "{{root}}/packages/{{name}}" && pnpm run test

# === Media stack (CLI / check / inspect / export) ===
# Dependency order (turbo --filter=@foxworth/superimg-cli... walks deps):
#   types → stdlib → core → playwright → node → cli
#   (+ superimg umbrella when assembling public bin)
#
# Agents: after editing ANY of those packages, run `just build-render` before
# `node packages/superimg-cli/dist/cli.js …`. Do NOT build only one package —
# stale dist is the usual "my flag/encoder change did nothing" failure.

# Build render stack in dependency order (turbo filter)
build-render:
    cd "{{root}}" && pnpm run build:render

# Inspect an already-mounted live browser (does not build, launch, or reload).
browser-inspect *args:
    cd "{{root}}" && node --import tsx scripts/browser-inspection/cli.ts {{args}}

# Run the shared value-runtime contract in Node, Chromium, and workerd.
test-runtime: build-render
    cd "{{root}}" && pnpm --filter @superimg/core test -- runtime/runtime.test.ts
    cd "{{root}}" && pnpm --filter @superimg/runtime-conformance test
    cd "{{root}}" && pnpm --filter @superimg/runtime-conformance test:browser
    cd "{{root}}" && pnpm --filter @superimg/runtime-conformance test:edge-resolution
    cd "{{root}}" && pnpm --filter @superimg/runtime-conformance test:edge

# Run Boundary-native project interaction and publication proofs.
test-interactions: build-render
    cd "{{root}}" && pnpm --filter @superimg/interactions test

# Pull, pack, vendor, and verify `@foxworth/boundary` directly from GitHub (`anaptfox/boundary`).
vendor-boundary ref="main" repo="anaptfox/boundary":
    cd "{{root}}" && node scripts/vendor-boundary.mjs --ref "{{ref}}" --repo "{{repo}}"

# Clean + rebuild render stack only
rebuild-render:
    cd "{{root}}" && pnpm run rebuild:render

# Ensure render stack is built, then print the monorepo CLI path
cli-path: build-render
    @echo "{{root}}/packages/superimg-cli/dist/cli.js"

# Example: just cli list
#          just cli export path/to/foo.media.ts --for youtube
cli *args: build-render
    cd "{{root}}" && node packages/superimg-cli/dist/cli.js {{args}}

# Validate a retained composition end to end: focused schedule/player tests,
# compiled inspection, and one encoded export. Example is a canonical .media.ts path.
verify-composition example destination="youtube":
    cd "{{root}}" && pnpm run build:render
    cd "{{root}}" && pnpm --filter @superimg/player build
    cd "{{root}}" && pnpm --filter @superimg/core test -- composition/plan.test.ts
    cd "{{root}}" && pnpm --filter @superimg/player test -- src/dom-player.test.ts
    cd "{{root}}" && pnpm --filter @foxworth/superimg-cli test -- composition.e2e.test.ts
    cd "{{root}}" && pnpm --filter @superimg/integration-tests test -- composition-host.e2e.test.ts
    cd "{{root}}" && node packages/superimg-cli/dist/cli.js check "{{example}}"
    cd "{{root}}" && node packages/superimg-cli/dist/cli.js inspect "{{example}}" --pretty
    cd "{{root}}" && node packages/superimg-cli/dist/cli.js export "{{example}}" --for "{{destination}}"

# Compile a short clip to a seekable plate atlas
plate *args: build-render
    cd "{{root}}" && node packages/superimg-cli/dist/cli.js plate {{args}}

# === Quality ===

# Build all packages
build:
    cd "{{root}}" && pnpm run build

# Clean all dist/ artifacts and rebuild everything from scratch
rebuild:
    cd "{{root}}" && pnpm run rebuild

# Run all tests
test:
    cd "{{root}}" && pnpm run test

# Run all tests with coverage
test-coverage:
    cd "{{root}}" && pnpm run test:coverage

# Lint all packages
lint:
    cd "{{root}}" && pnpm run lint

# Type-check every workspace that declares a type-check task
typecheck:
    cd "{{root}}" && pnpm run typecheck

# Clean all build artifacts
clean:
    cd "{{root}}" && pnpm run clean

# Run the authoritative Turbo quality graph
check:
    cd "{{root}}" && pnpm run check

[private]
_spin title task:
    #!/usr/bin/env bash
    tmpfile=$(mktemp)
    trap 'rm -f "$tmpfile"' EXIT
    if gum spin --spinner dot --title "{{ title }}" -- sh -c "just {{ task }} >\"$tmpfile\" 2>&1"; then
        true
    else
        echo ""
        gum style --foreground 196 "✗ {{ title }}"
        echo ""
        cat "$tmpfile"
        exit 1
    fi

# Verify browser virtual modules are built from current sources
verify-browser-virtuals:
    cd "{{root}}/packages/superimg-core" && pnpm run verify:generated

# Gate script for the timing model
verify-timing-redesign scratch="":
    #!/usr/bin/env bash
    set -euo pipefail
    export SCRATCH="{{ if scratch == "" { root + "/verify-timing-scratch" } else { scratch } }}"
    chmod +x "{{root}}/scripts/verify-timing-redesign.sh"
    "{{root}}/scripts/verify-timing-redesign.sh"

# === Release ===
# Publishing is manual-only: run these from a maintainer machine.
# CI never publishes to npm — GitHub Actions are for testing/rendering only.

# Interactive version bump for the public package
bump:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"
    BUMP_TYPE=$(gum choose --header "Bump type?" "patch" "minor" "major")
    echo ""
    just versions
    echo ""
    if gum confirm "Bump superimg ($BUMP_TYPE)?"; then
        cd "$ROOT/packages/superimg" && pnpm version $BUMP_TYPE --no-git-tag-version
        NEW_VERSION=$(cd "$ROOT/packages/superimg" && node -p 'require("./package.json").version')
        cd "$ROOT/packages/superimg-cli" && pnpm version "$NEW_VERSION" --no-git-tag-version
        echo ""
        gum style --foreground 212 "✓ superimg bumped to v$NEW_VERSION!"
        echo ""
        just versions
        echo ""
        # Commit the version bump so the working tree is clean for publish
        cd "$ROOT" && git add packages/superimg/package.json packages/superimg-cli/package.json
        cd "$ROOT" && git commit -m "chore: bump to v$NEW_VERSION"
        cd "$ROOT" && git tag "v$NEW_VERSION"
        gum style --foreground 212 "✓ Committed and tagged v$NEW_VERSION"
    else
        gum style --foreground 196 "Cancelled"
        exit 1
    fi

# Publish the public package to npm (manual-only; runs full check first)
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"

    # Fail fast on auth before anything expensive.
    # npm login sessions last only 2 hours (since Dec 2025).
    if ! npm whoami >/dev/null 2>&1; then
        gum style --foreground 196 "✗ Not authenticated to npm"
        gum style --foreground 99 "Run 'npm login' (sessions expire after 2 hours), then re-run just publish"
        exit 1
    fi
    gum style --foreground 212 "✓ Authenticated as $(npm whoami)"
    echo ""

    # Full check so a standalone `just publish` can never ship a stale dist/
    # (includes package verify scripts such as browser virtual modules)
    just check
    echo ""

    just versions
    echo ""
    if gum confirm "Publish superimg to npm?"; then
        echo "Publishing superimg..."
        cd "$ROOT/packages/superimg" && pnpm publish
        echo ""
        gum style --foreground 212 --bold "✓ superimg published!"
    else
        gum style --foreground 196 "Cancelled"
        exit 1
    fi

# Dry-run publish to see what would be published
publish-dry:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"
    CACHE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/superimg-publish-dry.XXXXXX")"
    trap 'rm -rf "$CACHE_DIR"' EXIT
    echo ""
    just versions
    echo ""
    gum style --foreground 99 "Dry-run: showing what would be published"
    echo ""
    echo "=== superimg ==="
    cd "$ROOT/packages/superimg" && NPM_CONFIG_CACHE="$CACHE_DIR" pnpm publish --dry-run --no-git-checks

# Full release: optionally bump -> publish (publish runs the full check)
release:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"
    
    gum style --border double --align center --width 50 --margin "1" \
        "$(gum style --foreground 212 --bold '🚀 Release Workflow')"
    echo ""
    
    # Show current versions first so user can verify
    just versions
    echo ""
    
    # Ask if user wants to bump (default No for safety when already bumped)
    if gum confirm "Bump versions?" --default=false; then
        just bump
        echo ""
    else
        gum style --foreground 99 "Skipping version bump (using existing versions)"
        echo ""
    fi

    just publish

# === Skills ===

# Install the SuperImg skill via the CLI (after building packages/superimg).
# For end users: `superimg skill install` — see packages/superimg-cli/src/cli/commands/skill/.
skill-dev:
    cd "{{root}}/packages/superimg" && pnpm exec superimg skill install --all-hosts

# Regenerate the Codex plugin's bundled skill
codex-plugin:
    cd "{{root}}" && pnpm --filter @superimg/codex-plugin run build

# Install SuperImg into the local Codex CLI (skill + marketplace registration).
codex-plugin-install:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{root}}"

    if ! command -v codex >/dev/null 2>&1; then
        gum style --foreground 196 "✗ codex CLI not found on PATH"
        echo "Install: https://developers.openai.com/codex/" >&2
        exit 1
    fi

    gum spin --spinner dot --title "Building superimg CLI..." -- \
        pnpm --filter @foxworth/superimg run build

    gum spin --spinner dot --title "Generating plugin..." -- \
        pnpm --filter @superimg/codex-plugin run build

    gum style --foreground 212 "→ Installing skill into ~/.codex/AGENTS.md..."
    node "{{root}}/packages/superimg-cli/dist/cli.js" skill install --host codex --global -y

    gum style --foreground 212 "→ Registering marketplace..."
    if codex plugin marketplace remove anaptfox >/dev/null 2>&1; then :; fi
    codex plugin marketplace add "{{root}}" >/dev/null

    echo ""
    gum style --foreground 212 "✓ SuperImg installed for Codex."
    echo ""
    echo "  Verify:"
    echo "    cat ~/.codex/AGENTS.md | head -5"
    echo ""
    echo "  Try it:"
    echo "    codex   # ask: 'create a SuperImg launch announcement template'"

# Uninstall SuperImg from the local Codex CLI
codex-plugin-uninstall:
    #!/usr/bin/env bash
    set -euo pipefail
    if codex plugin marketplace remove anaptfox >/dev/null 2>&1; then
        gum style --foreground 212 "✓ Removed marketplace"
    fi
    if [ -f ~/.codex/AGENTS.md ]; then
        node "{{root}}/packages/superimg-cli/dist/cli.js" skill remove --host codex --global -y || true
    fi

# === Blitz wasm rasterizer (HTML, no Playwright) ===

# Build @superimg/blitz wasm (crates.io Blitz, no NAPI)
blitz-wasm:
    cd "{{root}}/packages/superimg-blitz" && pnpm run build:wasm

# Rasterize a sample HTML frame via Blitz wasm (writes packages/superimg-blitz/output/*.png)
blitz-spike: blitz-wasm
    cd "{{root}}/packages/superimg-blitz" && pnpm run spike

# HTML video/still without Chromium: just cli export <media> --for youtube --rasterizer blitz

# === Info ===

# Show current package versions with pretty formatting
versions:
    #!/usr/bin/env bash
    ROOT="{{root}}"
    SUPERIMG_VER=$(cd "$ROOT/packages/superimg" && node -p 'require("./package.json").version')
    gum style --border rounded --padding "1 2" --margin "0" --width 40 \
        "$(gum style --foreground 212 --bold 'superimg:')        v$SUPERIMG_VER"

# Check npm authentication
check-auth:
    @npm whoami && gum style --foreground 212 "✓ Authenticated" || gum style --foreground 196 "✗ Not authenticated"
