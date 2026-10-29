import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  buildTmdbImageUrl,
  type PublicComingSoonResponse,
  type PublicMovieDetail,
  type PublicMovieSummary,
  type PublicNowPlayingResponse,
  type PublicShowtimeDateGroup,
  type PublicShowtimeSlot,
  type WatchlistRow,
} from '@cinemax/shared';
import { getDb } from '../db/index.js';
import { movies, showtimes, studios, watchlists } from '../db/schema.js';
import { AppError } from '../lib/http-error.js';
import type { TmdbClient } from './tmdb-service.js';

export interface PublicMovieStore {
  getActiveNowPlayingMovies(): Promise<
    Array<{
      movie: typeof movies.$inferSelect;
      activeShowtimeCount: number;
    }>
  >;
  findMovieByIdOrTmdbId(idOrTmdb: number): Promise<typeof movies.$inferSelect | null>;
  upsertMovieFromTmdb(data: {
    tmdbId: number;
    title: string;
    overview: string;
    posterPath: string | null;
    backdropPath: string | null;
    releaseDate: string | null;
    runtimeMinutes: number;
    voteAverage: number;
    genres: string[];
    trailerYoutubeKey: string | null;
  }): Promise<typeof movies.$inferSelect>;
  getUpcomingShowtimesForMovie(movieId: number): Promise<
    Array<{
      showtime: typeof showtimes.$inferSelect;
      studio: typeof studios.$inferSelect;
    }>
  >;
  isMovieInWatchlist(userId: number, tmdbId: number): Promise<boolean>;
  addToWatchlist(data: {
    userId: number;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    overview: string | null;
    voteAverage: number;
    releaseDate: string | null;
  }): Promise<void>;
  removeFromWatchlist(userId: number, tmdbId: number): Promise<void>;
  listWatchlist(userId: number): Promise<WatchlistRow[]>;
}

export function createDrizzlePublicMovieStore(): PublicMovieStore {
  return {
    async getActiveNowPlayingMovies() {
      const now = new Date();
      const rows = await getDb()
        .select({
          movie: movies,
          activeShowtimeCount: sql<number>`count(${showtimes.id})::int`,
        })
        .from(movies)
        .innerJoin(showtimes, eq(movies.id, showtimes.movieId))
        .where(gt(showtimes.startTime, now))
        .groupBy(movies.id)
        .orderBy(desc(sql`count(${showtimes.id})`), desc(movies.voteAverage));

      return rows;
    },

    async findMovieByIdOrTmdbId(idOrTmdb: number) {
      const rows = await getDb()
        .select()
        .from(movies)
        .where(sql`${movies.id} = ${idOrTmdb} OR ${movies.tmdbId} = ${idOrTmdb}`)
        .limit(1);
      return rows[0] ?? null;
    },

    async upsertMovieFromTmdb(data) {
      const rows = await getDb()
        .insert(movies)
        .values({
          ...data,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: movies.tmdbId,
          set: {
            title: data.title,
            overview: data.overview,
            posterPath: data.posterPath,
            backdropPath: data.backdropPath,
            releaseDate: data.releaseDate,
            runtimeMinutes: data.runtimeMinutes,
            voteAverage: data.voteAverage,
            genres: data.genres,
            trailerYoutubeKey: data.trailerYoutubeKey,
            syncedAt: new Date(),
          },
        })
        .returning();
      return rows[0]!;
    },

    async getUpcomingShowtimesForMovie(movieId: number) {
      const now = new Date();
      const rows = await getDb()
        .select({
          showtime: showtimes,
          studio: studios,
        })
        .from(showtimes)
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .where(and(eq(showtimes.movieId, movieId), gt(showtimes.startTime, now)))
        .orderBy(showtimes.startTime);

      return rows;
    },

    async isMovieInWatchlist(userId: number, tmdbId: number) {
      const rows = await getDb()
        .select({ id: watchlists.id })
        .from(watchlists)
        .where(and(eq(watchlists.userId, userId), eq(watchlists.tmdbId, tmdbId)))
        .limit(1);
      return rows.length > 0;
    },

    async addToWatchlist(data) {
      await getDb()
        .insert(watchlists)
        .values(data)
        .onConflictDoNothing({ target: [watchlists.userId, watchlists.tmdbId] });
    },

    async removeFromWatchlist(userId: number, tmdbId: number) {
      await getDb()
        .delete(watchlists)
        .where(and(eq(watchlists.userId, userId), eq(watchlists.tmdbId, tmdbId)));
    },

    async listWatchlist(userId: number) {
      const rows = await getDb()
        .select()
        .from(watchlists)
        .where(eq(watchlists.userId, userId))
        .orderBy(desc(watchlists.createdAt));

      return rows.map((r) => ({
        id: r.id,
        tmdbId: r.tmdbId,
        title: r.title,
        posterUrl: buildTmdbImageUrl(r.posterPath, 'w342'),
        overview: r.overview,
        voteAverage: r.voteAverage,
        releaseDate: r.releaseDate,
        createdAt: r.createdAt.toISOString(),
      }));
    },
  };
}

export function createPublicMovieService(
  store: PublicMovieStore = createDrizzlePublicMovieStore(),
  tmdbClient: TmdbClient,
) {
  return {
    async getNowPlaying(): Promise<PublicNowPlayingResponse> {
      // 1. Get local movies with active showtimes
      const activeRows = await store.getActiveNowPlayingMovies();
      const activeTmdbIds = new Set(activeRows.map((r) => r.movie.tmdbId));

      const summaries: PublicMovieSummary[] = activeRows.map((r) => ({
        id: r.movie.id,
        tmdbId: r.movie.tmdbId,
        title: r.movie.title,
        overview: r.movie.overview,
        posterUrl: buildTmdbImageUrl(r.movie.posterPath, 'w500'),
        backdropUrl: buildTmdbImageUrl(r.movie.backdropPath, 'w1280'),
        releaseDate: r.movie.releaseDate,
        voteAverage: Number(r.movie.voteAverage),
        runtimeMinutes: r.movie.runtimeMinutes,
        genres: r.movie.genres ?? [],
        activeShowtimeCount: r.activeShowtimeCount,
      }));

      // 2. Fetch live TMDb now_playing to enrich the list
      try {
        const tmdbData = await tmdbClient.browse('now_playing', 1);
        for (const tm of tmdbData.results) {
          if (!activeTmdbIds.has(tm.id)) {
            summaries.push({
              id: tm.id,
              tmdbId: tm.id,
              title: tm.title,
              overview: tm.overview || '',
              posterUrl: buildTmdbImageUrl(tm.poster_path, 'w500'),
              backdropUrl: buildTmdbImageUrl(tm.backdrop_path, 'w1280'),
              releaseDate: tm.release_date || null,
              voteAverage: Number(tm.vote_average ?? 0),
              runtimeMinutes: 120,
              genres: [],
              activeShowtimeCount: 0,
            });
            activeTmdbIds.add(tm.id);
          }
        }
      } catch {
        // Silently use local list if TMDb fails
      }

      // 3. Determine trending movies for the featured hero banner
      // Prioritize movies with active showtimes, highest ratings, and valid backdrop images
      const sortedByTrend = [...summaries].sort((a, b) => {
        if (a.activeShowtimeCount > 0 && b.activeShowtimeCount === 0) return -1;
        if (b.activeShowtimeCount > 0 && a.activeShowtimeCount === 0) return 1;
        return b.voteAverage - a.voteAverage;
      });

      const withBackdrop = sortedByTrend.filter((m) => Boolean(m.backdropUrl));
      const trendingMovies =
        withBackdrop.length > 0 ? withBackdrop.slice(0, 5) : sortedByTrend.slice(0, 5);
      const heroMovie = trendingMovies[0] ?? summaries[0] ?? null;

      return {
        heroMovie,
        trendingMovies,
        movies: summaries,
      };
    },

    async getComingSoon(): Promise<PublicComingSoonResponse> {
      try {
        const tmdbData = await tmdbClient.browse('upcoming', 1);
        const moviesList: PublicMovieSummary[] = tmdbData.results.map((tm) => ({
          id: tm.id,
          tmdbId: tm.id,
          title: tm.title,
          overview: tm.overview || '',
          posterUrl: buildTmdbImageUrl(tm.poster_path, 'w500'),
          backdropUrl: buildTmdbImageUrl(tm.backdrop_path, 'w1280'),
          releaseDate: tm.release_date || null,
          voteAverage: Number(tm.vote_average ?? 0),
          runtimeMinutes: 120,
          genres: [],
          activeShowtimeCount: 0,
        }));
        return { movies: moviesList };
      } catch {
        return { movies: [] };
      }
    },

    async getMovieDetail(idOrTmdbId: number, userId?: number): Promise<PublicMovieDetail> {
      let local = await store.findMovieByIdOrTmdbId(idOrTmdbId);

      // If not yet in local DB, fetch from TMDb & upsert
      if (!local) {
        const tmdbDetail = await tmdbClient.getMovieDetails(idOrTmdbId);
        if (!tmdbDetail) {
          throw new AppError(404, 'MOVIE_NOT_FOUND', 'Film tidak ditemukan');
        }

        let trailerKey: string | null = null;
        if (tmdbDetail.videos?.results) {
          const official = tmdbDetail.videos.results.find(
            (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
          );
          const anyTrailer = tmdbDetail.videos.results.find(
            (v) => v.site === 'YouTube' && v.type === 'Trailer',
          );
          const anyVideo = tmdbDetail.videos.results.find((v) => v.site === 'YouTube');
          trailerKey = (official || anyTrailer || anyVideo)?.key || null;
        }

        local = await store.upsertMovieFromTmdb({
          tmdbId: tmdbDetail.id,
          title: tmdbDetail.title,
          overview: tmdbDetail.overview || '',
          posterPath: tmdbDetail.poster_path || null,
          backdropPath: tmdbDetail.backdrop_path || null,
          releaseDate: tmdbDetail.release_date || null,
          runtimeMinutes: tmdbDetail.runtime && tmdbDetail.runtime > 0 ? tmdbDetail.runtime : 120,
          voteAverage: tmdbDetail.vote_average || 0,
          genres: (tmdbDetail.genres ?? []).map((g) => g.name),
          trailerYoutubeKey: trailerKey,
        });
      }

      // Check Watchlist status
      const isInWatchlist = userId ? await store.isMovieInWatchlist(userId, local.tmdbId) : false;

      // Fetch showtimes
      const showtimeRows = await store.getUpcomingShowtimesForMovie(local.id);

      // Group showtimes by date (YYYY-MM-DD)
      const dateMap = new Map<string, PublicShowtimeSlot[]>();
      for (const { showtime: st, studio: std } of showtimeRows) {
        const dateKey = st.startTime.toISOString().split('T')[0]!;
        const slot: PublicShowtimeSlot = {
          id: st.id,
          studioId: std.id,
          studioName: std.name,
          studioType: std.type,
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          price: st.price,
          availableSeatsCount: std.totalSeats, // Plan 07 will refine with held/booked seats
        };

        const existingSlots = dateMap.get(dateKey) ?? [];
        existingSlots.push(slot);
        dateMap.set(dateKey, existingSlots);
      }

      const showtimeDates: PublicShowtimeDateGroup[] = Array.from(dateMap.entries()).map(
        ([date, slots]) => {
          const dateObj = new Date(`${date}T00:00:00`);
          const dateLabel = dateObj.toLocaleDateString('id-ID', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          return {
            date,
            dateLabel,
            showtimes: slots,
          };
        },
      );

      return {
        id: local.id,
        tmdbId: local.tmdbId,
        title: local.title,
        overview: local.overview,
        posterUrl: buildTmdbImageUrl(local.posterPath, 'w500'),
        backdropUrl: buildTmdbImageUrl(local.backdropPath, 'w1280'),
        releaseDate: local.releaseDate,
        runtimeMinutes: local.runtimeMinutes,
        voteAverage: Number(local.voteAverage),
        genres: local.genres ?? [],
        trailerYoutubeKey: local.trailerYoutubeKey,
        isInWatchlist,
        showtimeDates,
      };
    },

    async toggleWatchlist(userId: number, tmdbId: number): Promise<{ isInWatchlist: boolean }> {
      const isAlreadyIn = await store.isMovieInWatchlist(userId, tmdbId);

      if (isAlreadyIn) {
        await store.removeFromWatchlist(userId, tmdbId);
        return { isInWatchlist: false };
      }

      // Fetch movie metadata
      let title = `Movie #${tmdbId}`;
      let posterPath: string | null = null;
      let overview: string | null = null;
      let voteAverage = 0;
      let releaseDate: string | null = null;

      const local = await store.findMovieByIdOrTmdbId(tmdbId);
      if (local) {
        title = local.title;
        posterPath = local.posterPath;
        overview = local.overview;
        voteAverage = Number(local.voteAverage);
        releaseDate = local.releaseDate;
      } else {
        const tmdbData = await tmdbClient.getMovieDetails(tmdbId);
        if (tmdbData) {
          title = tmdbData.title;
          posterPath = tmdbData.poster_path || null;
          overview = tmdbData.overview || null;
          voteAverage = tmdbData.vote_average || 0;
          releaseDate = tmdbData.release_date || null;
        }
      }

      await store.addToWatchlist({
        userId,
        tmdbId,
        title,
        posterPath,
        overview,
        voteAverage,
        releaseDate,
      });

      return { isInWatchlist: true };
    },

    async listUserWatchlist(userId: number): Promise<WatchlistRow[]> {
      return store.listWatchlist(userId);
    },
  };
}

export type PublicMovieService = ReturnType<typeof createPublicMovieService>;
