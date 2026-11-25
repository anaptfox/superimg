# Reach demo

Start a real Boundary bus, register a Media surface, invoke
`media.source.check`, execute a Zig thumbnail guest, inspect the eight offered MCP
tools, and withdraw the binding while the bus connection remains open. A Draft
acceptance proves that accepting a proposal does not change the live Program.

The SDK comes from the built `@foxworth/boundary` package through this workspace's
development override. Build the sibling checkout first. The default executable
is `../ops/target/debug/boundary`; set `BOUNDARY` to choose another executable.
Production integration uses supported SDK subpaths, including `/bus`, `/reach`,
`/plugin`, `/drafts`, and `/http/protocol`.

```bash
just build-render
pnpm --filter @superimg/reach-demo start
```

Build the thumbnail with `zig build` in
`packages/superimg-interactions/guests/thumbnail`. Build the overreach component
as described in its README. Both components import `boundary:guest@1.0.0`.
The real guest tests also execute them and refuse the publications import before
instantiation.

The script creates a private temporary socket directory and owns the bus process.
`BOUNDARY_BUS_SOCKET` chooses a socket path in a private directory. The default
for ordinary CLI discovery is `~/.boundary/bus.sock`; the HTTP surface is
`/boundary/v1`.

The host owns decoded pixels, the import map, admission, and execution. The guest
performs thumbnail arithmetic. Boundary owns discovery and checked contact.
Approval and effects remain separate host decisions. The demo uses temporary
host state and does not publish remote media.
