import {
  getMediaBackdrop,
  getMediaDetails,
  getMediaLogo,
  getMediaPoster,
} from "@/backend/metadata/tmdb";
import {
  TMDBContentTypes,
  TMDBMovieData,
  TMDBShowData,
} from "@/backend/metadata/types/tmdb";

import { DetailsContent } from "../types";

export async function fetchDetailsContent(
  id: string | number,
  type: "movie" | "show",
): Promise<DetailsContent> {
  const contentType =
    type === "movie" ? TMDBContentTypes.MOVIE : TMDBContentTypes.TV;
  const details = await getMediaDetails(id.toString(), contentType, false);
  const backdropUrl = getMediaBackdrop(details.backdrop_path) ?? undefined;
  const logoUrl = (await getMediaLogo(id.toString(), contentType)) ?? undefined;

  if (contentType === TMDBContentTypes.MOVIE) {
    const movieDetails = details as TMDBMovieData;
    return {
      title: movieDetails.title,
      overview: movieDetails.overview ?? undefined,
      backdrop: backdropUrl,
      posterUrl: getMediaPoster(movieDetails.poster_path) ?? undefined,
      runtime: movieDetails.runtime,
      genres: movieDetails.genres,
      language: movieDetails.original_language,
      voteAverage: movieDetails.vote_average,
      voteCount: movieDetails.vote_count,
      releaseDate: movieDetails.release_date,
      rating: movieDetails.release_dates?.results?.find(
        (r) => r.iso_3166_1 === "US",
      )?.release_dates?.[0]?.certification,
      type: "movie",
      id: movieDetails.id,
      imdbId: movieDetails.external_ids?.imdb_id ?? undefined,
      logoUrl,
      collection: movieDetails.belongs_to_collection,
    };
  }

  const showDetails = details as TMDBShowData & {
    episodes: Array<{
      id: number;
      name: string;
      episode_number: number;
      overview: string;
      still_path: string | null;
      air_date: string;
      season_number: number;
      vote_average?: number;
      vote_count?: number;
    }>;
  };

  return {
    title: showDetails.name,
    overview: showDetails.overview ?? undefined,
    backdrop: backdropUrl,
    posterUrl: getMediaPoster(showDetails.poster_path) ?? undefined,
    episodes: showDetails.number_of_episodes,
    seasons: showDetails.number_of_seasons,
    genres: showDetails.genres,
    language: showDetails.original_language,
    voteAverage: showDetails.vote_average,
    voteCount: showDetails.vote_count,
    releaseDate: showDetails.first_air_date,
    rating: showDetails.content_ratings?.results?.find(
      (r) => r.iso_3166_1 === "US",
    )?.rating,
    type: "show",
    id: showDetails.id,
    imdbId: showDetails.external_ids?.imdb_id ?? undefined,
    seasonData: {
      seasons: showDetails.seasons,
      episodes: (showDetails.episodes ?? []).map((ep) => ({
        id: ep.id,
        name: ep.name,
        overview: ep.overview,
        episode_number: ep.episode_number,
        season_number: ep.season_number,
        still_path: ep.still_path,
        air_date: ep.air_date,
        vote_average: ep.vote_average ?? 0,
        vote_count: ep.vote_count ?? 0,
      })),
    },
    logoUrl,
  };
}
