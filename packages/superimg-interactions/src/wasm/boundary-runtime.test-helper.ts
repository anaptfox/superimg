import type { GuestCallResult, GuestImportCheck, ThumbnailGuestRuntime } from "./runtime.js";

type BoundaryImportCheck =
  | { status: "satisfied"; used: readonly string[] }
  | { status: "refused"; unmapped: readonly string[]; provided: readonly string[] };

type LoadedGuest =
  | { status: "ready"; instance: {
      call(name: string, input: string): Promise<GuestCallResult>;
      close(): Promise<void>;
    } }
  | { status: "refused"; unmapped: readonly string[]; provided: readonly string[] }
  | GuestCallResult;

type BoundaryPluginModule = {
  HostImports: new (interfaceName: string) => { provide(footprint: string): unknown };
  inspectPlugin(bytes: Uint8Array, imports: unknown, witDigest: string): Promise<{ realizationId: string; check: BoundaryImportCheck }>;
  createPluginExecutor(): { close(): Promise<void> };
  loadPlugin(args: {
    executor: unknown;
    bytes: Uint8Array;
    imports: unknown;
    witDigest: string;
    host: Parameters<ThumbnailGuestRuntime["execute"]>[0]["host"];
  }): Promise<LoadedGuest>;
};

function toGuestImportCheck(check: BoundaryImportCheck): GuestImportCheck {
  return check.status === "refused"
    ? { status: "refused", unmapped: check.unmapped, offered: check.provided }
    : check;
}

/**
 * Test adapter for the host-selected Boundary guest runtime.
 */
export async function loadBoundaryThumbnailGuestRuntime(): Promise<ThumbnailGuestRuntime> {
  const plugin = await import("@foxworth/boundary/plugin") as unknown as BoundaryPluginModule;

  return {
    async inspect({ bytes, interfaceName, footprints, witDigest }) {
      const imports = new plugin.HostImports(interfaceName);
      for (const footprint of footprints) imports.provide(footprint);
      const inspected = await plugin.inspectPlugin(bytes, imports, witDigest);
      return { realizationId: inspected.realizationId, check: toGuestImportCheck(inspected.check) };
    },
    async execute({ bytes, interfaceName, footprints, witDigest, host, exportName, input }) {
      const imports = new plugin.HostImports(interfaceName);
      for (const footprint of footprints) imports.provide(footprint);
      const executor = plugin.createPluginExecutor();
      let loaded: LoadedGuest | undefined;
      try {
        loaded = await plugin.loadPlugin({ executor, bytes, imports, witDigest, host });
        if (loaded.status === "ready") return await loaded.instance.call(exportName, input);
        return loaded.status === "refused"
          ? { status: "fault" as const, certainty: "not-started" as const, reason: `unmapped guest imports: ${loaded.unmapped.join(", ")}` }
          : loaded;
      } finally {
        try {
          if (loaded?.status === "ready") await loaded.instance.close();
        } finally {
          await executor.close();
        }
      }
    },
  };
}
