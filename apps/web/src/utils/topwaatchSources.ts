/** TopWaatch-branded premium sources (Febbox pipeline). */

import { usePreferencesStore } from "@/stores/preferences";

export const TW_NOVA_ID = "tw-nova";
export const TW_ORBIT_ID = "tw-orbit";

/** Prefer Nova then Orbit when Cinema is connected. */
export const TW_CINEMA_SOURCE_IDS = [TW_NOVA_ID, TW_ORBIT_ID] as const;

/** Settings deep-link for TopWaatch Cinema / Febbox setup. */
export const TW_CINEMA_SETUP_PATH = "/settings#topwaatch-cinema";

/** Legacy ids still accepted so old sessions / metrics don't break. */
const NOVA_ALIASES = new Set([TW_NOVA_ID, "fedapi", "aurora"]);
const ORBIT_ALIASES = new Set([TW_ORBIT_ID, "fedapidb", "artemis"]);

export function isTopWaatchNova(sourceId: string | null | undefined): boolean {
  return !!sourceId && NOVA_ALIASES.has(sourceId);
}

export function isTopWaatchOrbit(sourceId: string | null | undefined): boolean {
  return !!sourceId && ORBIT_ALIASES.has(sourceId);
}

export function isTopWaatchPremiumSource(
  sourceId: string | null | undefined,
): boolean {
  return isTopWaatchNova(sourceId) || isTopWaatchOrbit(sourceId);
}

/** True when TopWaatch Cinema is enabled with a Febbox token. */
export function hasTopWaatchCinemaSetup(
  febboxKey?: string | null,
): boolean {
  const key =
    febboxKey !== undefined
      ? febboxKey
      : usePreferencesStore.getState().febboxKey;
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * When Cinema is set up, always probe Nova → Orbit before every other source.
 */
export function prioritizeCinemaSourceIds(
  sourceIds: string[],
  febboxKey?: string | null,
): string[] {
  if (!hasTopWaatchCinemaSetup(febboxKey)) return sourceIds;
  const cinema = TW_CINEMA_SOURCE_IDS.filter((id) => sourceIds.includes(id));
  const rest = sourceIds.filter((id) => !isTopWaatchPremiumSource(id));
  return [...cinema, ...rest];
}

export function prioritizeCinemaSourceItems<T extends { id: string }>(
  items: T[],
  febboxKey?: string | null,
): T[] {
  if (!hasTopWaatchCinemaSetup(febboxKey)) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const cinema = TW_CINEMA_SOURCE_IDS.map((id) => byId.get(id)).filter(
    (item): item is T => !!item,
  );
  const rest = items.filter((item) => !isTopWaatchPremiumSource(item.id));
  return [...cinema, ...rest];
}

export const TW_SOURCE_LABELS: Record<string, string> = {
  [TW_NOVA_ID]: "TopWaatch Nova",
  [TW_ORBIT_ID]: "TopWaatch Orbit",
  fedapi: "TopWaatch Nova",
  aurora: "TopWaatch Nova",
  fedapidb: "TopWaatch Orbit",
  artemis: "TopWaatch Orbit",
};
