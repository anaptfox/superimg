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

# Start the docs site (port 3001) — builds workspace deps first
docs:
    cd "{{root}}" && npx tsx scripts/generate-examples.ts
    cd "{{root}}" && pnpm --filter 'superimg...' run build
    cd "{{root}}/apps/docs" && pnpm run dev

# Run an example by name
example name:
    cd "{{root}}/examples/{{name}}" && pnpm run dev

# Build a specific package
build-pkg name:
    cd "{{root}}" && pnpm --filter "*{{name}}*" run build

# Dev/watch a specific package
dev-pkg name:
    cd "{{root}}" && pnpm --filter "*{{name}}*" run dev

# Build MCP widget (standalone Vite app for ChatGPT)
build-widget:
    cd "{{root}}/apps/widget" && pnpm run build

# Dev widget standalone
dev-widget:
    cd "{{root}}/apps/widget" && pnpm run dev

# Test a specific package
test-pkg name:
    cd "{{root}}" && pnpm --filter "*{{name}}*" run test

# === Quality ===

# Build all packages
build:
    cd "{{root}}" && pnpm run build

# Build the render stack in dependency order
build-render:
    cd "{{root}}" && pnpm run build:render

# Clean all dist/ artifacts and rebuild everything from scratch
rebuild:
    cd "{{root}}" && pnpm run rebuild

# Clean and rebuild only the render stack in dependency order
rebuild-render:
    cd "{{root}}" && pnpm run rebuild:render

# Run all tests
test:
    cd "{{root}}" && pnpm run test

# Run all tests with coverage
test-coverage:
    cd "{{root}}" && pnpm run test:coverage

# Lint all packages
lint:
    cd "{{root}}" && pnpm run lint

# Type-check (builds deps first, then checks docs app)
typecheck:
    @just build
    cd "{{root}}/apps/docs" && pnpm run check-types

# Clean all build artifacts
clean:
    cd "{{root}}" && pnpm run clean

# Run all quality gates: build + test + lint + typecheck + verify harness
check:
    @just _spin "Building..." build
    @just _spin "Testing..." test
    @just _spin "Linting..." lint
    @just _spin "Type-checking..." typecheck
    @just _spin "Verifying harness integrity..." verify-harness
    @gum style --foreground 212 "✓ All checks passed!"

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

# Verify harness bundle integrity (source hash matches)
verify-harness:
    cd "{{root}}/packages/superimg-playwright" && pnpm run verify:harness

# === Release ===

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
        echo ""
        gum style --foreground 212 "✓ superimg bumped to v$NEW_VERSION!"
        echo ""
        just versions
        echo ""
        # Commit the version bump so the working tree is clean for publish
        cd "$ROOT" && git add packages/superimg/package.json
        cd "$ROOT" && git commit -m "chore: bump to v$NEW_VERSION"
        gum style --foreground 212 "✓ Committed version bump"
    else
        gum style --foreground 196 "Cancelled"
        exit 1
    fi

# Publish the public package to npm
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"

    # Verify harness integrity before publishing
    echo "Verifying harness integrity..."
    cd "$ROOT/packages/superimg-playwright" && pnpm run verify:harness
    echo ""

    just versions
    echo ""
    if gum confirm "Publish superimg to npm?"; then
        echo "Publishing superimg..."
        cd "$ROOT/packages/superimg" && pnpm publish --access public
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
    echo ""
    just versions
    echo ""
    gum style --foreground 99 "Dry-run: showing what would be published"
    echo ""
    echo "=== superimg ==="
    cd "$ROOT/packages/superimg" && pnpm publish --dry-run

# Full release: optionally bump -> check -> publish
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
    
    just check
    echo ""
    just publish

# === Skills ===

# Install the SuperImg skill via the CLI (after building packages/superimg).
# For end users: `superimg skill install` — see packages/superimg-cli/src/cli/commands/skill/.
skill-dev:
    cd "{{root}}/packages/superimg" && pnpm exec superimg skill install --all-hosts

# Regenerate the Codex plugin's bundled skill + .mcp.json (production: npx @superimg/mcp)
codex-plugin:
    cd "{{root}}" && pnpm --filter @superimg/codex-plugin run build

# Install SuperImg into the local Codex CLI using the local MCP binary
# (no @superimg/mcp npm publish required).
#
# Codex 0.125's CLI exposes `marketplace add` + `mcp add` but NOT a direct
# `plugin install` (that lives behind the app-server JSON-RPC / desktop UI).
# So this recipe wires SuperImg up two ways:
#   1. `codex mcp add` — registers the MCP server (works today, gives Codex
#      access to validate / list_videos / info as tools).
#   2. `codex plugin marketplace add` — registers the marketplace so the
#      plugin layer is one click / one CLI gap away from being live, plus
#      the skill is materialized at the marketplace path.
#   3. `superimg skill install --host codex --global` — drops the SuperImg
#      managed block into ~/.codex/AGENTS.md so the skill loads even without
#      the plugin layer.
codex-plugin-install:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{root}}"

    if ! command -v codex >/dev/null 2>&1; then
        gum style --foreground 196 "✗ codex CLI not found on PATH"
        echo "Install: https://developers.openai.com/codex/" >&2
        exit 1
    fi

    gum spin --spinner dot --title "Building @superimg/mcp..." -- \
        pnpm --filter @superimg/mcp build

    gum spin --spinner dot --title "Building superimg CLI..." -- \
        pnpm --filter superimg run build

    gum spin --spinner dot --title "Generating plugin (dev MCP path)..." -- \
        pnpm --filter @superimg/codex-plugin run build:dev

    MCP_BIN="{{root}}/packages/superimg-mcp/dist/bin/superimg-mcp.js"
    test -f "$MCP_BIN" || { gum style --foreground 196 "✗ MCP binary not built at $MCP_BIN"; exit 1; }

    gum style --foreground 212 "→ Registering MCP server with Codex..."
    if codex mcp list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx superimg; then
        codex mcp remove superimg >/dev/null
    fi
    codex mcp add superimg -- node "$MCP_BIN"

    gum style --foreground 212 "→ Installing skill into ~/.codex/AGENTS.md..."
    node "{{root}}/packages/superimg/dist/cli.js" skill install --host codex --global -y

    gum style --foreground 212 "→ Registering marketplace (forward-compat)..."
    if codex plugin marketplace remove anaptfox >/dev/null 2>&1; then :; fi
    codex plugin marketplace add "{{root}}" >/dev/null

    echo ""
    gum style --foreground 212 "✓ SuperImg installed for Codex."
    echo ""
    echo "  Verify:"
    echo "    codex mcp list | grep superimg"
    echo "    cat ~/.codex/AGENTS.md | head -5"
    echo ""
    echo "  Try it:"
    echo "    codex   # ask: 'list videos via the superimg MCP'"
    echo ""
    echo "  Restore production .mcp.json before committing:"
    echo "    just codex-plugin"

# Uninstall SuperImg from the local Codex CLI
codex-plugin-uninstall:
    #!/usr/bin/env bash
    set -euo pipefail
    if codex mcp list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx superimg; then
        codex mcp remove superimg
        gum style --foreground 212 "✓ Removed MCP server"
    fi
    if codex plugin marketplace remove anaptfox >/dev/null 2>&1; then
        gum style --foreground 212 "✓ Removed marketplace"
    fi
    if [ -f ~/.codex/AGENTS.md ]; then
        node "{{root}}/packages/superimg/dist/cli.js" skill remove --host codex --global -y || true
    fi

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
