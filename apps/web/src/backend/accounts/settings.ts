import { AccountWithToken } from "@/stores/auth";
import { KeyboardShortcuts } from "@/utils/keyboardShortcuts";
import { trpcClient } from "@/utils/trpc";

export interface CustomThemeSettings {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  activeTheme?: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  savedCustomThemes?: {
    id: string;
    name: string;
    primary: string;
    secondary: string;
    tertiary: string;
  }[];
  hiddenDefaultThemes?: string[];
}

export interface SettingsInput {
  applicationLanguage?: string;
  applicationTheme?: string | null;
  defaultSubtitleLanguage?: string;
  proxyUrls?: string[] | null;
  febboxKey?: string | null;
  debridToken?: string | null;
  debridService?: string;
  tidbKey?: string | null;
  enableThumbnails?: boolean;
  enableAutoplay?: boolean;
  enableSkipCredits?: boolean;
  enableAutoSkipSegments?: boolean;
  enableDiscover?: boolean;
  enableFeatured?: boolean;
  enableDetailsModal?: boolean;
  enableImageLogos?: boolean;
  enableCarouselView?: boolean;
  enableMinimalCards?: boolean;
  forceCompactEpisodeView?: boolean;
  sourceOrder?: string[] | null;
  enableSourceOrder?: boolean;
  lastSuccessfulSource?: string | null;
  enableLastSuccessfulSource?: boolean;
  embedOrder?: string[] | null;
  enableEmbedOrder?: boolean;
  proxyTmdb?: boolean;
  enableLowPerformanceMode?: boolean;
  enableNativeSubtitles?: boolean;
  enableHoldToBoost?: boolean;
  homeSectionOrder?: string[] | null;
  manualSourceSelection?: boolean;
  enableDoubleClickToSeek?: boolean;
  enableAutoResumeOnPlaybackError?: boolean;
  enablePauseOverlay?: boolean;
  enableNumberKeySeeking?: boolean;
  keyboardShortcuts?: KeyboardShortcuts;
  customTheme?: CustomThemeSettings;
  traktKey?: string | null;
  disabledSources?: string[];
  disabledEmbeds?: string[];
}

export type SettingsResponse = SettingsInput & {
  id?: string;
  // Fields that may exist locally / in older payloads but are not in the API schema yet
  enableAutoSkipSegments?: boolean;
  lastSuccessfulSource?: string | null;
  enableLastSuccessfulSource?: boolean;
  enableMinimalCards?: boolean;
  enableNumberKeySeeking?: boolean;
};

export async function updateSettings(
  _url: string,
  _account: AccountWithToken,
  settings: SettingsInput,
) {
  return trpcClient.settings.update.mutate(
    settings as Parameters<typeof trpcClient.settings.update.mutate>[0],
  );
}

export async function getSettings(_url: string, _account: AccountWithToken) {
  return trpcClient.settings.get.query() as Promise<SettingsResponse>;
}
