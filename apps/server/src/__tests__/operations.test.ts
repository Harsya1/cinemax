import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  studioRowSchema,
  showtimeRowSchema,
  type MovieRow,
  type ShowtimeRow,
  type StudioRow,
  type UserRole,
} from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createOperationsService,
  type OperationsStore,
} from '../services/operations-service.js';
import type { TmdbClient, TmdbDetailedMovie, TmdbRawMovie } from '../services/tmdb-service.js';
import { hashPassword } from '../lib/crypto.js';

function createOperationsMemoryStores() {
  const studios: StudioRow[] = [
    {
      id: 1,
      name: 'Studio 1 Regular',
      type: 'regular',
      rowsCount: 5,
      colsCount: 10,
      disabledSeats: ['A1'],
      totalSeats: 49,
      basePrice: 50000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Studio 2 3D',
      type: '3d',
      rowsCount: 5,
      colsCount: 8,
      disabledSeats: [],
      totalSeats: 40,
      basePrice: 65000,
      createdAt: new Date().toISOString(),
    },
  ];
  let nextStudioId = 3;

  const movies: MovieRow[] = [];
  let nextMovieId = 1;

  const showtimes: ShowtimeRow[] = [];
  let nextShowtimeId = 1;

  const audits: Array<{ action: string; description: string }> = [];

  const store: OperationsStore = {
    async listStudios() {
      return [...studios];
    },
    async findStudioById(id) {
      return studios.find((s) => s.id === id) ?? null;
    },
    async findStudioByName(name) {
      return studios.find((s) => s.name === name) ?? null;
    },
    async createStudio(data) {
      const row: StudioRow = {
        id: nextStudioId++,
        name: data.name,
        type: data.type,
        rowsCount: data.rowsCount,
        colsCount: data.colsCount,
        disabledSeats: data.disabledSeats,
        totalSeats: data.totalSeats,
        basePrice: data.basePrice,
        createdAt: new Date().toISOString(),
      };
      studios.push(row);
      return row;
    },
    async updateStudio(id, data) {
      const idx = studios.findIndex((s) => s.id === id);
      assert.notEqual(idx, -1);
      const curr = studios[idx]!;
      const updated: StudioRow = {
        ...curr,
        ...(data.name ? { name: data.name } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.rowsCount ? { rowsCount: data.rowsCount } : {}),
        ...(data.colsCount ? { colsCount: data.colsCount } : {}),
        ...(data.disabledSeats ? { disabledSeats: data.disabledSeats } : {}),
        ...(data.totalSeats !== undefined ? { totalSeats: data.totalSeats } : {}),
        ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
      };
      studios[idx] = updated;
      return updated;
    },
    async deleteStudio(id) {
      const idx = studios.findIndex((s) => s.id === id);
      if (idx !== -1) studios.splice(idx, 1);
    },
    async hasShowtimesForStudio(studioId) {
      return showtimes.some((st) => st.studioId === studioId);
    },

    async listMovies() {
      return [...movies];
    },
    async findMovieById(id) {
      return movies.find((m) => m.id === id) ?? null;
    },
    async findMovieByTmdbId(tmdbId) {
      return movies.find((m) => m.tmdbId === tmdbId) ?? null;
    },
    async findMoviesByTmdbIds(tmdbIds) {
      return movies.filter((m) => tmdbIds.includes(m.tmdbId));
    },
    async upsertMovie(data) {
      const existing = movies.find((m) => m.tmdbId === data.tmdbId);
      if (existing) {
        Object.assign(existing, {
          title: data.title,
          overview: data.overview,
          posterPath: data.posterPath,
          posterUrl: data.posterPath ? `https://image.tmdb.org/t/p/w500${data.posterPath}` : null,
          runtimeMinutes: data.runtimeMinutes,
          voteAverage: data.voteAverage,
          genres: data.genres,
          trailerYoutubeKey: data.trailerYoutubeKey,
          syncedAt: new Date().toISOString(),
        });
        return existing;
      }
      const created: MovieRow = {
        id: nextMovieId++,
        tmdbId: data.tmdbId,
        title: data.title,
        overview: data.overview,
        posterPath: data.posterPath,
        posterUrl: data.posterPath ? `https://image.tmdb.org/t/p/w500${data.posterPath}` : null,
        backdropPath: data.backdropPath,
        backdropUrl: data.backdropPath ? `https://image.tmdb.org/t/p/w1280${data.backdropPath}` : null,
        releaseDate: data.releaseDate,
        runtimeMinutes: data.runtimeMinutes,
        voteAverage: data.voteAverage,
        genres: data.genres,
        trailerYoutubeKey: data.trailerYoutubeKey,
        syncedAt: new Date().toISOString(),
      };
      movies.push(created);
      return created;
    },

    async listShowtimes() {
      return { rows: [...showtimes], total: showtimes.length };
    },
    async findShowtimeById(id) {
      return showtimes.find((st) => st.id === id) ?? null;
    },
    async findConflictingShowtime(studioId, startTime, endTime, excludeId) {
      const s = startTime.getTime();
      const e = endTime.getTime();
      return showtimes.some((st) => {
        if (st.studioId !== studioId) return false;
        if (excludeId !== undefined && st.id === excludeId) return false;
        const stStart = new Date(st.startTime).getTime();
        const stEnd = new Date(st.endTime).getTime();
        return stStart < e && stEnd > s;
      });
    },
    async createShowtime(data) {
      const movie = movies.find((m) => m.id === data.movieId)!;
      const studio = studios.find((s) => s.id === data.studioId)!;
      const row: ShowtimeRow = {
        id: nextShowtimeId++,
        movieId: data.movieId,
        studioId: data.studioId,
        startTime: data.startTime.toISOString(),
        endTime: data.endTime.toISOString(),
        price: data.price,
        status: 'upcoming',
        movie: {
          id: movie.id,
          tmdbId: movie.tmdbId,
          title: movie.title,
          posterUrl: movie.posterUrl,
          runtimeMinutes: movie.runtimeMinutes,
        },
        studio: {
          id: studio.id,
          name: studio.name,
          type: studio.type,
          totalSeats: studio.totalSeats,
        },
      };
      showtimes.push(row);
      return row;
    },
    async updateShowtime(id, data) {
      const idx = showtimes.findIndex((st) => st.id === id);
      const curr = showtimes[idx]!;
      const studio = data.studioId ? studios.find((s) => s.id === data.studioId)! : studios.find((s) => s.id === curr.studioId)!;
      const updated: ShowtimeRow = {
        ...curr,
        studioId: studio.id,
        startTime: data.startTime ? data.startTime.toISOString() : curr.startTime,
        endTime: data.endTime ? data.endTime.toISOString() : curr.endTime,
        price: data.price ?? curr.price,
        studio: {
          id: studio.id,
          name: studio.name,
          type: studio.type,
          totalSeats: studio.totalSeats,
        },
      };
      showtimes[idx] = updated;
      return updated;
    },
    async deleteShowtime(id) {
      const idx = showtimes.findIndex((st) => st.id === id);
      if (idx !== -1) showtimes.splice(idx, 1);
    },

    async recordAudit(entry) {
      audits.push({ action: entry.action, description: entry.description });
    },
  };

  return { store, audits };
}

function createMockTmdbClient(): TmdbClient {
  const mockMovie: TmdbDetailedMovie = {
    id: 550,
    title: 'Fight Club',
    overview: 'An insomniac office worker...',
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdrop_path: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
    release_date: '1999-10-15',
    vote_average: 8.4,
    runtime: 139,
    genres: [{ id: 18, name: 'Drama' }],
    videos: {
      results: [{ key: 'O1nDozs-L79', site: 'YouTube', type: 'Trailer', official: true }],
    },
  };

  return {
    async browse() {
      return {
        results: [mockMovie],
        totalPages: 1,
        totalResults: 1,
      };
    },
    async search() {
      return {
        results: [mockMovie],
        totalPages: 1,
        totalResults: 1,
      };
    },
    async getMovieDetails(tmdbId) {
      if (tmdbId === 550) return mockMovie;
      return null;
    },
  };
}

function createMemoryAuthStore(seedUsers: StoredUser[]): AuthStore {
  const users = [...seedUsers];
  const sessions = new Map<string, { userId: number; expiresAt: Date }>();
  return {
    async findUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async createUser(input) {
      const created: StoredUser = {
        id: users.length + 1,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phoneNumber: input.phoneNumber,
        role: input.role,
        points: 0,
        isActive: true,
      };
      users.push(created);
      return created;
    },
    async createSession(input) {
      sessions.set(input.tokenHash, { userId: input.userId, expiresAt: input.expiresAt });
    },
    async findSessionWithUser(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s) return null;
      const user = users.find((u) => u.id === s.userId);
      if (!user) return null;
      return { expiresAt: s.expiresAt, user };
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
  };
}

async function loginStaffAndGetCookie(baseUrl: string, email: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Cinemax123!' }),
  });
  assert.equal(res.status, 200);
  const raw = res.headers.get('set-cookie');
  assert.ok(raw);
  return raw.split(';')[0]!;
}

test('Operations API: Studio CRUD, TMDb auto-sync, and strict schedule conflict prevention', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const users: StoredUser[] = [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'admin',
      points: 0,
      isActive: true,
    },
    {
      id: 2,
      name: 'Cleaner User',
      email: 'cleaner@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'cleaner',
      points: 0,
      isActive: true,
    },
  ];

  const authStore = createMemoryAuthStore(users);
  const authService = createAuthService(authStore);
  const { store } = createOperationsMemoryStores();
  const tmdbClient = createMockTmdbClient();
  const operationsService = createOperationsService(store, tmdbClient);

  const app = createApp({
    checkDb: async () => true,
    authService,
    operationsService,
    tmdbClient,
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const adminCookie = await loginStaffAndGetCookie(baseUrl, 'admin@cinemax.local');
    const cleanerCookie = await loginStaffAndGetCookie(baseUrl, 'cleaner@cinemax.local');

    // 1. Studio Policy: Cleaner can GET /admin/studios (200), but cannot POST (403)
    const cleanerGetStudios = await fetch(`${baseUrl}/api/v1/admin/studios`, {
      headers: { Cookie: cleanerCookie },
    });
    assert.equal(cleanerGetStudios.status, 200);

    const cleanerPostStudio = await fetch(`${baseUrl}/api/v1/admin/studios`, {
      method: 'POST',
      headers: { Cookie: cleanerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Studio Blocked',
        type: 'regular',
        rowsCount: 5,
        colsCount: 10,
        disabledSeats: [],
        basePrice: 50000,
      }),
    });
    assert.equal(cleanerPostStudio.status, 403);

    // 2. Admin creates Studio Premier
    const adminCreateStudio = await fetch(`${baseUrl}/api/v1/admin/studios`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Studio 3 Premier Velvet',
        type: 'premier',
        rowsCount: 4,
        colsCount: 8,
        disabledSeats: ['A4', 'B4', 'C4', 'D4'],
        basePrice: 100000,
      }),
    });
    assert.equal(adminCreateStudio.status, 201);
    const studioBody = (await adminCreateStudio.json()) as { data: StudioRow };
    const studio3 = studioRowSchema.parse(studioBody.data);
    assert.equal(studio3.totalSeats, 28); // 4*8 - 4 = 28

    // 3. Admin syncs TMDb movie #550
    const syncRes = await fetch(`${baseUrl}/api/v1/admin/movies/sync`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId: 550 }),
    });
    assert.equal(syncRes.status, 200);
    const movieBody = (await syncRes.json()) as { data: MovieRow };
    assert.equal(movieBody.data.title, 'Fight Club');
    assert.equal(movieBody.data.runtimeMinutes, 139);
    assert.equal(movieBody.data.trailerYoutubeKey, 'O1nDozs-L79');

    // 4. Admin schedules Showtime A in Studio 1: 14:00 - auto-calculated 14:00 + (139+20)m = 16:39
    const showtimeARes = await fetch(`${baseUrl}/api/v1/admin/showtimes`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movieId: movieBody.data.id,
        studioId: 1,
        startTime: '2026-11-01T14:00:00.000Z',
      }),
    });
    assert.equal(showtimeARes.status, 201);
    const stA = showtimeRowSchema.parse(((await showtimeARes.json()) as { data: unknown }).data);
    assert.equal(stA.endTime, '2026-11-01T16:39:00.000Z');
    assert.equal(stA.price, 50000); // defaults to Studio 1 basePrice

    // 5. Conflict Test: Showtime B in same studio starting at 15:00 is rejected with 409
    const showtimeBConflict = await fetch(`${baseUrl}/api/v1/admin/showtimes`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movieId: movieBody.data.id,
        studioId: 1,
        startTime: '2026-11-01T15:00:00.000Z',
      }),
    });
    assert.equal(showtimeBConflict.status, 409);
    const errConflict = (await showtimeBConflict.json()) as { error: { code: string } };
    assert.equal(errConflict.error.code, 'SCHEDULE_CONFLICT');

    // 6. Showtime C in a different studio (Studio 2) at 15:00 succeeds
    const showtimeCOk = await fetch(`${baseUrl}/api/v1/admin/showtimes`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movieId: movieBody.data.id,
        studioId: 2,
        startTime: '2026-11-01T15:00:00.000Z',
      }),
    });
    assert.equal(showtimeCOk.status, 201);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
