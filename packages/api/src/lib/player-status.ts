import { env } from "@topwaatch/env/server";

export interface PlayerStatus {
  userId: string;
  roomCode: string;
  isHost: boolean;
  content: {
    title: string;
    type: string;
    tmdbId?: number | string;
    seasonId?: number | string;
    episodeId?: number | string;
    seasonNumber?: number;
    episodeNumber?: number;
  };
  player: {
    isPlaying: boolean;
    isPaused: boolean;
    isLoading: boolean;
    hasPlayedOnce: boolean;
    time: number;
    duration: number;
    volume: number;
    playbackRate: number;
    buffered: number;
  };
  timestamp: number;
}

const playerStatusStore = new Map<string, PlayerStatus[]>();
const CLEANUP_INTERVAL = env.PLAYER_ROOM_TTL_MS;

function cleanupOldStatuses() {
  const cutoffTime = Date.now() - CLEANUP_INTERVAL;
  for (const [key, statuses] of playerStatusStore.entries()) {
    const filtered = statuses.filter((s) => s.timestamp >= cutoffTime);
    if (filtered.length === 0) {
      playerStatusStore.delete(key);
    } else {
      playerStatusStore.set(key, filtered);
    }
  }
}

setInterval(cleanupOldStatuses, 5 * 60 * 1000);

export function setPlayerStatus(input: {
  userId: string;
  roomCode: string;
  isHost?: boolean;
  content?: Partial<PlayerStatus["content"]>;
  player?: Partial<PlayerStatus["player"]>;
}): { success: true; timestamp: number } {
  const status: PlayerStatus = {
    userId: input.userId,
    roomCode: input.roomCode,
    isHost: input.isHost || false,
    content: {
      title: input.content?.title || "Unknown",
      type: input.content?.type || "Unknown",
      tmdbId: input.content?.tmdbId,
      seasonId: input.content?.seasonId,
      episodeId: input.content?.episodeId,
      seasonNumber: input.content?.seasonNumber,
      episodeNumber: input.content?.episodeNumber,
    },
    player: {
      isPlaying: input.player?.isPlaying || false,
      isPaused: input.player?.isPaused || false,
      isLoading: input.player?.isLoading || false,
      hasPlayedOnce: input.player?.hasPlayedOnce || false,
      time: input.player?.time || 0,
      duration: input.player?.duration || 0,
      volume: input.player?.volume || 0,
      playbackRate: input.player?.playbackRate || 1,
      buffered: input.player?.buffered || 0,
    },
    timestamp: Date.now(),
  };

  const key = `${status.userId}:${status.roomCode}`;
  const existing = playerStatusStore.get(key) || [];
  existing.push(status);
  if (existing.length > 5) existing.shift();
  playerStatusStore.set(key, existing);

  return { success: true, timestamp: status.timestamp };
}

export function getPlayerStatus(input: {
  userId?: string;
  roomCode: string;
}):
  | { roomCode: string; users: Record<string, PlayerStatus[]> }
  | { userId: string; roomCode: string; statuses: PlayerStatus[] } {
  const cutoffTime = Date.now() - CLEANUP_INTERVAL;
  const { userId, roomCode } = input;

  if (roomCode && !userId) {
    const roomStatuses: Record<string, PlayerStatus[]> = {};

    for (const [key, statuses] of playerStatusStore.entries()) {
      if (key.endsWith(`:${roomCode}`)) {
        const uid = key.slice(0, key.length - roomCode.length - 1);
        const recent = statuses.filter((s) => s.timestamp >= cutoffTime);
        if (recent.length > 0) roomStatuses[uid] = recent;
      }
    }

    return { roomCode, users: roomStatuses };
  }

  if (userId && roomCode) {
    const key = `${userId}:${roomCode}`;
    const statuses = playerStatusStore.get(key) || [];
    const recent = statuses.filter((s) => s.timestamp >= cutoffTime);
    if (recent.length !== statuses.length) {
      playerStatusStore.set(key, recent);
    }
    return { userId, roomCode, statuses: recent };
  }

  throw new Error("Missing required parameters: roomCode and/or userId");
}
