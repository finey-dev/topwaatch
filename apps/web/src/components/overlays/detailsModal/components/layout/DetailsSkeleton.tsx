export function DetailsSkeleton() {
  // Static arrays of unique identifiers for skeleton elements
  const episodeSkeletons = [
    "episode-skeleton-1",
    "episode-skeleton-2",
    "episode-skeleton-3",
    "episode-skeleton-4",
  ];
  const castSkeletons = [
    "cast-skeleton-1",
    "cast-skeleton-2",
    "cast-skeleton-3",
    "cast-skeleton-4",
    "cast-skeleton-5",
    "cast-skeleton-6",
  ];

  return (
    <div className="relative h-full flex flex-col animate-pulse">
      {/* Backdrop */}
      <div
        className="relative -mt-12 z-20"
        style={{
          height: "500px",
        }}
      >
        {/* Title/Logo positioned on backdrop */}
        <div className="absolute inset-x-0 bottom-20 z-30 px-6">
          <div className="h-12 w-64 bg-white/10 rounded-lg" />{" "}
          {/* Logo/Title placeholder */}
        </div>
        <div
          className="absolute inset-0 bg-white/10"
          style={{
            maskImage:
              "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 120px)",
            WebkitMaskImage:
              "linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1) 120px)",
            zIndex: -1,
          }}
        />
      </div>

      {/* Content */}
      <div className="px-6 pb-6 mt-[-70px] flex-grow relative z-30">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="h-10 w-32 bg-white/10 rounded-lg" />{" "}
          {/* Play button */}
          <div className="h-10 w-32 bg-white/10 rounded-lg" />{" "}
          {/* Trailer button */}
          <div className="h-10 w-32 bg-white/10 rounded-lg" />{" "}
          {/* Share button */}
          <div className="flex-1" />
          <div className="h-6 w-24 bg-white/10 rounded-lg" /> {/* Rating */}
          <div className="h-6 w-24 bg-white/10 rounded-lg" />{" "}
          {/* Release date */}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:gap-6 pt-4">
          {/* Left Column */}
          <div className="md:col-span-2">
            {/* Description */}
            <div className="space-y-2 mb-6">
              <div className="h-4 w-full bg-white/10 rounded" />
              <div className="h-4 w-5/6 bg-white/10 rounded" />
              <div className="h-4 w-4/6 bg-white/10 rounded" />
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="h-6 w-20 bg-white/10 rounded-full" />
              <div className="h-6 w-24 bg-white/10 rounded-full" />
              <div className="h-6 w-16 bg-white/10 rounded-full" />
            </div>

            {/* Episodes */}
            <div className="space-y-3 mt-8">
              <div className="h-6 w-32 bg-white/10 rounded mb-4" />
              {episodeSkeletons.map((id) => (
                <div key={id} className="flex gap-3">
                  <div className="h-20 w-32 bg-white/10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-3/4 bg-white/10 rounded" />
                    <div className="h-3 w-full bg-white/10 rounded" />
                    <div className="h-3 w-5/6 bg-white/10 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4 mt-6 md:mt-0">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-4 w-32 bg-white/10 rounded" />
            <div className="h-4 w-28 bg-white/10 rounded" />
            <div className="h-4 w-20 bg-white/10 rounded" />

            {/* Cast */}
            <div className="pt-6">
              <div className="h-5 w-16 bg-white/10 rounded mb-3" />
              <div className="flex gap-3 overflow-hidden">
                {castSkeletons.map((id) => (
                  <div key={id} className="flex-shrink-0 w-16">
                    <div className="h-16 w-16 bg-white/10 rounded-full mb-2" />
                    <div className="h-3 w-full bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
