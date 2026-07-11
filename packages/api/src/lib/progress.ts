export function progressIsNotStarted(_duration: number, watched: number): boolean {
  if (watched < 20) return true;
  return false;
}

export function progressIsCompleted(duration: number, watched: number): boolean {
  const timeFromEnd = duration - watched;
  if (timeFromEnd < 60 * 2) return true;
  return false;
}

/** Coerce float/string seconds into a non-negative BigInt for DB columns. */
export function toProgressBigInt(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value < 0n ? 0n : value;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0n;
  return BigInt(Math.round(n));
}

const minEpoch = 1626134400000;

export function defaultAndCoerceDateTime(dateTime: string | undefined) {
  const epoch = dateTime ? new Date(dateTime).getTime() : Date.now();
  const clampedEpoch = Math.max(minEpoch, Math.min(epoch, Date.now()));
  return new Date(clampedEpoch);
}

export function normalizeProgressIds(seasonId?: string | null, episodeId?: string | null) {
  return {
    seasonId: seasonId || "\n",
    episodeId: episodeId || "\n",
  };
}

export function displayProgressId(id: string | null | undefined) {
  return id === "\n" || id == null ? null : id;
}

export type ProgressRow = {
  duration: bigint;
  watched: bigint;
  seasonId: string | null;
  episodeId: string | null;
};

export function shouldSaveProgressItem(
  validatedBody: {
    meta: { type: "movie" | "show" | "tv" };
    duration: string;
    watched: string;
    seasonId?: string;
    episodeId?: string;
  },
  seasonEpisodes: ProgressRow[],
): boolean {
  const duration = parseInt(validatedBody.duration, 10);
  const watched = parseInt(validatedBody.watched, 10);
  const isNotStarted = progressIsNotStarted(duration, watched);
  const isCompleted = progressIsCompleted(duration, watched);
  const isAcceptable = !isNotStarted && !isCompleted;

  const metaType = validatedBody.meta.type === "tv" ? "show" : validatedBody.meta.type;
  if (metaType === "movie") return isAcceptable;
  if (isAcceptable) return true;
  if (!validatedBody.seasonId) return false;

  return seasonEpisodes.some((episode) => {
    if (episode.episodeId === (validatedBody.episodeId || "\n")) return false;
    const epDuration = Number(episode.duration);
    const epWatched = Number(episode.watched);
    return !progressIsNotStarted(epDuration, epWatched) && !progressIsCompleted(epDuration, epWatched);
  });
}
