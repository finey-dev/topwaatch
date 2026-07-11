import { z } from "zod";

export const customThemeSchema = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    tertiary: z.string().optional(),
    activeTheme: z
      .object({
        primary: z.string(),
        secondary: z.string(),
        tertiary: z.string(),
      })
      .optional(),
    savedCustomThemes: z
      .array(
        z.object({
          id: z.string().transform((val) => val.replace(/[^a-zA-Z0-9-]/g, "")),
          name: z.string(),
          primary: z.string(),
          secondary: z.string(),
          tertiary: z.string(),
          customPrimaryHex: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .optional(),
          customSecondaryHex: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .optional(),
          customTertiaryHex: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .optional(),
        }),
      )
      .max(30)
      .optional(),
    hiddenDefaultThemes: z.array(z.string()).optional(),
  })
  .nullable()
  .optional();

export const userSettingsSchema = z.object({
  applicationTheme: z.string().nullable().optional(),
  customTheme: customThemeSchema,
  applicationLanguage: z.string().optional().default("en"),
  defaultSubtitleLanguage: z.string().nullable().optional(),
  proxyUrls: z.array(z.string()).nullable().optional(),
  traktKey: z.string().nullable().optional(),
  febboxKey: z.string().nullable().optional(),
  debridToken: z.string().nullable().optional(),
  debridService: z.string().nullable().optional(),
  tidbKey: z.string().nullable().optional(),
  enableThumbnails: z.boolean().optional().default(false),
  enableAutoplay: z.boolean().optional().default(true),
  enableSkipCredits: z.boolean().optional().default(true),
  enableDiscover: z.boolean().optional().default(true),
  enableFeatured: z.boolean().optional().default(false),
  enableDetailsModal: z.boolean().optional().default(false),
  enableImageLogos: z.boolean().optional().default(true),
  enableCarouselView: z.boolean().optional().default(false),
  forceCompactEpisodeView: z.boolean().optional().default(false),
  sourceOrder: z.array(z.string()).optional().default([]),
  enableSourceOrder: z.boolean().optional().default(false),
  disabledSources: z.array(z.string()).optional().default([]),
  embedOrder: z.array(z.string()).optional().default([]),
  enableEmbedOrder: z.boolean().optional().default(false),
  disabledEmbeds: z.array(z.string()).optional().default([]),
  proxyTmdb: z.boolean().optional().default(false),
  enableLowPerformanceMode: z.boolean().optional().default(false),
  enableNativeSubtitles: z.boolean().optional().default(false),
  enableHoldToBoost: z.boolean().optional().default(false),
  homeSectionOrder: z.array(z.string()).optional().default([]),
  manualSourceSelection: z.boolean().optional().default(false),
  enableDoubleClickToSeek: z.boolean().optional().default(false),
  enableAutoResumeOnPlaybackError: z.boolean().optional().default(false),
  enablePauseOverlay: z.boolean().optional().default(false),
});

export function formatUserSettings(
  userId: string,
  settings: {
    applicationTheme: string | null;
    customTheme: unknown;
    applicationLanguage: string | null;
    defaultSubtitleLanguage: string | null;
    proxyUrls: string[];
    traktKey: string | null;
    febboxKey: string | null;
    debridToken: string | null;
    debridService: string | null;
    tidbKey: string | null;
    enableThumbnails: boolean;
    enableAutoplay: boolean;
    enableSkipCredits: boolean;
    enableDiscover: boolean;
    enableFeatured: boolean;
    enableDetailsModal: boolean;
    enableImageLogos: boolean;
    enableCarouselView: boolean;
    forceCompactEpisodeView: boolean;
    sourceOrder: string[];
    enableSourceOrder: boolean;
    disabledSources: string[];
    embedOrder: string[];
    enableEmbedOrder: boolean;
    disabledEmbeds: string[];
    proxyTmdb: boolean;
    enableLowPerformanceMode: boolean;
    enableNativeSubtitles: boolean;
    enableHoldToBoost: boolean;
    homeSectionOrder: string[];
    manualSourceSelection: boolean;
    enableDoubleClickToSeek: boolean;
    enableAutoResumeOnPlaybackError: boolean;
    enablePauseOverlay: boolean;
  } | null,
) {
  return {
    id: userId,
    applicationTheme: settings?.applicationTheme ?? null,
    customTheme: settings?.customTheme ?? null,
    applicationLanguage: settings?.applicationLanguage ?? "en",
    defaultSubtitleLanguage: settings?.defaultSubtitleLanguage ?? null,
    proxyUrls: !settings?.proxyUrls?.length ? null : settings.proxyUrls,
    traktKey: settings?.traktKey ?? null,
    febboxKey: settings?.febboxKey ?? null,
    debridToken: settings?.debridToken ?? null,
    debridService: settings?.debridService ?? null,
    tidbKey: settings?.tidbKey ?? null,
    enableThumbnails: settings?.enableThumbnails ?? false,
    enableAutoplay: settings?.enableAutoplay ?? true,
    enableSkipCredits: settings?.enableSkipCredits ?? true,
    enableDiscover: settings?.enableDiscover ?? true,
    enableFeatured: settings?.enableFeatured ?? false,
    enableDetailsModal: settings?.enableDetailsModal ?? false,
    enableImageLogos: settings?.enableImageLogos ?? true,
    enableCarouselView: settings?.enableCarouselView ?? false,
    forceCompactEpisodeView: settings?.forceCompactEpisodeView ?? false,
    sourceOrder: settings?.sourceOrder ?? [],
    enableSourceOrder: settings?.enableSourceOrder ?? false,
    disabledSources: settings?.disabledSources ?? [],
    embedOrder: settings?.embedOrder ?? [],
    enableEmbedOrder: settings?.enableEmbedOrder ?? false,
    disabledEmbeds: settings?.disabledEmbeds ?? [],
    proxyTmdb: settings?.proxyTmdb ?? false,
    enableLowPerformanceMode: settings?.enableLowPerformanceMode ?? false,
    enableNativeSubtitles: settings?.enableNativeSubtitles ?? false,
    enableHoldToBoost: settings?.enableHoldToBoost ?? false,
    homeSectionOrder: settings?.homeSectionOrder ?? [],
    manualSourceSelection: settings?.manualSourceSelection ?? false,
    enableDoubleClickToSeek: settings?.enableDoubleClickToSeek ?? false,
    enableAutoResumeOnPlaybackError: settings?.enableAutoResumeOnPlaybackError ?? false,
    enablePauseOverlay: settings?.enablePauseOverlay ?? false,
  };
}

export function buildSettingsWriteData(validated: z.infer<typeof userSettingsSchema>) {
  return {
    applicationTheme: validated.applicationTheme ?? null,
    customTheme: validated.customTheme ?? null,
    applicationLanguage: validated.applicationLanguage,
    defaultSubtitleLanguage: validated.defaultSubtitleLanguage ?? null,
    proxyUrls: validated.proxyUrls === null ? [] : validated.proxyUrls || [],
    traktKey: validated.traktKey ?? null,
    febboxKey: validated.febboxKey ?? null,
    debridToken: validated.debridToken ?? null,
    debridService: validated.debridService ?? null,
    tidbKey: validated.tidbKey ?? null,
    enableThumbnails: validated.enableThumbnails,
    enableAutoplay: validated.enableAutoplay,
    enableSkipCredits: validated.enableSkipCredits,
    enableDiscover: validated.enableDiscover,
    enableFeatured: validated.enableFeatured,
    enableDetailsModal: validated.enableDetailsModal,
    enableImageLogos: validated.enableImageLogos,
    enableCarouselView: validated.enableCarouselView,
    forceCompactEpisodeView: validated.forceCompactEpisodeView,
    sourceOrder: validated.sourceOrder || [],
    enableSourceOrder: validated.enableSourceOrder,
    disabledSources: validated.disabledSources || [],
    embedOrder: validated.embedOrder || [],
    enableEmbedOrder: validated.enableEmbedOrder,
    disabledEmbeds: validated.disabledEmbeds || [],
    proxyTmdb: validated.proxyTmdb,
    enableLowPerformanceMode: validated.enableLowPerformanceMode,
    enableNativeSubtitles: validated.enableNativeSubtitles,
    enableHoldToBoost: validated.enableHoldToBoost,
    homeSectionOrder: validated.homeSectionOrder || [],
    manualSourceSelection: validated.manualSourceSelection,
    enableDoubleClickToSeek: validated.enableDoubleClickToSeek,
    enableAutoResumeOnPlaybackError: validated.enableAutoResumeOnPlaybackError,
    enablePauseOverlay: validated.enablePauseOverlay,
  };
}

export function buildPartialSettingsUpdate(
  body: Record<string, unknown>,
  createData: ReturnType<typeof buildSettingsWriteData>,
) {
  const updateData: Partial<ReturnType<typeof buildSettingsWriteData>> = {};
  const fieldMap: Record<string, keyof ReturnType<typeof buildSettingsWriteData>> = {
    applicationTheme: "applicationTheme",
    customTheme: "customTheme",
    applicationLanguage: "applicationLanguage",
    defaultSubtitleLanguage: "defaultSubtitleLanguage",
    proxyUrls: "proxyUrls",
    traktKey: "traktKey",
    febboxKey: "febboxKey",
    debridToken: "debridToken",
    debridService: "debridService",
    tidbKey: "tidbKey",
    enableThumbnails: "enableThumbnails",
    enableAutoplay: "enableAutoplay",
    enableSkipCredits: "enableSkipCredits",
    enableDiscover: "enableDiscover",
    enableFeatured: "enableFeatured",
    enableDetailsModal: "enableDetailsModal",
    enableImageLogos: "enableImageLogos",
    enableCarouselView: "enableCarouselView",
    forceCompactEpisodeView: "forceCompactEpisodeView",
    sourceOrder: "sourceOrder",
    enableSourceOrder: "enableSourceOrder",
    disabledSources: "disabledSources",
    embedOrder: "embedOrder",
    enableEmbedOrder: "enableEmbedOrder",
    disabledEmbeds: "disabledEmbeds",
    proxyTmdb: "proxyTmdb",
    enableLowPerformanceMode: "enableLowPerformanceMode",
    enableNativeSubtitles: "enableNativeSubtitles",
    enableHoldToBoost: "enableHoldToBoost",
    homeSectionOrder: "homeSectionOrder",
    manualSourceSelection: "manualSourceSelection",
    enableDoubleClickToSeek: "enableDoubleClickToSeek",
    enableAutoResumeOnPlaybackError: "enableAutoResumeOnPlaybackError",
    enablePauseOverlay: "enablePauseOverlay",
  };

  for (const [bodyKey, dataKey] of Object.entries(fieldMap)) {
    if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
      updateData[dataKey] = createData[dataKey] as never;
    }
  }

  return updateData;
}
