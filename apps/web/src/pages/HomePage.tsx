import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { To, useNavigate } from "react-router-dom";

import { detailsPathFromMedia } from "@/backend/metadata/tmdb";
import { LinkPreview } from "@/components/LinkPreview";
import { WideContainer } from "@/components/layout/WideContainer";
import { useDebounce } from "@/hooks/useDebounce";
import { useRandomTranslation } from "@/hooks/useRandomTranslation";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { FeaturedCarousel } from "@/pages/discover/components/FeaturedCarousel";
import type { FeaturedMedia } from "@/pages/discover/components/FeaturedCarousel";
import DiscoverContent from "@/pages/discover/discoverContent";
import { HomeLayout } from "@/pages/layouts/HomeLayout";
import { BookmarksCarousel } from "@/pages/parts/home/BookmarksCarousel";
import { BookmarksGrid } from "@/pages/parts/home/BookmarksGrid";
import { HeroPart } from "@/pages/parts/home/HeroPart";
import { WatchingCarousel } from "@/pages/parts/home/WatchingCarousel";
import { WatchingGrid } from "@/pages/parts/home/WatchingGrid";
import { SearchListPart } from "@/pages/parts/search/SearchListPart";
import { SearchLoadingPart } from "@/pages/parts/search/SearchLoadingPart";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { MediaItem } from "@/utils/mediaTypes";
import { toAbsoluteUrl } from "@/utils/siteMeta";

import { Button } from "./About";
import { FebboxRecommendationModal } from "./parts/home/FebboxRecommendationModal";
// Re-enable when a TopWaatch rebrand/announcement banner is needed again.
// import { RevivalAnnouncementModal } from "./parts/home/RevivalAnnouncementModal";

const DEFAULT_HOME_SECTIONS = ["watching", "bookmarks"];

function useSearch(search: string) {
  const [searching, setSearching] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const debouncedSearch = useDebounce<string>(search, 500);
  useEffect(() => {
    setSearching(search !== "");
    setLoading(search !== "");
    if (search !== "") {
      window.scrollTo(0, 0);
    }
  }, [search]);
  useEffect(() => {
    setLoading(false);
  }, [debouncedSearch]);

  return {
    loading,
    searching,
  };
}

// What the sigma?

export function HomePage() {
  const { t } = useTranslation();
  const { t: randomT } = useRandomTranslation();
  const emptyText = randomT(`home.search.empty`);
  const navigate = useNavigate();
  const [showBg, setShowBg] = useState<boolean>(false);
  const searchParams = useSearchQuery();
  const [search] = searchParams;
  const s = useSearch(search);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showWatching, setShowWatching] = useState(false);
  const account = useAuthStore((state) => state.account);
  const enableDiscover = usePreferencesStore((state) => state.enableDiscover);
  const enableFeatured = usePreferencesStore((state) => state.enableFeatured);
  const carouselRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const enableCarouselView = usePreferencesStore(
    (state) => state.enableCarouselView,
  );
  const enableLowPerformanceMode = usePreferencesStore(
    (state) => state.enableLowPerformanceMode,
  );
  const homeSectionOrder = usePreferencesStore(
    (state) => state.homeSectionOrder,
  );

  const sectionsToRender = useMemo(() => {
    // Continue watching / bookmarks only for logged-in users
    if (!account) return [];

    const order =
      homeSectionOrder?.length > 0
        ? [...homeSectionOrder]
        : [...DEFAULT_HOME_SECTIONS];

    // Ensure continue watching is always present for logged-in users
    if (!order.includes("watching")) {
      order.unshift("watching");
    }

    return order;
  }, [account, homeSectionOrder]);

  const [carouselContainerRef] = useAutoAnimate<HTMLDivElement>();
  const [listContainerRef] = useAutoAnimate<HTMLDivElement>();

  const handleClick = (path: To) => {
    window.scrollTo(0, 0);
    navigate(path);
  };

  const handleShowDetails = (media: MediaItem | FeaturedMedia) => {
    navigate(detailsPathFromMedia(media));
  };

  const renderHomeSections = () => {
    if (sectionsToRender.length === 0) return null;

    const sections = sectionsToRender.map((section) => {
      switch (section) {
        case "watching":
          return enableCarouselView ? (
            <WatchingCarousel
              key="watching"
              carouselRefs={carouselRefs}
              onShowDetails={handleShowDetails}
            />
          ) : (
            <WatchingGrid
              key="watching"
              onItemsChange={setShowWatching}
              onShowDetails={handleShowDetails}
            />
          );
        case "bookmarks":
          return enableCarouselView ? (
            <BookmarksCarousel
              key="bookmarks"
              carouselRefs={carouselRefs}
              onShowDetails={handleShowDetails}
            />
          ) : (
            <BookmarksGrid
              key="bookmarks"
              onItemsChange={setShowBookmarks}
              onShowDetails={handleShowDetails}
            />
          );
        default:
          return null;
      }
    });

    if (enableCarouselView) {
      return (
        <WideContainer ultraWide classNames="!px-3 md:!px-9">
          <div ref={carouselContainerRef} className="flex flex-col gap-8">
            {sections}
          </div>
        </WideContainer>
      );
    }
    return (
      <WideContainer>
        <div ref={listContainerRef} className="flex flex-col gap-8">{sections}</div>
      </WideContainer>
    );
  };

  return (
    <HomeLayout showBg={showBg}>
      {!search && <FebboxRecommendationModal />}
      <div className="mb-0">
        <LinkPreview
          title={t("global.homeTitle")}
          description={t("about.description")}
          url={toAbsoluteUrl("/")}
        />
        <Helmet>
          <style type="text/css">{`
            html, body {
              scrollbar-gutter: stable;
            }
          `}</style>
        </Helmet>
        {enableFeatured ? (
          <FeaturedCarousel
            forcedCategory="movies"
            onShowDetails={handleShowDetails}
            searching={s.searching}
            shorter
          >
            <HeroPart
              searchParams={searchParams}
              setIsSticky={setShowBg}
              isInFeatured
            />
          </FeaturedCarousel>
        ) : (
          <HeroPart
            searchParams={searchParams}
            setIsSticky={setShowBg}
            showTitle
          />
        )}

        {/* Temporarily disabled  rebrand notice not needed yet.
        <RevivalAnnouncementModal />
        */}
      </div>

      {/* Search */}
      {search && (
        <WideContainer>
          {s.loading ? (
            <SearchLoadingPart />
          ) : (
            s.searching && (
              <SearchListPart
                searchQuery={search}
                onShowDetails={handleShowDetails}
              />
            )
          )}
        </WideContainer>
      )}

      {/* User Content */}
      {!search && (
        <div className="relative">
          {renderHomeSections()}
        </div>
      )}

      {/* Under user content */}
      <WideContainer ultraWide classNames="!px-3 md:!px-9">
        {/* Empty text */}
        {!(showBookmarks || showWatching) &&
        (!enableDiscover || enableLowPerformanceMode) ? (
          <div className="flex flex-col translate-y-[-30px] items-center justify-center pt-20">
            <p className="text-[18.5px] pb-3">{emptyText}</p>
          </div>
        ) : null}

        {/* Discover Spacing */}
        {enableDiscover &&
          (enableFeatured ? (
            <div className="pb-1" />
          ) : showBookmarks || showWatching ? (
            <div className="pb-4" />
          ) : (
            <div className="pb-2" />
          ))}
        {/* there... perfect. */}

        {/* Discover section or discover button */}
        {enableDiscover && !search && !enableLowPerformanceMode ? (
          <DiscoverContent />
        ) : (
          <div className="flex flex-col justify-center items-center h-40 space-y-4">
            <div className="flex flex-col items-center justify-center">
              {!search && !enableLowPerformanceMode && (
                <Button
                  className="px-py p-[0.35em] mt-3 rounded-xl text-type-dimmed box-content text-[18px] bg-largeCard-background justify-center items-center"
                  onClick={() => handleClick("/discover")}
                >
                  {t("home.search.discover")}
                </Button>
              )}
            </div>
          </div>
        )}
      </WideContainer>
    </HomeLayout>
  );
}
