# Rendering Architecture

```text
source analysis
  ├─ entries projection → isolated provider worker
  └─ media projection   → browser/server renderer
                              ↓
              entry × variant × edition
                              ↓
                destination/custom target
                              ↓
                    atomic export bundle
```

All paths share canonical `MediaDefinition` and schema-0 Media IR. The projection-aware compiler is the only route to browser IIFEs, ESM, sourcemaps, and compiled artifacts.

Provider workers use bounded execution, structured JSON IPC, controlled working directories, and process-tree cancellation. A provider resolves once per command snapshot; the complete validated array is frozen before planning.

Exports preflight every rendition, stage beside the destination, validate paths and hashes, write the manifest last, and publish atomically.
