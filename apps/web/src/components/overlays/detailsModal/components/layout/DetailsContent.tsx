import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCopyToClipboard } from "react-use";

import {
  getMediaVideos,
  getSeasonDetails,
  detailsPathFromMedia,
  mediaDetailsPath,
  mediaItemToId,
} from "@/backend/metadata/tmdb";
import { TMDBContentTypes } from "@/backend/metadata/types/tmdb";
import { Icon, Icons } from "@/components/Icon";
import { useLanguageStore } from "@/stores/language";
import { usePreferencesStore } from "@/stores/preferences";
import { getProgressPercentage, useProgressStore } from "@/stores/progress";
import { shouldShowProgress } from "@/stores/progress/utils";
import { scrapeIMDb } from "@/utils/imdbScraper";
import { getTmdbLanguageCode } from "@/utils/language";
import { scrapeRottenTomatoes } from "@/utils/rottenTomatoesScraper";

import { DetailsContentProps } from "../../types";
import { EpisodeCarousel } from "../carousels/EpisodeCarousel";
import { CastCarousel } from "../carousels/PeopleCarousel";
import { SimilarMediaCarousel } from "../carousels/SimilarMediaCarousel";
import { TrailerCarousel } from "../carousels/TrailerCarousel";
import { CollectionOverlay } from "../overlays/CollectionOverlay";
import { DetailsBody } from "../sections/DetailsBody";
import { DetailsInfo } from "../sections/DetailsInfo";

function toYoutubeEmbed(key: string): string {
  return `https://www.youtube.com/embed/${key}?autoplay=1&rel=0`;
}

export function DetailsContent({
  data,
  minimal = false,
  onTrailerPlayingChange,
  registerCloseTrailer,
}: DetailsContentProps) {
  const navigate = useNavigate();
  const [imdbData, setImdbData] = useState<any>(null);
  const [rtData, setRtData] = useState<any>(null);
  const [, setIsLoadingImdb] = useState(false);
  const [tmdbTrailerKey, setTmdbTrailerKey] = useState<string | null>(null);
  const [playingTrailerUrl, setPlayingTrailerUrl] = useState<string | null>(
    null,
  );
  const [showCollection, setShowCollection] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [fetchedSeasons, setFetchedSeasons] = useState<Record<number, any[]>>(
    {},
  );
  const [loadingSeasons, setLoadingSeasons] = useState<Record<number, boolean>>(
    {},
  );
  const [, copyToClipboard] = useCopyToClipboard();
  const [hasCopiedShare, setHasCopiedShare] = useState(false);
  const [logoHeight, setLogoHeight] = useState<number>(0);
  const logoRef = useRef<HTMLDivElement>(null);
  const closeTrailerRef = useRef<() => void>(() => {});
  const progress = useProgressStore((s) => s.items);
  const updateItem = useProgressStore((s) => s.updateItem);
  const enableImageLogos = usePreferencesStore(
    (state) => state.enableImageLogos,
  );

  // Check if movie is watched (>90% progress)
  const isMovieWatched = useMemo(() => {
    if (data.type !== "movie" || !data.id) return false;
    const movieProgress = progress[data.id.toString()]?.progress;
    if (!movieProgress) return false;
    const percentage = getProgressPercentage(
      movieProgress.watched,
      movieProgress.duration,
    );
    return percentage > 90;
  }, [data.type, data.id, progress]);

  const showProgress = useMemo(() => {
    if (!data.id) return null;
    const item = progress[data.id.toString()];
    if (!item) return null;
    return shouldShowProgress(item);
  }, [data.id, progress]);

  // Set initial season based on current episode
  useEffect(() => {
    if (showProgress?.season?.number) {
      setSelectedSeason(showProgress.season.number);
    }
  }, [showProgress]);

  // Fetch episodes for selected season
  useEffect(() => {
    const fetchSeason = async (seasonNumber: number) => {
      if (
        !data.id ||
        seasonNumber === -1 ||
        fetchedSeasons[seasonNumber] ||
        loadingSeasons[seasonNumber]
      )
        return;

      setLoadingSeasons((prev) => ({ ...prev, [seasonNumber]: true }));
      try {
        const episodes = await getSeasonDetails(
          data.id.toString(),
          seasonNumber,
        );
        setFetchedSeasons((prev) => ({ ...prev, [seasonNumber]: episodes }));
      } catch (err) {
        console.error("Failed to fetch season details:", err);
      } finally {
        setLoadingSeasons((prev) => ({ ...prev, [seasonNumber]: false }));
      }
    };

    if (data.type === "show") {
      if (selectedSeason !== -1) {
        fetchSeason(selectedSeason);
      } else if (data.seasonData?.seasons) {
        // Fetch all seasons for favorites
        data.seasonData.seasons.forEach((season) => {
          fetchSeason(season.season_number);
        });
      }
    }
  }, [
    data.id,
    data.type,
    selectedSeason,
    fetchedSeasons,
    loadingSeasons,
    data.seasonData,
  ]);

  const allEpisodes = useMemo(() => {
    return Object.values(fetchedSeasons).flat();
  }, [fetchedSeasons]);

  // Add effect to measure logo height (ignore sub-pixel thrash)
  useEffect(() => {
    if (!logoRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = entry.contentRect.height;
        setLogoHeight((prev) => (Math.abs(prev - next) < 1 ? prev : next));
      }
    });

    resizeObserver.observe(logoRef.current);
    return () => resizeObserver.disconnect();
  }, [data.logoUrl, enableImageLogos, data.title, playingTrailerUrl]);

  useEffect(() => {
    const fetchExternalData = async () => {
      if (!data.imdbId) return;

      setIsLoadingImdb(true);
      try {
        // Get the user's selected language and format it properly
        const userLanguage = useLanguageStore.getState().language;
        const formattedLanguage = getTmdbLanguageCode(userLanguage);

        // Fetch IMDb data
        const imdbMetadata = await scrapeIMDb(
          data.imdbId,
          undefined,
          undefined,
          formattedLanguage,
          data.type,
        );
        // Transform the data to match the expected format
        if (
          (typeof imdbMetadata.imdb_rating === "number" &&
            typeof imdbMetadata.votes === "number") ||
          imdbMetadata.trailer_url
        ) {
          setImdbData({
            rating: imdbMetadata.imdb_rating,
            votes: imdbMetadata.votes,
            trailer_url: imdbMetadata.trailer_url,
          });
        } else {
          setImdbData(null);
        }

        // Fetch Rotten Tomatoes data
        if (data.type === "movie") {
          const rtMetadata = await scrapeRottenTomatoes(
            data.title,
            data.releaseDate
              ? new Date(data.releaseDate).getFullYear()
              : undefined,
          );
          setRtData(rtMetadata);
        }
      } catch (error) {
        console.error("Failed to fetch external data:", error);
      } finally {
        setIsLoadingImdb(false);
      }
    };

    fetchExternalData();
  }, [data.imdbId, data.title, data.releaseDate, data.type]);

  // Prefetch primary TMDB trailer for the Watch Trailer button
  useEffect(() => {
    let cancelled = false;
    const loadTrailer = async () => {
      if (!data.id || !data.type) {
        setTmdbTrailerKey(null);
        return;
      }
      try {
        const videos = await getMediaVideos(
          data.id.toString(),
          data.type === "movie" ? TMDBContentTypes.MOVIE : TMDBContentTypes.TV,
        );
        const sorted = [...videos].sort((a, b) => {
          if (a.official !== b.official) return b.official ? 1 : -1;
          if (a.type !== b.type) return a.type === "Trailer" ? -1 : 1;
          return 0;
        });
        if (!cancelled) setTmdbTrailerKey(sorted[0]?.key ?? null);
      } catch (err) {
        console.error("Failed to load TMDB trailer:", err);
        if (!cancelled) setTmdbTrailerKey(null);
      }
    };
    setPlayingTrailerUrl(null);
    loadTrailer();
    return () => {
      cancelled = true;
    };
  }, [data.id, data.type]);

  const mediaAsItem = useMemo(() => {
    if (!data.id || !data.title || !data.type) return null;
    return {
      id: data.id.toString(),
      title: data.title,
      type: data.type,
      year: data.releaseDate
        ? new Date(data.releaseDate).getFullYear()
        : 0,
    };
  }, [data.id, data.title, data.type, data.releaseDate]);

  const handlePlayClick = () => {
    if (!mediaAsItem) return;
    if (data.type === "movie") {
      navigate(`/media/${encodeURIComponent(mediaItemToId(mediaAsItem))}`);
    } else if (data.type === "show") {
      if (showProgress?.season?.id && showProgress?.episode?.id) {
        navigate(
          `/media/${encodeURIComponent(mediaItemToId(mediaAsItem))}/${showProgress.season.id}/${showProgress.episode.id}`,
        );
      } else {
        navigate(`/media/${encodeURIComponent(mediaItemToId(mediaAsItem))}`);
      }
    }
  };

  const openTrailer = (url: string) => {
    setPlayingTrailerUrl(url);
  };

  const closeTrailer = useCallback(() => {
    setPlayingTrailerUrl(null);
  }, []);

  closeTrailerRef.current = closeTrailer;

  useEffect(() => {
    onTrailerPlayingChange?.(Boolean(playingTrailerUrl));
  }, [playingTrailerUrl]);  

  useEffect(() => {
    if (!registerCloseTrailer) return;
    registerCloseTrailer(() => closeTrailerRef.current());
    return () => registerCloseTrailer(null);
  }, [registerCloseTrailer]);

  const handleWatchTrailer = () => {
    if (tmdbTrailerKey) {
      openTrailer(toYoutubeEmbed(tmdbTrailerKey));
      return;
    }
    if (imdbData?.trailer_url) {
      openTrailer(imdbData.trailer_url);
    }
  };

  const hasTrailer = Boolean(tmdbTrailerKey || imdbData?.trailer_url);

  const handleShareClick = () => {
    if (!mediaAsItem) return;
    const shareUrl = `${window.location.origin}${mediaDetailsPath(mediaAsItem)}`;

    // Check if the device is iOS and share API is available
    if (/iPad|iPhone|iPod/i.test(navigator.userAgent) && navigator.share) {
      navigator
        .share({
          title: "TopWaatch",
          text: data.title,
          url: shareUrl,
        })
        .catch((error) => console.error("Error sharing:", error));
    } else {
      // Fall back to clipboard copy for non-iOS devices
      copyToClipboard(shareUrl);
      setHasCopiedShare(true);
      setTimeout(() => setHasCopiedShare(false), 2000);
    }
  };

  const toggleMovieWatchStatus = () => {
    if (data.type !== "movie" || !data.id) return;

    // Get the poster URL from the data
    const posterUrl = data.posterUrl;

    // Update progress - if watched, set to 0%, otherwise set to 100% (completed)
    const shouldMarkWatched = !isMovieWatched;
    updateItem({
      meta: {
        tmdbId: data.id.toString(),
        title: data.title || "",
        type: "movie",
        releaseYear: data.releaseDate
          ? new Date(data.releaseDate).getFullYear()
          : new Date().getFullYear(),
        poster: posterUrl,
      },
      progress: {
        watched: shouldMarkWatched ? 60 : 0, // 60 seconds (100%) for watched, 0 for unwatched
        duration: 60,
      },
    });
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Share notification popup */}
      {hasCopiedShare && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg transition-all duration-300 animate-[scaleIn_0.6s_ease-out_forwards]">
          <div className="flex items-center gap-2">
            <Icon icon={Icons.CHECKMARK} className="text-white" />
            <span className="text-sm font-medium">
              Link copied to clipboard!
            </span>
          </div>
        </div>
      )}

      {/* Collection Overlay */}
      {showCollection && data.collection && (
        <CollectionOverlay
          collectionId={data.collection.id}
          collectionName={data.collection.name}
          onClose={() => setShowCollection(false)}
          onMovieClick={(movieId) => {
            setShowCollection(false);
            navigate(
              detailsPathFromMedia({
                id: movieId,
                title: "untitled",
                type: "movie",
              }),
            );
          }}
        />
      )}

      {/* Hero: movie cover OR inline trailer (same frame) */}
      <div
        className="relative -mt-12 z-20"
        style={{
          height: `${Math.max(500, logoHeight + 400)}px`,
        }}
      >
        {playingTrailerUrl ? (
          <>
            {/* No CSS mask on the iframe  masks blank YouTube embeds in Chromium */}
            <div className="absolute inset-0 bg-black">
              {/youtube\.com\/embed|youtu\.be/.test(playingTrailerUrl) ? (
                <iframe
                  key={playingTrailerUrl}
                  src={playingTrailerUrl}
                  title={`${data.title} trailer`}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                />
              ) : (
                <video
                  key={playingTrailerUrl}
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  src={playingTrailerUrl}
                  autoPlay
                  controls
                  playsInline
                />
              )}
            </div>
            {/* Same bottom fade as the cover so content below sits identically */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[150px]"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
              }}
            />
          </>
        ) : (
          <>
            <div ref={logoRef} className="absolute inset-x-0 bottom-20 z-30 px-6">
              {data.logoUrl && enableImageLogos ? (
                <img
                  src={data.logoUrl}
                  alt={data.title}
                  className="max-w-[16rem] md:max-w-[20rem] lg:max-w-[30rem] max-h-[12rem] object-contain drop-shadow-lg bg-transparent"
                  style={{ background: "none" }}
                />
              ) : (
                <h3 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {data.title}
                </h3>
              )}
            </div>
            <div
              className="absolute inset-0 bg-cover bg-top before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]"
              style={{
                backgroundImage: data.backdrop
                  ? `url(${data.backdrop})`
                  : undefined,
                backgroundPosition: "center top",
                maskImage:
                  "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 150px)",
                WebkitMaskImage:
                  "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 150px)",
                zIndex: -1,
              }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div className="px-6 pb-6 mt-[-70px] flex-grow relative z-30">
        <DetailsBody
          data={data}
          onPlayClick={handlePlayClick}
          onShareClick={handleShareClick}
          onWatchTrailer={handleWatchTrailer}
          showWatchTrailer={hasTrailer}
          showProgress={showProgress}
          voteAverage={data.voteAverage}
          voteCount={data.voteCount}
          releaseDate={data.releaseDate}
          seasons={
            data.type === "show" ? data.seasonData?.seasons.length : undefined
          }
          imdbData={imdbData}
        />

        {/* Two Column Layout - Stacked on Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:gap-6 pt-4">
          {/* Left Column - Main Content (2/3) */}
          <div className="md:col-span-2">
            {/* Description */}
            {data.overview && (
              <p className="text-sm text-white/90 mb-6">{data.overview}</p>
            )}

            {/* Genres */}
            {data.genres && data.genres.length > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex flex-wrap gap-2 items-center">
                  {data.genres.map((genre, index) => (
                    <span
                      key={genre.id}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white/80 transition-all duration-300 hover:scale-110 animate-[scaleIn_0.6s_ease-out_forwards]"
                      style={{
                        animationDelay: `${((data.genres?.length ?? 0) - 1 - index) * 60}ms`,
                        transform: "scale(0)",
                        opacity: 0,
                      }}
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
                {/* Movie Watch Toggle Button - Only show for movies and not in minimal modal */}
                {data.type === "movie" && !minimal && (
                  <button
                    type="button"
                    onClick={toggleMovieWatchStatus}
                    className="p-1.5 bg-dropdown-background hover:bg-dropdown-hoverBackground transition-colors rounded-full ml-2"
                    title={
                      isMovieWatched
                        ? t("player.menus.episodes.markAsUnwatched")
                        : t("player.menus.episodes.markAsWatched")
                    }
                  >
                    <Icon
                      icon={isMovieWatched ? Icons.EYE_SLASH : Icons.EYE}
                      className="h-5 w-5 text-white"
                    />
                  </button>
                )}
              </div>
            )}

            {/* Director and Cast */}
            <div className="space-y-4 mb-6">
              {data.director && (
                <div className="text-xs">
                  <span className="font-medium text-white/80">
                    {t("details.director")}
                  </span>{" "}
                  <span className="text-white/70">{data.director}</span>
                </div>
              )}
              {data.actors && data.actors.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium text-white/80">
                    {t("details.cast")}
                  </span>{" "}
                  <span className="text-white/70">
                    {data.actors.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Details Info (1/3) */}
          <div className="md:col-span-1">
            <DetailsInfo
              data={data}
              imdbData={imdbData}
              rtData={rtData}
              onCollectionClick={() => setShowCollection(true)}
            />
          </div>
        </div>

        {/* Episodes Carousel for TV Shows */}
        {data.type === "show" && data.seasonData && !minimal && (
          <EpisodeCarousel
            episodes={allEpisodes}
            showProgress={showProgress}
            progress={progress}
            selectedSeason={selectedSeason}
            onSeasonChange={setSelectedSeason}
            seasons={data.seasonData.seasons}
            mediaId={data.id}
            mediaTitle={data.title}
            mediaPosterUrl={data.posterUrl}
            totalEpisodes={data.episodes}
          />
        )}

        {/* Cast Carousel */}
        {data.id && (
          <CastCarousel
            mediaId={data.id.toString()}
            mediaType={
              data.type === "movie"
                ? TMDBContentTypes.MOVIE
                : TMDBContentTypes.TV
            }
          />
        )}

        {/* Trailer Carousel */}
        {data.id && (
          <TrailerCarousel
            mediaId={data.id.toString()}
            mediaType={
              data.type === "movie"
                ? TMDBContentTypes.MOVIE
                : TMDBContentTypes.TV
            }
            imdbData={imdbData}
            onTrailerClick={(videoKey, isImdbTrailer) => {
              if (isImdbTrailer) {
                openTrailer(videoKey);
              } else {
                openTrailer(toYoutubeEmbed(videoKey));
              }
            }}
          />
        )}

        {/* Similar Media Carousel */}
        {data.id && (
          <SimilarMediaCarousel
            mediaId={data.id.toString()}
            mediaType={
              data.type === "movie"
                ? TMDBContentTypes.MOVIE
                : TMDBContentTypes.TV
            }
          />
        )}
      </div>
    </div>
  );
}
