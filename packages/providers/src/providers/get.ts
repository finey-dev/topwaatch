import { FeatureMap, flagsAllowedInFeatures } from '@/entrypoint/utils/targets';
import { Embed, Sourcerer } from '@/providers/base';

export interface ProviderList {
  sources: Sourcerer[];
  embeds: Embed[];
}

function findDuplicates<T>(items: T[], keyFn: (item: T) => string | number): { key: string | number; items: T[] }[] {
  const groups = new Map<string | number, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  return Array.from(groups.entries())
    .filter(([_, groupItems]) => groupItems.length > 1)
    .map(([key, groupItems]) => ({ key, items: groupItems }));
}

function formatDuplicateError(
  type: string,
  duplicates: { key: string | number; items: any[] }[],
  keyName: string,
): string {
  const duplicateList = duplicates
    .map(({ key, items }) => {
      const itemNames = items.map((item) => item.name || item.id).join(', ');
      return `  ${keyName} ${key}: ${itemNames}`;
    })
    .join('\n');

  return `${type} have duplicate ${keyName}s:\n${duplicateList}`;
}

/**
 * Resolve rank collisions by incrementing duplicates until all ranks are unique.
 * Logs a warning so the bug is visible in dev without crashing the player.
 */
function deduplicateRanks<T extends { rank: number }>(items: T[], label: string): T[] {
  const used = new Set<number>();
  return items.map((item) => {
    let rank = item.rank;
    if (used.has(rank)) {
      const original = rank;
      while (used.has(rank)) rank += 1;
      console.warn(
        `[providers] ${label} rank collision: "${(item as any).name ?? (item as any).id}" was ${original}, auto-adjusted to ${rank}. Fix the source file.`,
      );
    }
    used.add(rank);
    return rank === item.rank ? item : { ...item, rank };
  });
}

export function getProviders(features: FeatureMap, list: ProviderList): ProviderList {
  const sources = list.sources.filter((v) => !v?.disabled);
  const embeds = list.embeds.filter((v) => !v?.disabled);
  const combined = [...sources, ...embeds];

  // Duplicate IDs are always a hard error — two providers with the same ID
  // cannot coexist and would cause silent data corruption.
  const duplicateIds = findDuplicates(combined, (v) => v.id);
  if (duplicateIds.length > 0) {
    throw new Error(formatDuplicateError('Sources/embeds', duplicateIds, 'ID'));
  }

  // Rank duplicates are silently auto-fixed so a stale build or a missed
  // rank update never crashes the player for real users.
  const dedupedSources = deduplicateRanks(sources, 'source');
  const dedupedEmbeds = deduplicateRanks(embeds, 'embed');

  return {
    sources: dedupedSources.filter((s) => flagsAllowedInFeatures(features, s.flags)),
    embeds: dedupedEmbeds.filter((e) => flagsAllowedInFeatures(features, e.flags)),
  };
}
