import { z } from "zod";

export const watchHistoryMetaSchema = z.object({
  title: z.string(),
  year: z.number().optional(),
  poster: z.string().optional(),
  type: z.enum(["movie", "show"]),
});

export const watchHistoryItemSchema = z.object({
  meta: watchHistoryMetaSchema,
  tmdbId: z.string(),
  duration: z.number().transform((n) => n.toString()),
  watched: z.number().transform((n) => n.toString()),
  watchedAt: z.string().datetime({ offset: true }),
  completed: z.boolean().optional().default(false),
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
});

export const watchHistoryDeleteSchema = z.object({
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
});
