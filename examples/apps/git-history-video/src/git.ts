import { execSync } from "node:child_process";

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

export interface TimelineData {
  title: string;
  events: TimelineEvent[];
  accentColor: string;
}

export interface ContributorStat {
  name: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
}

export interface RaceSeries {
  name: string;
  values: number[];
}

export interface GitAnalytics {
  repoName: string;
  timeline: TimelineData;
  contributors: ContributorStat[];
  raceMonths: string[];
  raceSeries: RaceSeries[];
}

export interface GitExtractOptions {
  count?: number;
  branch?: string;
  since?: string;
  cwd?: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const m = parseInt(month, 10) - 1;
  return `${MONTHS[m]} ${year}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function repoNameFromCwd(cwd: string): string {
  try {
    const url = execSync("git remote get-url origin", {
      encoding: "utf-8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {
    // no remote — fall back to directory name
  }
  return cwd.split("/").pop() ?? "project";
}

/**
 * Sample N items from an array, always including first and last.
 * Items in between are evenly spaced.
 */
function sampleMilestones<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const result: T[] = [items[0]];
  const step = (items.length - 1) / (count - 1);
  for (let i = 1; i < count - 1; i++) {
    result.push(items[Math.round(i * step)]);
  }
  result.push(items[items.length - 1]);
  return result;
}

export function extractGitHistory(options: GitExtractOptions = {}): TimelineData {
  return extractGitAnalytics(options).timeline;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function monthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const m = parseInt(month, 10) - 1;
  return `${MONTHS[m]} ${year.slice(2)}`;
}

export function extractGitAnalytics(options: GitExtractOptions = {}): GitAnalytics {
  const cwd = options.cwd ?? process.cwd();
  const count = options.count ?? 8;

  let logCmd = `git log --format="@@@|%H|%ad|%s|%an|%ae" --date=short --reverse --numstat`;
  if (options.branch) logCmd += ` ${options.branch}`;
  if (options.since) logCmd += ` --since="${options.since}"`;

  const raw = execSync(logCmd, { encoding: "utf-8", cwd }).trim();
  if (!raw) {
    throw new Error("No git commits found. Are you in a git repository?");
  }

  const allCommits: Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
    email: string;
  }> = [];
  const contributorsByEmail = new Map<string, ContributorStat>();
  const monthSet = new Set<string>();
  const monthlyByContributor = new Map<string, Map<string, number>>();

  let currentEmail: string | null = null;
  let currentDate: string | null = null;

  for (const line of raw.split("\n")) {
    if (!line) continue;

    if (line.startsWith("@@@|")) {
      const [, hash, date, message, author, email] = line.split("|");
      allCommits.push({
        hash: hash.slice(0, 7),
        date,
        message,
        author,
        email,
      });

      const key = email.toLowerCase();
      currentEmail = key;
      currentDate = date;
      monthSet.add(monthKey(date));

      const stat = contributorsByEmail.get(key) ?? {
        name: author,
        email: key,
        commits: 0,
        linesAdded: 0,
        linesDeleted: 0,
      };
      stat.name = author;
      stat.commits += 1;
      contributorsByEmail.set(key, stat);

      const monthly = monthlyByContributor.get(key) ?? new Map<string, number>();
      const mk = monthKey(date);
      monthly.set(mk, (monthly.get(mk) ?? 0) + 1);
      monthlyByContributor.set(key, monthly);
      continue;
    }

    if (!currentEmail || !currentDate) continue;
    if (!/^\d+\s+\d+\s+/.test(line)) continue;

    const [addedRaw, deletedRaw] = line.split("\t");
    const added = parseInt(addedRaw, 10);
    const deleted = parseInt(deletedRaw, 10);
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue;

    const stat = contributorsByEmail.get(currentEmail);
    if (!stat) continue;
    stat.linesAdded += added;
    stat.linesDeleted += deleted;
  }

  const sampled = sampleMilestones(allCommits, count);

  const events: TimelineEvent[] = sampled.map((c) => ({
    date: formatDate(c.date),
    title: truncate(c.message, 50),
    description: `by ${c.author} · ${c.hash}`,
  }));

  const repoName = repoNameFromCwd(cwd);
  const contributors = [...contributorsByEmail.values()]
    .filter((c) => !/\[bot\]/i.test(c.name))
    .sort((a, b) => b.commits - a.commits || b.linesAdded - a.linesAdded);

  const raceMonths = [...monthSet].sort();
  const raceSeries = contributors.slice(0, 4).map((c) => {
    const monthly = monthlyByContributor.get(c.email) ?? new Map<string, number>();
    let running = 0;
    const values = raceMonths.map((m) => {
      running += monthly.get(m) ?? 0;
      return running;
    });
    return { name: c.name, values };
  });

  return {
    repoName,
    timeline: {
      title: repoName,
      events,
      accentColor: "", // Not used anymore
    },
    contributors,
    raceMonths: raceMonths.map(monthLabel),
    raceSeries,
  };
}
