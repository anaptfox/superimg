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

# Start the docs site (port 3001) — builds workspace deps first
docs:
    cd "{{root}}" && pnpm --filter 'superimg^...' --filter '!@superimg/playwright' run build
    cd "{{root}}" && SUPERIMG_BROWSER_ONLY=1 pnpm --filter superimg run build
    cd "{{root}}" && pnpm --filter superimg-react build
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

# Test a specific package
test-pkg name:
    cd "{{root}}" && pnpm --filter "*{{name}}*" run test

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

# Type-check (docs app)
typecheck:
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

# Interactive version bump - bumps both packages to same version
bump:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"
    BUMP_TYPE=$(gum choose --header "Bump type? (both packages will be synced)" "patch" "minor" "major")
    echo ""
    just versions
    echo ""
    if gum confirm "Bump both packages ($BUMP_TYPE)?"; then
        # Bump the first package
        cd "$ROOT/apps/superimg" && pnpm version $BUMP_TYPE --no-git-tag-version
        # Get the new version
        NEW_VERSION=$(cd "$ROOT/apps/superimg" && node -p 'require("./package.json").version')
        # Set superimg-react to the exact same version
        cd "$ROOT/apps/superimg-react" && pnpm version $NEW_VERSION --no-git-tag-version
        echo ""
        gum style --foreground 212 "✓ Both packages bumped to v$NEW_VERSION!"
        echo ""
        just versions
    else
        gum style --foreground 196 "Cancelled"
        exit 1
    fi

# Publish both packages to npm
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
    if gum confirm "Publish both packages to npm?"; then
        echo "Publishing superimg..."
        cd "$ROOT/apps/superimg" && pnpm publish --access public
        echo ""
        echo "Publishing superimg-react..."
        cd "$ROOT/apps/superimg-react" && pnpm publish --access public
        echo ""
        gum style --foreground 212 --bold "✓ Both packages published!"
    else
        gum style --foreground 196 "Cancelled"
        exit 1
    fi

# Dry-run publish to see what would be published (both packages)
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
    cd "$ROOT/apps/superimg" && pnpm publish --dry-run
    echo ""
    echo "=== superimg-react ==="
    cd "$ROOT/apps/superimg-react" && pnpm publish --dry-run

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

# Install the SuperImg AI skill for Claude Code and/or Cursor
skill:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="{{root}}"
    SOURCE="$ROOT/skills/superimg/SKILL.md"

    if [ ! -f "$SOURCE" ]; then
        gum style --foreground 196 "✗ Source not found: skills/superimg/SKILL.md"
        exit 1
    fi

    TARGET=$(gum choose --header "Install skill to:" \
        "claude-local"  \
        "claude-global" \
        "cursor"        \
        "all")

    install_claude_local() {
        mkdir -p "$ROOT/.claude/skills/superimg"
        cp "$SOURCE" "$ROOT/.claude/skills/superimg/SKILL.md"
        gum style --foreground 212 "✓ Installed to .claude/skills/superimg/SKILL.md"
    }

    install_claude_global() {
        mkdir -p "$HOME/.claude/skills/superimg"
        cp "$SOURCE" "$HOME/.claude/skills/superimg/SKILL.md"
        gum style --foreground 212 "✓ Installed to ~/.claude/skills/superimg/SKILL.md"
    }

    install_cursor() {
        mkdir -p "$ROOT/.cursor/rules"
        # Replace SKILL.md YAML frontmatter with Cursor .mdc frontmatter
        {
            echo '---'
            echo 'description: "SuperImg video generation framework. Use when working with superimg templates or video rendering."'
            echo 'globs: "*.ts,*.tsx,*.js,*.jsx"'
            echo 'alwaysApply: false'
            echo '---'
            # Skip the YAML frontmatter from source, keep the body
            awk '/^---$/{c++;next} c<2{next} 1' "$SOURCE"
        } > "$ROOT/.cursor/rules/superimg.mdc"
        gum style --foreground 212 "✓ Installed to .cursor/rules/superimg.mdc"
    }

    case "$TARGET" in
        claude-local)  install_claude_local ;;
        claude-global) install_claude_global ;;
        cursor)        install_cursor ;;
        all)
            install_claude_local
            install_claude_global
            install_cursor
            ;;
    esac

# === Info ===

# Show current package versions with pretty formatting
versions:
    #!/usr/bin/env bash
    ROOT="{{root}}"
    SUPERIMG_VER=$(cd "$ROOT/apps/superimg" && node -p 'require("./package.json").version')
    REACT_VER=$(cd "$ROOT/apps/superimg-react" && node -p 'require("./package.json").version')
    gum style --border rounded --padding "1 2" --margin "0" --width 40 \
        "$(gum style --foreground 212 --bold 'superimg:')        v$SUPERIMG_VER" \
        "$(gum style --foreground 57 --bold 'superimg-react:')  v$REACT_VER"

# Check npm authentication
check-auth:
    @npm whoami && gum style --foreground 212 "✓ Authenticated" || gum style --foreground 196 "✗ Not authenticated"
