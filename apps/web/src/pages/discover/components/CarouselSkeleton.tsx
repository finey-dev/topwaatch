import React from "react";

import { MediaCard } from "@/components/media/MediaCard";

interface CarouselSkeletonProps {
  isTVShow?: boolean;
  count?: number;
  /** Show a pulsing title bar above the cards */
  showTitle?: boolean;
  categoryKey?: string;
}

export function CarouselSkeleton({
  isTVShow = false,
  count = 10,
  showTitle = true,
  categoryKey = "skeleton",
}: CarouselSkeletonProps) {
  return (
    <div>
      {showTitle && (
        <div className="flex items-center justify-between ml-2 md:ml-8 mt-2">
          <div className="flex flex-col pl-2 lg:pl-[68px]">
            <div className="h-7 w-48 animate-pulse rounded bg-mediaCard-hoverBackground" />
          </div>
        </div>
      )}
      <div className="relative overflow-hidden carousel-container md:pb-4">
        <div className="grid grid-flow-col auto-cols-max gap-4 pt-0 overflow-x-hidden rounded-xl md:pl-8 md:pr-8">
          <div className="lg:w-12" />
          {Array.from({ length: count }, (_, index) => (
            <div
              key={`${categoryKey}-${index}`}
              className="relative mt-4 group cursor-default user-select-none rounded-xl p-2 bg-transparent w-[10rem] md:w-[11.5rem] h-auto"
            >
              <MediaCard
                media={{
                  id: `${categoryKey}-${index}`,
                  title: "",
                  poster: "",
                  type: isTVShow ? "show" : "movie",
                }}
                forceSkeleton
              />
            </div>
          ))}
          <div className="lg:w-12" />
        </div>
      </div>
    </div>
  );
}
