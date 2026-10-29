import { and, desc, eq, gt, gte, ilike, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  buildTmdbImageUrl,
  sanitizeDisabledSeats,
  type CreateShowtimeInput,
  type CreateStudioInput,
  type MovieRow,
  type ParsedBatchCreateShowtimeInput,
  type BatchCreateShowtimeResult,
  type ParsedCreateShowtimeInput,
  type ParsedCreateStudioInput,
  type ParsedUpdateShowtimeInput,
  type ParsedUpdateStudioInput,
  type ShowtimeListQuery,
  type ShowtimeRow,
  type StudioRow,
  type TmdbBrowseItem,
  type TmdbBrowseQuery,
} from '@cinemax/shared';
import { getDb } from '../db/index.js';
import { auditLogs, movies, showtimes, studios } from '../db/schema.js';
import { AppError } from '../lib/http-error.js';
import type { TmdbClient } from './tmdb-service.js';

export interface OperationsStore {
  // Studios
  listStudios(): Promise<StudioRow[]>;
  findStudioById(id: number): Promise<StudioRow | null>;
  findStudioByName(name: string): Promise<StudioRow | null>;
  createStudio(data: {
    name: string;
    type: 'regular' | '3d' | 'premier';
    rowsCount: number;
    colsCount: number;
    disabledSeats: string[];
    totalSeats: number;
    basePrice: number;
  }): Promise<StudioRow>;
  updateStudio(
    id: number,
    data: {
      name?: string;
      type?: 'regular' | '3d' | 'premier';
      rowsCount?: number;
      colsCount?: number;
      disabledSeats?: string[];
      totalSeats?: number;
      basePrice?: number;
    },
  ): Promise<StudioRow>;
  deleteStudio(id: number): Promise<void>;
  hasShowtimesForStudio(studioId: number): Promise<boolean>;

  // Movies
  listMovies(): Promise<MovieRow[]>;
  findMovieById(id: number): Promise<MovieRow | null>;
  findMovieByTmdbId(tmdbId: number): Promise<MovieRow | null>;
  findMoviesByTmdbIds(tmdbIds: number[]): Promise<MovieRow[]>;
  upsertMovie(data: {
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
  }): Promise<MovieRow>;

  // Showtimes
  listShowtimes(query: ShowtimeListQuery): Promise<{ rows: ShowtimeRow[]; total: number }>;
  findShowtimeById(id: number): Promise<ShowtimeRow | null>;
  findConflictingShowtime(
    studioId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
  ): Promise<boolean>;
  createShowtime(data: {
    movieId: number;
    studioId: number;
    startTime: Date;
    endTime: Date;
    price: number;
  }): Promise<ShowtimeRow>;
  updateShowtime(
    id: number,
    data: {
      studioId?: number;
      startTime?: Date;
      endTime?: Date;
      price?: number;
    },
  ): Promise<ShowtimeRow>;
  deleteShowtime(id: number): Promise<void>;

  // Audit
  recordAudit(entry: {
    actorId: number | null;
    action: string;
    targetType: string;
    targetId: string | null;
    description: string;
  }): Promise<void>;
}

function mapStudio(row: typeof studios.$inferSelect): StudioRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    rowsCount: row.rowsCount,
    colsCount: row.colsCount,
    disabledSeats: row.disabledSeats ?? [],
    totalSeats: row.totalSeats,
    basePrice: row.basePrice,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapMovie(row: typeof movies.$inferSelect): MovieRow {
  return {
    id: row.id,
    tmdbId: row.tmdbId,
    title: row.title,
    overview: row.overview,
    posterPath: row.posterPath,
    posterUrl: buildTmdbImageUrl(row.posterPath, 'w500'),
    backdropPath: row.backdropPath,
    backdropUrl: buildTmdbImageUrl(row.backdropPath, 'w1280'),
    releaseDate: row.releaseDate,
    runtimeMinutes: row.runtimeMinutes,
    voteAverage: row.voteAverage,
    genres: row.genres ?? [],
    trailerYoutubeKey: row.trailerYoutubeKey,
    syncedAt: row.syncedAt.toISOString(),
  };
}

export function createDrizzleOperationsStore(): OperationsStore {
  return {
    async listStudios() {
      const rows = await getDb().select().from(studios).orderBy(studios.id);
      return rows.map(mapStudio);
    },

    async findStudioById(id) {
      const rows = await getDb().select().from(studios).where(eq(studios.id, id)).limit(1);
      return rows[0] ? mapStudio(rows[0]) : null;
    },

    async findStudioByName(name) {
      const rows = await getDb().select().from(studios).where(eq(studios.name, name)).limit(1);
      return rows[0] ? mapStudio(rows[0]) : null;
    },

    async createStudio(data) {
      const rows = await getDb().insert(studios).values(data).returning();
      return mapStudio(rows[0]!);
    },

    async updateStudio(id, data) {
      const rows = await getDb()
        .update(studios)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(studios.id, id))
        .returning();
      return mapStudio(rows[0]!);
    },

    async deleteStudio(id) {
      await getDb().delete(studios).where(eq(studios.id, id));
    },

    async hasShowtimesForStudio(studioId) {
      const rows = await getDb()
        .select({ id: showtimes.id })
        .from(showtimes)
        .where(eq(showtimes.studioId, studioId))
        .limit(1);
      return rows.length > 0;
    },

    async listMovies() {
      const rows = await getDb().select().from(movies).orderBy(desc(movies.syncedAt));
      return rows.map(mapMovie);
    },

    async findMovieById(id) {
      const rows = await getDb().select().from(movies).where(eq(movies.id, id)).limit(1);
      return rows[0] ? mapMovie(rows[0]) : null;
    },

    async findMovieByTmdbId(tmdbId) {
      const rows = await getDb().select().from(movies).where(eq(movies.tmdbId, tmdbId)).limit(1);
      return rows[0] ? mapMovie(rows[0]) : null;
    },

    async findMoviesByTmdbIds(tmdbIds) {
      if (tmdbIds.length === 0) return [];
      const rows = await getDb().select().from(movies).where(inArray(movies.tmdbId, tmdbIds));
      return rows.map(mapMovie);
    },

    async upsertMovie(data) {
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
      return mapMovie(rows[0]!);
    },

    async listShowtimes(query) {
      const db = getDb();
      const filters: SQL[] = [];

      if (query.studioId) {
        filters.push(eq(showtimes.studioId, query.studioId));
      }

      const now = new Date();
      if (query.timeFilter === 'upcoming') {
        filters.push(gt(showtimes.startTime, now));
      } else if (query.timeFilter === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        filters.push(and(gte(showtimes.startTime, startOfDay), lte(showtimes.startTime, endOfDay))!);
      }

      if (query.search) {
        const pattern = `%${query.search}%`;
        filters.push(ilike(movies.title, pattern));
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined;
      const offset = (query.page - 1) * query.limit;

      const results = await db
        .select({
          showtime: showtimes,
          movie: movies,
          studio: studios,
        })
        .from(showtimes)
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .where(whereClause)
        .orderBy(desc(showtimes.startTime))
        .limit(query.limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(showtimes)
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .where(whereClause);

      const mapped: ShowtimeRow[] = results.map(({ showtime: st, movie: m, studio: s }) => {
        const sTime = st.startTime.getTime();
        const eTime = st.endTime.getTime();
        const nTime = Date.now();
        const status = nTime < sTime ? 'upcoming' : nTime <= eTime ? 'playing' : 'ended';

        return {
          id: st.id,
          movieId: st.movieId,
          studioId: st.studioId,
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          price: st.price,
          status,
          movie: {
            id: m.id,
            tmdbId: m.tmdbId,
            title: m.title,
            posterUrl: buildTmdbImageUrl(m.posterPath, 'w185'),
            runtimeMinutes: m.runtimeMinutes,
          },
          studio: {
            id: s.id,
            name: s.name,
            type: s.type,
            totalSeats: s.totalSeats,
          },
        };
      });

      return {
        rows: mapped,
        total: countResult[0]?.count ?? 0,
      };
    },

    async findShowtimeById(id) {
      const rows = await getDb()
        .select({
          showtime: showtimes,
          movie: movies,
          studio: studios,
        })
        .from(showtimes)
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .where(eq(showtimes.id, id))
        .limit(1);

      if (!rows[0]) return null;
      const { showtime: st, movie: m, studio: s } = rows[0];
      const sTime = st.startTime.getTime();
      const eTime = st.endTime.getTime();
      const nTime = Date.now();
      const status = nTime < sTime ? 'upcoming' : nTime <= eTime ? 'playing' : 'ended';

      return {
        id: st.id,
        movieId: st.movieId,
        studioId: st.studioId,
        startTime: st.startTime.toISOString(),
        endTime: st.endTime.toISOString(),
        price: st.price,
        status,
        movie: {
          id: m.id,
          tmdbId: m.tmdbId,
          title: m.title,
          posterUrl: buildTmdbImageUrl(m.posterPath, 'w185'),
          runtimeMinutes: m.runtimeMinutes,
        },
        studio: {
          id: s.id,
          name: s.name,
          type: s.type,
          totalSeats: s.totalSeats,
        },
      };
    },

    async findConflictingShowtime(studioId, startTime, endTime, excludeId) {
      const conditions: SQL[] = [
        eq(showtimes.studioId, studioId),
        lt(showtimes.startTime, endTime),
        gt(showtimes.endTime, startTime),
      ];

      if (excludeId !== undefined) {
        conditions.push(sql`${showtimes.id} != ${excludeId}`);
      }

      const rows = await getDb()
        .select({ id: showtimes.id })
        .from(showtimes)
        .where(and(...conditions))
        .limit(1);

      return rows.length > 0;
    },

    async createShowtime(data) {
      const rows = await getDb().insert(showtimes).values(data).returning();
      const created = rows[0]!;
      const full = await this.findShowtimeById(created.id);
      return full!;
    },

    async updateShowtime(id, data) {
      await getDb().update(showtimes).set(data).where(eq(showtimes.id, id));
      const full = await this.findShowtimeById(id);
      return full!;
    },

    async deleteShowtime(id) {
      await getDb().delete(showtimes).where(eq(showtimes.id, id));
    },

    async recordAudit(entry) {
      await getDb().insert(auditLogs).values(entry);
    },
  };
}

export function createOperationsService(
  store: OperationsStore = createDrizzleOperationsStore(),
  tmdbClient: TmdbClient,
) {
  return {
    // Studio Management
    async listStudios(): Promise<StudioRow[]> {
      return store.listStudios();
    },

    async createStudio(actorId: number, input: ParsedCreateStudioInput): Promise<StudioRow> {
      const existing = await store.findStudioByName(input.name);
      if (existing) {
        throw new AppError(409, 'STUDIO_EXISTS', `Studio "${input.name}" sudah ada`);
      }

      const created = await store.createStudio({
        name: input.name,
        type: input.type,
        rowsCount: input.rowsCount,
        colsCount: input.colsCount,
        disabledSeats: input.disabledSeats,
        totalSeats: input.totalSeats,
        basePrice: input.basePrice,
      });

      await store.recordAudit({
        actorId,
        action: 'STUDIO_CREATED',
        targetType: 'studio',
        targetId: String(created.id),
        description: `Menambahkan studio baru ${created.name} (${created.type.toUpperCase()}, ${created.totalSeats} kursi)`,
      });

      return created;
    },

    async updateStudio(actorId: number, id: number, input: ParsedUpdateStudioInput): Promise<StudioRow> {
      const current = await store.findStudioById(id);
      if (!current) {
        throw new AppError(404, 'STUDIO_NOT_FOUND', 'Studio tidak ditemukan');
      }

      if (input.name && input.name !== current.name) {
        const existingName = await store.findStudioByName(input.name);
        if (existingName) {
          throw new AppError(409, 'STUDIO_EXISTS', `Studio "${input.name}" sudah ada`);
        }
      }

      const rowsCount = input.rowsCount ?? current.rowsCount;
      const colsCount = input.colsCount ?? current.colsCount;
      const rawDisabled = input.disabledSeats ?? current.disabledSeats;
      const disabledSeats = sanitizeDisabledSeats(rawDisabled, rowsCount, colsCount);
      const totalSeats = rowsCount * colsCount - disabledSeats.length;

      const updated = await store.updateStudio(id, {
        name: input.name,
        type: input.type,
        rowsCount: input.rowsCount,
        colsCount: input.colsCount,
        disabledSeats,
        totalSeats,
        basePrice: input.basePrice,
      });

      await store.recordAudit({
        actorId,
        action: 'STUDIO_UPDATED',
        targetType: 'studio',
        targetId: String(id),
        description: `Memperbarui konfigurasi studio ${updated.name} (${updated.totalSeats} kursi)`,
      });

      return updated;
    },

    async deleteStudio(actorId: number, id: number): Promise<{ deletedId: number }> {
      const current = await store.findStudioById(id);
      if (!current) {
        throw new AppError(404, 'STUDIO_NOT_FOUND', 'Studio tidak ditemukan');
      }

      const inUse = await store.hasShowtimesForStudio(id);
      if (inUse) {
        throw new AppError(
          409,
          'STUDIO_IN_USE',
          `Studio ${current.name} tidak dapat dihapus karena memiliki jadwal tayang. Hapus jadwal tayang terkait terlebih dahulu.`,
        );
      }

      await store.deleteStudio(id);

      await store.recordAudit({
        actorId,
        action: 'STUDIO_DELETED',
        targetType: 'studio',
        targetId: String(id),
        description: `Menghapus studio ${current.name}`,
      });

      return { deletedId: id };
    },

    // TMDb & Movies
    async browseTmdb(query: TmdbBrowseQuery): Promise<{
      results: TmdbBrowseItem[];
      totalPages: number;
      totalResults: number;
    }> {
      let rawResult;
      if (query.search) {
        rawResult = await tmdbClient.search(query.search, query.page);
      } else {
        rawResult = await tmdbClient.browse(query.category, query.page);
      }

      const tmdbIds = rawResult.results.map((r) => r.id);
      const localMovies = await store.findMoviesByTmdbIds(tmdbIds);
      const localMap = new Map<number, number>();
      for (const lm of localMovies) {
        localMap.set(lm.tmdbId, lm.id);
      }

      const items: TmdbBrowseItem[] = rawResult.results.map((r) => ({
        tmdbId: r.id,
        title: r.title,
        overview: r.overview || '',
        posterPath: r.poster_path || null,
        posterUrl: buildTmdbImageUrl(r.poster_path, 'w342'),
        backdropPath: r.backdrop_path || null,
        backdropUrl: buildTmdbImageUrl(r.backdrop_path, 'w1280'),
        releaseDate: r.release_date || null,
        voteAverage: Number(r.vote_average ?? 0),
        isSynced: localMap.has(r.id),
        localMovieId: localMap.get(r.id) ?? null,
      }));

      return {
        results: items,
        totalPages: rawResult.totalPages,
        totalResults: rawResult.totalResults,
      };
    },

    async listLocalMovies(): Promise<MovieRow[]> {
      return store.listMovies();
    },

    async syncMovieByTmdbId(actorId: number, tmdbId: number): Promise<MovieRow> {
      const details = await tmdbClient.getMovieDetails(tmdbId);
      if (!details) {
        throw new AppError(404, 'TMDB_MOVIE_NOT_FOUND', `Film TMDb ID ${tmdbId} tidak ditemukan`);
      }

      // Find trailer youtube key
      let trailerKey: string | null = null;
      if (details.videos?.results) {
        const official = details.videos.results.find(
          (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
        );
        const anyTrailer = details.videos.results.find(
          (v) => v.site === 'YouTube' && v.type === 'Trailer',
        );
        const anyVideo = details.videos.results.find((v) => v.site === 'YouTube');
        trailerKey = (official || anyTrailer || anyVideo)?.key || null;
      }

      const genres = (details.genres ?? []).map((g) => g.name);

      const movie = await store.upsertMovie({
        tmdbId: details.id,
        title: details.title,
        overview: details.overview || '',
        posterPath: details.poster_path || null,
        backdropPath: details.backdrop_path || null,
        releaseDate: details.release_date || null,
        runtimeMinutes: details.runtime && details.runtime > 0 ? details.runtime : 120,
        voteAverage: details.vote_average || 0,
        genres,
        trailerYoutubeKey: trailerKey,
      });

      await store.recordAudit({
        actorId,
        action: 'MOVIE_SYNCED',
        targetType: 'movie',
        targetId: String(movie.id),
        description: `Sinkronisasi film TMDb #${details.id}: ${movie.title} (${movie.runtimeMinutes}m)`,
      });

      return movie;
    },

    // Showtime Management
    async listShowtimes(query: ShowtimeListQuery) {
      return store.listShowtimes(query);
    },

    async createShowtime(actorId: number, input: ParsedCreateShowtimeInput): Promise<ShowtimeRow> {
      const studio = await store.findStudioById(input.studioId);
      if (!studio) {
        throw new AppError(404, 'STUDIO_NOT_FOUND', 'Studio tidak ditemukan');
      }

      // Resolve movie
      let movie: MovieRow | null = null;
      if (input.movieId) {
        movie = await store.findMovieById(input.movieId);
      } else if (input.tmdbId) {
        movie = await store.findMovieByTmdbId(input.tmdbId);
        if (!movie) {
          // Auto-sync if not in local DB
          movie = await this.syncMovieByTmdbId(actorId, input.tmdbId);
        }
      }

      if (!movie) {
        throw new AppError(404, 'MOVIE_NOT_FOUND', 'Film tidak ditemukan');
      }

      const startTime = new Date(input.startTime);
      let endTime: Date;
      if (input.endTime) {
        endTime = new Date(input.endTime);
      } else {
        // Auto calculate: duration + 20 minutes buffer
        const bufferMinutes = 20;
        const totalDurationMs = (movie.runtimeMinutes + bufferMinutes) * 60 * 1000;
        endTime = new Date(startTime.getTime() + totalDurationMs);
      }

      if (endTime.getTime() <= startTime.getTime()) {
        throw new AppError(400, 'INVALID_SCHEDULE_TIME', 'Waktu selesai harus lebih lambat dari waktu mulai');
      }

      // Check conflict
      const hasConflict = await store.findConflictingShowtime(input.studioId, startTime, endTime);
      if (hasConflict) {
        throw new AppError(
          409,
          'SCHEDULE_CONFLICT',
          `Jadwal tayang bentrok dengan penayangan lain di ${studio.name} pada jam tersebut. Berikan jeda pembersihan studio.`,
        );
      }

      const price = input.price ?? studio.basePrice;

      const created = await store.createShowtime({
        movieId: movie.id,
        studioId: studio.id,
        startTime,
        endTime,
        price,
      });

      await store.recordAudit({
        actorId,
        action: 'SHOWTIME_CREATED',
        targetType: 'showtime',
        targetId: String(created.id),
        description: `Menjadwalkan tayang film ${movie.title} di ${studio.name} (${created.startTime} - ${created.endTime})`,
      });

      return created;
    },

    async createShowtimesBatch(
      actorId: number,
      input: ParsedBatchCreateShowtimeInput,
    ): Promise<BatchCreateShowtimeResult> {
      const studio = await store.findStudioById(input.studioId);
      if (!studio) {
        throw new AppError(404, 'STUDIO_NOT_FOUND', 'Studio tidak ditemukan');
      }

      // Resolve movie
      let movie: MovieRow | null = null;
      if (input.movieId) {
        movie = await store.findMovieById(input.movieId);
      } else if (input.tmdbId) {
        movie = await store.findMovieByTmdbId(input.tmdbId);
        if (!movie) {
          movie = await this.syncMovieByTmdbId(actorId, input.tmdbId);
        }
      }

      if (!movie) {
        throw new AppError(404, 'MOVIE_NOT_FOUND', 'Film tidak ditemukan');
      }

      const bufferMinutes = 20;
      const totalDurationMs = (movie.runtimeMinutes + bufferMinutes) * 60 * 1000;
      const defaultPrice = input.defaultPrice ?? studio.basePrice;

      // 1. Prepare computed slots
      const computedSlots = input.slots.map((s) => {
        const start = new Date(s.startTime);
        const end = new Date(start.getTime() + totalDurationMs);
        const price = s.price ?? defaultPrice;
        return { start, end, price };
      });

      // 2. Validate internal batch conflicts
      for (let i = 0; i < computedSlots.length; i++) {
        for (let j = i + 1; j < computedSlots.length; j++) {
          const a = computedSlots[i]!;
          const b = computedSlots[j]!;
          if (a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime()) {
            throw new AppError(
              409,
              'SCHEDULE_CONFLICT',
              `Terdapat jadwal yang saling bertabrakan di dalam batch pilihan Anda: ${a.start.toISOString()} dan ${b.start.toISOString()}`,
            );
          }
        }
      }

      // 3. Validate database conflicts for each slot
      for (const slot of computedSlots) {
        const hasConflict = await store.findConflictingShowtime(
          input.studioId,
          slot.start,
          slot.end,
        );
        if (hasConflict) {
          const dateStr = slot.start.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          });
          const timeStr = slot.start.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          });
          throw new AppError(
            409,
            'SCHEDULE_CONFLICT',
            `Jadwal tayang pada ${dateStr} pukul ${timeStr} WIB bentrok dengan penayangan lain di ${studio.name}. Berikan jeda pembersihan studio.`,
          );
        }
      }

      // 4. Create all showtimes
      const createdShowtimes: ShowtimeRow[] = [];
      for (const slot of computedSlots) {
        const created = await store.createShowtime({
          movieId: movie.id,
          studioId: studio.id,
          startTime: slot.start,
          endTime: slot.end,
          price: slot.price,
        });
        createdShowtimes.push(created);
      }

      await store.recordAudit({
        actorId,
        action: 'SHOWTIMES_BATCH_CREATED',
        targetType: 'studio',
        targetId: String(studio.id),
        description: `Menjadwalkan batch ${createdShowtimes.length} penayangan film "${movie.title}" di ${studio.name}`,
      });

      return {
        totalCreated: createdShowtimes.length,
        showtimes: createdShowtimes,
      };
    },

    async updateShowtime(actorId: number, id: number, input: ParsedUpdateShowtimeInput): Promise<ShowtimeRow> {
      const current = await store.findShowtimeById(id);
      if (!current) {
        throw new AppError(404, 'SHOWTIME_NOT_FOUND', 'Jadwal tayang tidak ditemukan');
      }

      const studioId = input.studioId ?? current.studioId;
      const startTime = input.startTime ? new Date(input.startTime) : new Date(current.startTime);
      const endTime = input.endTime ? new Date(input.endTime) : new Date(current.endTime);

      if (endTime.getTime() <= startTime.getTime()) {
        throw new AppError(400, 'INVALID_SCHEDULE_TIME', 'Waktu selesai harus lebih lambat dari waktu mulai');
      }

      const hasConflict = await store.findConflictingShowtime(studioId, startTime, endTime, id);
      if (hasConflict) {
        throw new AppError(
          409,
          'SCHEDULE_CONFLICT',
          'Jadwal tayang bentrok dengan penayangan lain di studio ini pada jam tersebut.',
        );
      }

      const updated = await store.updateShowtime(id, {
        studioId: input.studioId,
        startTime: input.startTime ? startTime : undefined,
        endTime: input.endTime ? endTime : undefined,
        price: input.price,
      });

      await store.recordAudit({
        actorId,
        action: 'SHOWTIME_UPDATED',
        targetType: 'showtime',
        targetId: String(id),
        description: `Memperbarui jadwal tayang #${id} (${updated.movie.title} di ${updated.studio.name})`,
      });

      return updated;
    },

    async deleteShowtime(actorId: number, id: number): Promise<{ deletedId: number }> {
      const current = await store.findShowtimeById(id);
      if (!current) {
        throw new AppError(404, 'SHOWTIME_NOT_FOUND', 'Jadwal tayang tidak ditemukan');
      }

      await store.deleteShowtime(id);

      await store.recordAudit({
        actorId,
        action: 'SHOWTIME_DELETED',
        targetType: 'showtime',
        targetId: String(id),
        description: `Menghapus jadwal tayang #${id} (${current.movie.title} di ${current.studio.name})`,
      });

      return { deletedId: id };
    },
  };
}

export type OperationsService = ReturnType<typeof createOperationsService>;
