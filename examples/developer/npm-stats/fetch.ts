//! NPM package download statistics types and fetcher

export interface DownloadDataPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number; // Daily download count
}

export interface NpmStatsData {
  package: string;
  description: string;
  downloads: DownloadDataPoint[];
  totalDownloads: number;
}

interface NpmPackageResponse {
  name: string;
  description?: string;
}

interface NpmDownloadsResponse {
  package: string;
  downloads: Array<{
    downloads: number;
    day: string;
  }>;
}

/**
 * Parse an npm package name from various formats:
 * - https://www.npmjs.com/package/react
 * - npmjs.com/package/react
 * - react
 * - @scope/package
 */
export function parseNpmPackage(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try URL format first
  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    );
    if (url.hostname === "npmjs.com" || url.hostname === "www.npmjs.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      // Handle /package/name or /package/@scope/name
      if (parts[0] === "package" && parts.length >= 2 && parts[1]) {
        if (parts[1].startsWith("@") && parts.length >= 3 && parts[2]) {
          return `${parts[1]}/${parts[2]}`;
        }
        return parts[1];
      }
    }
  } catch {
    // Not a URL, continue to direct name check
  }

  // Validate package name format
  // Scoped: @scope/name or unscoped: name
  const scopedMatch = trimmed.match(/^@([a-z0-9-~][a-z0-9-._~]*)\/([a-z0-9-~][a-z0-9-._~]*)$/i);
  if (scopedMatch) {
    return trimmed;
  }

  const unscopedMatch = trimmed.match(/^[a-z0-9-~][a-z0-9-._~]*$/i);
  if (unscopedMatch) {
    return trimmed;
  }

  return null;
}

/**
 * Fetch npm download statistics from the npm registry API
 * Uses the downloads/range endpoint for last year of data
 */
export async function fetchNpmDownloads(
  packageName: string
): Promise<NpmStatsData> {
  // Fetch package info for description
  const pkgResponse = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
  );

  if (!pkgResponse.ok) {
    if (pkgResponse.status === 404) {
      throw new Error(`Package not found: ${packageName}`);
    }
    throw new Error(`Failed to fetch package info: ${pkgResponse.status}`);
  }

  const pkgData: NpmPackageResponse = await pkgResponse.json();

  // Fetch download stats for the last year
  const downloadsResponse = await fetch(
    `https://api.npmjs.org/downloads/range/last-year/${encodeURIComponent(packageName)}`
  );

  if (!downloadsResponse.ok) {
    if (downloadsResponse.status === 404) {
      throw new Error(`No download data for: ${packageName}`);
    }
    throw new Error(`Failed to fetch downloads: ${downloadsResponse.status}`);
  }

  const downloadsData: NpmDownloadsResponse = await downloadsResponse.json();

  // Aggregate daily downloads into weekly buckets for smoother visualization
  const weeklyDownloads: DownloadDataPoint[] = [];
  let weekStart = "";
  let weekTotal = 0;
  let totalDownloads = 0;

  for (let i = 0; i < downloadsData.downloads.length; i++) {
    const day = downloadsData.downloads[i];
    if (!day) continue;
    totalDownloads += day.downloads;
    weekTotal += day.downloads;

    if (!weekStart) {
      weekStart = day.day;
    }

    // Every 7 days, create a data point
    if ((i + 1) % 7 === 0 || i === downloadsData.downloads.length - 1) {
      weeklyDownloads.push({
        date: weekStart,
        count: weekTotal,
      });
      weekStart = "";
      weekTotal = 0;
    }
  }

  // If we have too many points, sample them
  let downloads = weeklyDownloads;
  if (downloads.length > 60) {
    const sampled: DownloadDataPoint[] = [];
    const step = Math.floor(downloads.length / 60);
    for (let i = 0; i < downloads.length; i += step) {
      const point = downloads[i];
      if (point) sampled.push(point);
    }
    const lastSampled = sampled[sampled.length - 1];
    const lastDownload = downloads[downloads.length - 1];
    if (lastSampled && lastDownload && lastSampled !== lastDownload) {
      sampled.push(lastDownload);
    }
    downloads = sampled;
  }

  return {
    package: packageName,
    description: pkgData.description || "",
    downloads,
    totalDownloads,
  };
}

/**
 * Calculate video duration based on download data
 * More data points = longer video, capped at 15 seconds
 */
export function calculateNpmStatsDuration(data: NpmStatsData): number {
  const baseSeconds = 6;
  const pointBonus = Math.min(6, data.downloads.length / 15);
  return Math.min(15, baseSeconds + pointBonus);
}

/**
 * Format large numbers with K/M/B suffix
 */
export function formatDownloadCount(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}
