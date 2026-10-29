import { changeCategories } from '@/components/updates/releases';
import type { ChangeCategory, Release } from '@/components/updates/releases';

const RELEASES_URL = 'https://api.github.com/repos/barbosa-leo/dbclient/releases?per_page=30';
const CACHE_KEY = 'dbclient.githubReleases';
// Unauthenticated GitHub API calls are limited to 60 per hour per IP, shared by every user behind it.
const CACHE_TTL_MS = 60 * 60 * 1000;

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
}

interface CachedReleases {
  fetchedAt: number;
  releases: Release[];
}

const versionTag = /^v?(\d+\.\d+\.\d+)$/;
const categoryHeading = /^#{2,3}\s+(.+?)\s*$/;
const listItem = /^[-*]\s+(.+?)\s*$/;

// Inverse of the Markdown rendered by the release workflow; unknown sections are ignored.
function parseBody(body: string): Release['changes'] {
  const labels = new Map(changeCategories.map(({ key, label }) => [label, key]));
  const changes: Release['changes'] = {};
  let current: ChangeCategory | undefined;

  for (const line of body.split(/\r?\n/)) {
    const heading = categoryHeading.exec(line)?.[1];
    if (heading !== undefined) {
      current = labels.get(heading);
      continue;
    }
    const item = listItem.exec(line)?.[1];
    if (item !== undefined && current) {
      (changes[current] ??= []).push(item);
    }
  }
  return changes;
}

function toRelease(release: GitHubRelease): Release | null {
  const version = versionTag.exec(release.tag_name)?.[1];
  if (!version || release.draft || release.prerelease || !release.published_at) return null;
  return {
    version,
    date: release.published_at.slice(0, 10),
    changes: parseBody(release.body ?? ''),
    url: release.html_url,
  };
}

function readCache(): Release[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedReleases;
    return Date.now() - cached.fetchedAt < CACHE_TTL_MS ? cached.releases : null;
  } catch {
    return null;
  }
}

function writeCache(releases: Release[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), releases }));
  } catch {
    // Storage may be unavailable (private mode); the next load simply fetches again.
  }
}

export async function listGitHubReleases(): Promise<Release[]> {
  const cached = readCache();
  if (cached) return cached;

  const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`);

  const releases = ((await response.json()) as GitHubRelease[])
    .map(toRelease)
    .filter((release): release is Release => release !== null);
  writeCache(releases);
  return releases;
}
