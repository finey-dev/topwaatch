import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { getPlayerStatus, setPlayerStatus } from "../lib/player-status";

const contentSchema = z.object({
  title: z.string().optional(),
  type: z.string().optional(),
  tmdbId: z.union([z.string(), z.number()]).optional(),
  seasonId: z.union([z.string(), z.number()]).optional(),
  episodeId: z.union([z.string(), z.number()]).optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
});

const playerSchema = z.object({
  isPlaying: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  isLoading: z.boolean().optional(),
  hasPlayedOnce: z.boolean().optional(),
  time: z.number().optional(),
  duration: z.number().optional(),
  volume: z.number().optional(),
  playbackRate: z.number().optional(),
  buffered: z.number().optional(),
});

export const playerRouter = router({
  setStatus: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        roomCode: z.string().min(1),
        isHost: z.boolean().optional(),
        content: contentSchema.optional(),
        player: playerSchema.optional(),
      }),
    )
    .mutation(({ input }) => setPlayerStatus(input)),

  getStatus: publicProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        roomCode: z.string().min(1),
      }),
    )
    .query(({ input }) => {
      try {
        return getPlayerStatus(input);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error
              ? err.message
              : "Missing required parameters: roomCode and/or userId",
        });
      }
    }),
});
