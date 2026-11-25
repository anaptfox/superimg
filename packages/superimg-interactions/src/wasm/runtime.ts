/**
 * The component engine is a host concern. SuperImg names the boundary it
 * needs, while an application supplies the actual Boundary plugin runtime.
 *
 * This keeps the public Interactions package independent from a sibling
 * checkout's TypeScript sources and makes the capability handoff explicit.
 */
export type GuestImportCheck =
  | Readonly<{ status: "satisfied"; used: readonly string[] }>
  | Readonly<{
      status: "refused";
      unmapped: readonly string[];
      offered: readonly string[];
    }>;

export type GuestBindResult =
  | Readonly<{
      status: "bound";
      realizationId: string;
      used: readonly string[];
    }>
  | Readonly<{
      status: "unrealized";
      unmapped: readonly string[];
      offered: readonly string[];
      report: string;
    }>;

export type GuestCallResult =
  | Readonly<{ status: "returned"; payload: string }>
  | Readonly<{ status: "declared-error"; payload: string }>
  | Readonly<{
      status: "fault";
      certainty: "not-started" | "unknown";
      reason: string;
    }>;

export type ThumbnailGuestRuntime = Readonly<{
  inspect(args: Readonly<{
    bytes: Uint8Array;
    interfaceName: string;
    footprints: readonly string[];
    witDigest: string;
  }>): Promise<Readonly<{ realizationId: string; check: GuestImportCheck }>>;
  execute(args: Readonly<{
    bytes: Uint8Array;
    interfaceName: string;
    footprints: readonly string[];
    witDigest: string;
    host: Readonly<Record<string, (request: string) => string | { tag: "err"; val: string }>>;
    exportName: string;
    input: string;
  }>): Promise<GuestCallResult>;
}>;
