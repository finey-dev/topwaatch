import { z } from "zod";

export const progressMetaSchema = z.object({
  title: z.string(),
  year: z.number().optional(),
  poster: z.string().optional(),
  type: z.enum(["movie", "show", "tv"]),
});

export const progressItemSchema = z.object({
  meta: progressMetaSchema,
  tmdbId: z.string(),
  duration: z.number().transform((n) => Math.round(n).toString()),
  watched: z.number().transform((n) => Math.round(n).toString()),
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

export const progressImportItemSchema = z.object({
  meta: z.object({
    title: z.string(),
    type: z.enum(["movie", "show"]),
    year: z.number().optional(),
    poster: z.string().optional(),
  }),
  tmdbId: z.string(),
  duration: z.number().min(0).transform((n) => Math.round(n)),
  watched: z.number().min(0).transform((n) => Math.round(n)),
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  updatedAt: z.string().datetime({ offset: true }).optional(),
});

export const progressDeleteSchema = z.object({
  seasonId: z.string().optional(),
  episodeId: z.string().optional(),
  meta: z.object({ type: z.enum(["movie", "show", "tv"]).optional() }).optional(),
});
