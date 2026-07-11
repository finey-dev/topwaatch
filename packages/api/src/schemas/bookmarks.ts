import { z } from "zod";

export const bookmarkMetaSchema = z.object({
  title: z.string(),
  year: z.number().nullable().optional(),
  poster: z.string().optional(),
  type: z.enum(["movie", "show"]),
});

export const bookmarkDataSchema = z.object({
  tmdbId: z.string(),
  meta: bookmarkMetaSchema,
  group: z.union([z.string(), z.array(z.string())]).optional(),
  favoriteEpisodes: z.array(z.string()).optional(),
});

export const bookmarkRequestSchema = z.object({
  meta: bookmarkMetaSchema.optional(),
  tmdbId: z.string().optional(),
  group: z.union([z.string(), z.array(z.string()).max(30)]).optional(),
  favoriteEpisodes: z.array(z.string()).optional(),
});

export function normalizeBookmarkGroup(group: string | string[] | undefined) {
  if (!group) return [];
  return Array.isArray(group) ? group : [group];
}
