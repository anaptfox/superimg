import { listVideos, type VideoSummary } from "../list-videos.js";
import { deriveVideoName } from "../cli/utils/resolve-output-path.js";
import { discoverBatchSources, type DiscoverBatchOptions } from "./discover.js";

export interface ManifestTemplate extends VideoSummary {
  /** Grouping key for the host (e.g. callable `media.<stem>`). */
  stem: string;
  /** Present for batch items; the explicit entry slug. */
  slug?: string;
  /** True when this item came from a template's `batch` export. */
  batch: boolean;
  /** Batch entry data for native player / codegen (from `entry.data`). */
  data?: Record<string, unknown>;
}

export interface DiscoveryManifest {
  version: 1;
  projectRoot: string;
  templates: ManifestTemplate[];
}

/**
 * The stable JSON shape a host's codegen consumes. Every template is emitted
 * once: a plain template as a single item, a template with a co-located `batch`
 * export as one item per entry. Batch item names use the renderer's canonical
 * convention `${deriveVideoName(templatePath)}-${slug}` so the manifest name
 * always equals the rendered filename.
 */
export async function buildManifest(
  projectRoot: string,
  options: DiscoverBatchOptions = {},
): Promise<DiscoveryManifest> {
  const [summaries, batchSources] = await Promise.all([
    listVideos(projectRoot),
    discoverBatchSources(projectRoot, options),
  ]);

  const batchByEntry = new Map(batchSources.map((b) => [b.entrypoint, b.batch]));
  const templates: ManifestTemplate[] = [];

  for (const summary of summaries) {
    const batchFn = batchByEntry.get(summary.entrypoint);

    if (batchFn) {
      const stem = deriveVideoName(summary.entrypoint);
      const entries = await batchFn();
      for (const entry of entries) {
        const shortName = `${stem}-${entry.slug}`;
        templates.push({
          ...summary,
          name: shortName,
          shortName,
          stem,
          slug: entry.slug,
          batch: true,
          data: entry.data,
        });
      }
    } else {
      templates.push({ ...summary, stem: summary.shortName, batch: false });
    }
  }

  return { version: 1, projectRoot, templates };
}
