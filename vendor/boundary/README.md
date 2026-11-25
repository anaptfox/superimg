# Boundary snapshot

SuperImg currently consumes the Boundary 0.2.0 archive in the digest directory
selected by `pnpm-workspace.yaml` (from `anaptfox/boundary` `main` `3771252`). Consumer package manifests declare `^0.2.0`;
the workspace override selects these exact bytes for builds and tests.

This follows Boundary's documented local consumer workflow. The archive and its
adjacent receipt are retained here so a checkout can install without a sibling
Boundary repository. `source.json` records the source commit, dirty-worktree
status, source hashes, build tool versions and focused upstream checks.

To refresh directly from GitHub without needing a local Boundary checkout on disk, run:

```bash
just vendor-boundary            # pulls anaptfox/boundary@main
just vendor-boundary 3771252    # pulls a specific commit or tag
```

This clones `anaptfox/boundary` into a clean temporary directory, builds and packs
`@foxworth/boundary`, retains the resulting archive, receipt, and `source.json` in a new
digest directory named by the archive's full SHA-256 (keeping existing digest directories
immutable), updates `pnpm-workspace.yaml`, runs `pnpm install`, and verifies both
`verifyPackReceipt` and `verifyContentManifest` from `@foxworth/boundary/artifact`.
Then run SuperImg's relevant checks (`just test-interactions`, `pnpm --filter @foxworth/superimg verify`).

The receipt establishes integrity against the supplied evidence. It does not
establish publisher authentication, Stash approval, or public distribution.
