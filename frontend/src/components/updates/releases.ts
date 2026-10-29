import bundledReleases from '@/components/updates/releases.json';

export type ChangeCategory = 'new' | 'improved' | 'fixed';

export interface Release {
  version: string;
  date: string;
  changes: Partial<Record<ChangeCategory, string[]>>;
  url?: string;
}

export const changeCategories: { key: ChangeCategory; label: string }[] = [
  { key: 'new', label: 'Novo' },
  { key: 'improved', label: 'Melhorias' },
  { key: 'fixed', label: 'Correções' },
];

// Newest first; each release lists only what a user would notice, not internal refactors.
// The release workflow renders the entry matching the tag as the GitHub Release body.
export const releases: Release[] = bundledReleases;

export const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function mergeReleases(local: Release[], remote: Release[]): Release[] {
  const byVersion = new Map(remote.map((release) => [release.version, release]));
  for (const release of local) {
    byVersion.set(release.version, { ...release, url: byVersion.get(release.version)?.url });
  }
  return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
}
