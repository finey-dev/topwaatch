import { useCallback, useEffect, useRef, useState } from "react";
import { LinkPreview } from "@/components/LinkPreview";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { decodeTMDBId, mediaItemToId } from "@/backend/metadata/tmdb";
import { MWMediaType } from "@/backend/metadata/types/mw";
import { Icon, Icons } from "@/components/Icon";
import { DetailsContent } from "@/components/overlays/detailsModal/components/layout/DetailsContent";
import { DetailsSkeleton } from "@/components/overlays/detailsModal/components/layout/DetailsSkeleton";
import { fetchDetailsContent } from "@/components/overlays/detailsModal/utils/fetchDetailsContent";
import type { DetailsContent as DetailsContentData } from "@/components/overlays/detailsModal/types";
import { FooterView } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { BlurEllipsis } from "@/pages/layouts/SubPageLayout";

function mediaTypeToDetailsType(
  type: MWMediaType,
): "movie" | "show" | null {
  if (type === MWMediaType.MOVIE) return "movie";
  if (type === MWMediaType.SERIES) return "show";
  return null;
}

export function DetailsPage() {
  const { media: mediaParam } = useParams<{ media: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [detailsData, setDetailsData] = useState<DetailsContentData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trailerPlaying, setTrailerPlaying] = useState(false);
  const closeTrailerRef = useRef<(() => void) | null>(null);

  const registerCloseTrailer = useCallback((close: (() => void) | null) => {
    closeTrailerRef.current = close;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!mediaParam) {
        setError("Missing media id");
        setIsLoading(false);
        return;
      }

      const decoded = decodeTMDBId(decodeURIComponent(mediaParam));
      if (!decoded) {
        setError("Invalid media id");
        setIsLoading(false);
        return;
      }

      const type = mediaTypeToDetailsType(decoded.type);
      if (!type) {
        setError("Unsupported media type");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setDetailsData(null);
      setTrailerPlaying(false);

      try {
        const data = await fetchDetailsContent(decoded.id, type);
        if (!cancelled) setDetailsData(data);
      } catch (err) {
        console.error("Failed to fetch media details:", err);
        if (!cancelled) setError("Failed to load details");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [mediaParam]);

  // Keep the URL slug in sync once we have the canonical title from TMDB
  useEffect(() => {
    if (!detailsData?.id || !detailsData.title || !detailsData.type) return;
    const canonical = mediaItemToId({
      id: detailsData.id.toString(),
      title: detailsData.title,
      type: detailsData.type,
      year: detailsData.releaseDate
        ? new Date(detailsData.releaseDate).getFullYear()
        : 0,
    });
    const current = mediaParam ? decodeURIComponent(mediaParam) : "";
    if (current !== canonical) {
      navigate(`/details/${encodeURIComponent(canonical)}`, { replace: true });
    }
  }, [detailsData, mediaParam, navigate]);

  return (
    <div className="bg-background-main min-h-screen">
      <LinkPreview
        title={
          detailsData?.title
            ? t("global.pages.pagetitle", { title: detailsData.title })
            : t("global.name")
        }
        description={detailsData?.overview}
        image={detailsData?.posterUrl ?? detailsData?.backdrop}
        imageAlt={
          detailsData?.title
            ? `${detailsData.title} on TopWaatch`
            : undefined
        }
      />
      <BlurEllipsis />
      <FooterView>
        <Navigation doBackground noLightbar />
        <div className="relative mx-auto w-full max-w-[1200px] px-2 sm:px-4 pt-20 pb-10">
          <div className="relative rounded-3xl bg-mediaCard-hoverBackground/60 backdrop-filter backdrop-blur-lg shadow-lg overflow-hidden border border-white/5">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate("/");
              }}
              className="absolute top-4 left-4 sm:top-5 sm:left-5 z-[60] inline-flex items-center gap-2 rounded-full bg-black/70 hover:bg-black/85 border border-white/20 backdrop-blur-md px-3.5 py-2 text-sm font-medium text-white shadow-xl transition-colors"
            >
              <Icon icon={Icons.ARROW_LEFT} />
              <span>Back</span>
            </button>
            {trailerPlaying ? (
              <button
                type="button"
                onClick={() => closeTrailerRef.current?.()}
                className="absolute top-4 right-4 sm:top-5 sm:right-5 z-[60] inline-flex items-center gap-2 rounded-full bg-black/70 hover:bg-black/85 border border-white/20 backdrop-blur-md px-3.5 py-2 text-sm font-medium text-white shadow-xl transition-colors"
              >
                <Icon icon={Icons.X} />
                <span>Close Trailer</span>
              </button>
            ) : null}

            {isLoading || (!detailsData && !error) ? (
              <DetailsSkeleton />
            ) : error || !detailsData ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
                <p className="text-white/80">{error ?? "Not found"}</p>
                <button
                  type="button"
                  className="text-sm text-type-link hover:underline"
                  onClick={() => navigate("/")}
                >
                  Go home
                </button>
              </div>
            ) : (
              <DetailsContent
                data={detailsData}
                onTrailerPlayingChange={setTrailerPlaying}
                registerCloseTrailer={registerCloseTrailer}
              />
            )}
          </div>
        </div>
      </FooterView>
    </div>
  );
}
