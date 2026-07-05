//! Fetch playground example catalog from a static manifest (e.g. /playground/manifest.json).

import { useEffect, useState } from "react";

export type PlaygroundCategoryId =
  | "basics"
  | "marketing"
  | "events"
  | "social"
  | "interfaces"
  | "data"
  | "vector"
  | "developer"
  | "composed";

export interface PlaygroundMeta {
  liveEdit?: boolean;
  needsAssets?: boolean;
  needsBundle?: boolean;
  duration?: number;
}

export interface PlaygroundCatalogEntry {
  id: string;
  title: string;
  description?: string;
  category: PlaygroundCategoryId | string;
  codeUrl: string;
  bundledUrl?: string;
  playground?: PlaygroundMeta;
  /** Populated after lazy fetch — not in manifest.json */
  code?: string;
  /** Populated after lazy fetch — not in manifest.json */
  bundled?: string;
}

export interface PlaygroundCategory {
  id: string;
  title: string;
}

export interface PlaygroundManifest {
  version: number;
  generatedAt: string;
  categories: PlaygroundCategory[];
  examples: PlaygroundCatalogEntry[];
}

export interface UsePlaygroundCatalogOptions {
  manifestUrl?: string;
  enabled?: boolean;
}

export interface UsePlaygroundCatalogReturn {
  manifest: PlaygroundManifest | null;
  examples: PlaygroundCatalogEntry[];
  categories: PlaygroundCategory[];
  loading: boolean;
  error: string | null;
  getExampleById: (id: string) => PlaygroundCatalogEntry | undefined;
  getExamplesByCategory: (category: string) => PlaygroundCatalogEntry[];
  loadExampleContent: (entry: PlaygroundCatalogEntry) => Promise<PlaygroundCatalogEntry>;
}

const DEFAULT_MANIFEST_URL = "/playground/manifest.json";

const contentCache = new Map<string, { code?: string; bundled?: string }>();

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

export function usePlaygroundCatalog(
  options: UsePlaygroundCatalogOptions = {},
): UsePlaygroundCatalogReturn {
  const { manifestUrl = DEFAULT_MANIFEST_URL, enabled = true } = options;
  const [manifest, setManifest] = useState<PlaygroundManifest | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setManifest(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(manifestUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${manifestUrl}: ${res.status}`);
        return res.json() as Promise<PlaygroundManifest>;
      })
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setManifest(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [manifestUrl, enabled]);

  const examples = manifest?.examples ?? [];
  const categories = manifest?.categories ?? [];

  const getExampleById = (id: string) => examples.find((e) => e.id === id);

  const getExamplesByCategory = (category: string) =>
    examples.filter((e) => e.category === category);

  const loadExampleContent = async (
    entry: PlaygroundCatalogEntry,
  ): Promise<PlaygroundCatalogEntry> => {
    const cached = contentCache.get(entry.id);
    if (cached?.code !== undefined && (!entry.bundledUrl || cached.bundled !== undefined)) {
      return { ...entry, code: cached.code, bundled: cached.bundled };
    }

    const code = cached?.code ?? (await fetchText(entry.codeUrl));
    let bundled = cached?.bundled;
    if (entry.bundledUrl && bundled === undefined) {
      bundled = await fetchText(entry.bundledUrl);
    }

    contentCache.set(entry.id, { code, bundled });
    return { ...entry, code, bundled };
  };

  return {
    manifest,
    examples,
    categories,
    loading,
    error,
    getExampleById,
    getExamplesByCategory,
    loadExampleContent,
  };
}
