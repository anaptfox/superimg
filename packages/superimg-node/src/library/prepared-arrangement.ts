//! Node-owned preparation of portable arrangement files.
import { hashJson } from "./provider.js";
import { parseDuration } from "@superimg/core";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { arrangeMedia, checkArrangeRequest, parseArrangeRequest, type ArrangeAsset, type ArrangeRequest } from "@superimg/core/arrange";
import type { Duration } from "@superimg/types";

const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
});

/** A plain object naming a string `src` is a `SrcView`; nothing else in an
 * arrangement spec does. Walking generically (rather than switching on
 * pattern id) is what keeps this door open to every registered pattern. */
function isSrcViewLike(value: unknown): value is Record<string, unknown> & { src: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).src === "string"
  );
}

async function rewriteSrcViews(
  value: unknown,
  resolveSrc: (src: string) => Promise<string>,
): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => rewriteSrcViews(item, resolveSrc)));
  }
  if (isSrcViewLike(value)) {
    return { ...value, src: await resolveSrc(value.src) };
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = await Promise.all(
      Object.entries(record).map(async ([key, item]) => [key, await rewriteSrcViews(item, resolveSrc)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Inline every specimen `src` as a data URL: `asset:<id>` decodes bytes the
 * request already carries; a relative path needs an explicit host resolver. The parser has already rejected every other src shape.
 */
async function resolveRequestSources(
  request: ArrangeRequest,
  resolveRelative?: (src: string) => Promise<string>,
): Promise<ArrangeRequest> {
  const assetsById = new Map<string, ArrangeAsset>((request.assets ?? []).map((asset) => [asset.id, asset]));
  const reads = new Map<string, Promise<string>>();
  const resolveSrc = async (src: string): Promise<string> => {
    if (src.startsWith("asset:")) {
      // parseArrangeRequest already guarantees this id resolves.
      const asset = assetsById.get(src.slice("asset:".length))!;
      return `data:${asset.mimeType};base64,${asset.bytes}`;
    }
    if (!resolveRelative) {
      throw Object.assign(new Error(`Relative resource '${src}' needs a host asset resolver; supply asset:<id> bytes for portable calls.`), { code: "ARRANGEMENT_RESOURCE_REQUIRED", path: "spec" });
    }
    let pending = reads.get(src);
    if (pending === undefined) {
      pending = resolveRelative(src);
      reads.set(src, pending);
    }
    return pending;
  };
  const spec = await rewriteSrcViews(request.spec, resolveSrc);
  return { ...request, spec } as ArrangeRequest;
}

/** A file host resolves relative resources; a portable caller never gets this authority. */
function createRelativeSourceResolver(specDir: string): (src: string) => Promise<string> {
  const reads = new Map<string, Promise<string>>();
  return (src) => {
    const absolute = resolve(specDir, src);
    const mimeType = IMAGE_MIME_BY_EXTENSION[extname(absolute).toLowerCase()];
    if (!mimeType) {
      throw new Error(
        `Cannot determine an image MIME type for '${src}' (unsupported extension). ` +
          `Supported: ${Object.keys(IMAGE_MIME_BY_EXTENSION).join(", ")}`,
      );
    }
    let pending = reads.get(absolute);
    if (pending === undefined) {
      pending = readFile(absolute).then(bytes => `data:${mimeType};base64,${bytes.toString("base64")}`);
      reads.set(absolute, pending);
    }
    return pending;
  };
}

/** Prepare a portable request. Relative resources require an explicit host resolver. */
export async function prepareNodeArrangementRequest(raw: unknown, options: {
  duration?: Duration;
  resolveSource?: (src: string) => Promise<string>;
} = {}) {
  const admitted = freezeSnapshot(parseArrangeRequest(structuredClone(raw)));
  const failures = checkArrangeRequest(admitted);
  if (failures.length) throw Object.assign(new Error("Cannot prepare a refused arrangement"), { code: "ARRANGEMENT_REFUSED", failures });
  const request = freezeSnapshot(await resolveRequestSources(admitted, options.resolveSource));
  const media = freezeSnapshot(arrangeMedia(request, options.duration === undefined ? {} : { duration: options.duration }));
  const durationSeconds = media.animated ? parseDuration(media.config?.duration, "duration", media.config?.fps ?? 30) : null;
  const identity = hashJson({ request, durationSeconds });
  return freezeSnapshot({ kind: "arrangement" as const, identity, request, media });
}


export async function readNodeArrangement(path: string, supplied?: { raw: unknown }) {
  const sourcePath = resolve(path);
  const raw = supplied === undefined ? JSON.parse(await readFile(sourcePath, "utf8")) as unknown : supplied.raw;
  const request = freezeSnapshot(parseArrangeRequest(raw));
  return freezeSnapshot({ kind: "arrangement" as const, sourcePath, request, failures: checkArrangeRequest(request) });
}

export async function prepareNodeArrangement(input: Awaited<ReturnType<typeof readNodeArrangement>>, duration?: Duration) {
  // Re-admit the copied value before giving the file host's resolver any work.
  const prepared = await prepareNodeArrangementRequest(input.request, {
    ...(duration === undefined ? {} : { duration }),
    resolveSource: createRelativeSourceResolver(dirname(input.sourcePath)),
  });
  return freezeSnapshot({ ...prepared, sourcePath: input.sourcePath });
}

/** Freeze JSON snapshots and the plain media definition without changing functions. */
function freezeSnapshot<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) freezeSnapshot(child, seen);
    Object.freeze(value);
  }
  return value;
}
