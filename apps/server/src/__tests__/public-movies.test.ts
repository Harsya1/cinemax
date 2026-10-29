import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  publicMovieDetailSchema,
  publicNowPlayingResponseSchema,
  type WatchlistRow,
} from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createPublicMovieService,
  type PublicMovieStore,
} from '../services/public-movie-service.js';
import type { TmdbClient, TmdbDetailedMovie, TmdbRawMovie } from '../services/tmdb-service.js';
import { hashPassword } from '../lib/crypto.js';
import { movies, studios, showtimes } from '../db/schema.js';

function createPublicMemoryStores() {
  const localMovies: (typeof movies.$inferSelect)[] = [
    {
      id: 1,
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'Insomnia worker creates underground fight club',
      posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      backdropPath: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
      releaseDate: '1999-10-15',
      runtimeMinutes: 139,
      voteAverage: 8.4,
      genres: ['Drama'],
      trailerYoutubeKey: 'O1nDozs-L79',
      syncedAt: new Date(),
    },
  ];

  const localStudios: (typeof studios.$inferSelect)[] = [
    {
      id: 1,
      name: 'Studio 1 Regular',
      type: 'regular',
      rowsCount: 8,
      colsCount: 12,
      disabledSeats: [],
      totalSeats: 96,
      basePrice: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const localShowtimes: (typeof showtimes.$inferSelect)[] = [
    {
      id: 10,
      movieId: 1,
      studioId: 1,
      startTime: new Date('2026-11-05T14:00:00.000Z'),
      endTime: new Date('2026-11-05T16:39:00.000Z'),
      price: 50000,
      createdAt: new Date(),
    },
    {
      id: 11,
      movieId: 1,
      studioId: 1,
      startTime: new Date('2026-11-06T19:00:00.000Z'),
      endTime: new Date('2026-11-06T21:39:00.000Z'),
      price: 50000,
      createdAt: new Date(),
    },
  ];

  const watchlistsData: Array<{
    id: number;
    userId: number;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    overview: string | null;
    voteAverage: number;
    releaseDate: string | null;
    createdAt: Date;
  }> = [];
  let nextWatchlistId = 1;

  const store: PublicMovieStore = {
    async getActiveNowPlayingMovies() {
      return [
        {
          movie: localMovies[0]!,
          activeShowtimeCount: 2,
        },
      ];
    },
    async findMovieByIdOrTmdbId(idOrTmdb) {
      return localMovies.find((m) => m.id === idOrTmdb || m.tmdbId === idOrTmdb) ?? null;
    },
    async upsertMovieFromTmdb(data) {
      const created = {
        id: localMovies.length + 1,
        ...data,
        syncedAt: new Date(),
      };
      localMovies.push(created);
      return created;
    },
    async getUpcomingShowtimesForMovie(movieId) {
      return localShowtimes
        .filter((st) => st.movieId === movieId)
        .map((st) => ({
          showtime: st,
          studio: localStudios.find((s) => s.id === st.studioId)!,
        }));
    },
    async isMovieInWatchlist(userId, tmdbId) {
      return watchlistsData.some((w) => w.userId === userId && w.tmdbId === tmdbId);
    },
    async addToWatchlist(data) {
      watchlistsData.push({
        id: nextWatchlistId++,
        ...data,
        createdAt: new Date(),
      });
    },
    async removeFromWatchlist(userId, tmdbId) {
      const idx = watchlistsData.findIndex((w) => w.userId === userId && w.tmdbId === tmdbId);
      if (idx !== -1) watchlistsData.splice(idx, 1);
    },
    async listWatchlist(userId) {
      return watchlistsData
        .filter((w) => w.userId === userId)
        .map((w) => ({
          id: w.id,
          tmdbId: w.tmdbId,
          title: w.title,
          posterUrl: w.posterPath ? `https://image.tmdb.org/t/p/w342${w.posterPath}` : null,
          overview: w.overview,
          voteAverage: w.voteAverage,
          releaseDate: w.releaseDate,
          createdAt: w.createdAt.toISOString(),
        }));
    },
  };

  return { store };
}

function createMockTmdbClient(): TmdbClient {
  const mockMovie: TmdbDetailedMovie = {
    id: 999,
    title: 'Upcoming Avatar',
    overview: 'Next generation sci-fi',
    poster_path: '/avatar.jpg',
    backdrop_path: '/avatar-bg.jpg',
    release_date: '2026-12-25',
    vote_average: 8.8,
    runtime: 180,
    genres: [{ id: 878, name: 'Sci-Fi' }],
    videos: {
      results: [{ key: 'dQw4w9WgXcQ', site: 'YouTube', type: 'Trailer', official: true }],
    },
  };

  return {
    async browse(category) {
      return {
        results: category === 'upcoming' ? [mockMovie] : [],
        totalPages: 1,
        totalResults: 1,
      };
    },
    async search() {
      return { results: [], totalPages: 1, totalResults: 0 };
    },
    async getMovieDetails(tmdbId) {
      if (tmdbId === 999) return mockMovie;
      return null;
    },
  };
}

function createMemoryAuthStore(users: StoredUser[]): AuthStore {
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

test('Public Movies API: Now Playing, Coming Soon, Movie Detail with grouped showtimes, and Watchlist toggle', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const users: StoredUser[] = [
    {
      id: 7,
      name: 'Pelanggan Setia',
      email: 'user@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'user',
      points: 250,
      isActive: true,
    },
  ];

  const authStore = createMemoryAuthStore(users);
  const authService = createAuthService(authStore);
  const { store } = createPublicMemoryStores();
  const tmdbClient = createMockTmdbClient();
  const publicMovieService = createPublicMovieService(store, tmdbClient);

  const app = createApp({
    checkDb: async () => true,
    authService,
    publicMovieService,
    tmdbClient,
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Guest GET /public/movies/now-playing
    const npRes = await fetch(`${baseUrl}/api/v1/public/movies/now-playing`);
    assert.equal(npRes.status, 200);
    const npBody = (await npRes.json()) as { data: unknown };
    const npParsed = publicNowPlayingResponseSchema.parse(npBody.data);
    assert.equal(npParsed.heroMovie?.title, 'Fight Club');
    assert.equal(npParsed.heroMovie?.activeShowtimeCount, 2);

    // 2. Guest GET /public/movies/coming-soon
    const csRes = await fetch(`${baseUrl}/api/v1/public/movies/coming-soon`);
    assert.equal(csRes.status, 200);
    const csBody = (await csRes.json()) as { data: { movies: Array<{ title: string }> } };
    assert.equal(csBody.data.movies[0]?.title, 'Upcoming Avatar');

    // 3. Guest GET /public/movies/1 (Movie Detail)
    const detailRes = await fetch(`${baseUrl}/api/v1/public/movies/1`);
    assert.equal(detailRes.status, 200);
    const detailBody = (await detailRes.json()) as { data: unknown };
    const detail = publicMovieDetailSchema.parse(detailBody.data);
    assert.equal(detail.title, 'Fight Club');
    assert.equal(detail.isInWatchlist, false);
    assert.equal(detail.showtimeDates.length, 2); // 2 different dates: Nov 5 and Nov 6
    assert.equal(detail.showtimeDates[0]?.date, '2026-11-05');
    assert.equal(detail.showtimeDates[0]?.showtimes[0]?.studioName, 'Studio 1 Regular');

    // 4. Customer Login
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@cinemax.local', password: 'Cinemax123!' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0]!;
    assert.ok(cookie);

    // 5. Toggle Watchlist (Add Fight Club #550)
    const toggleAdd = await fetch(`${baseUrl}/api/v1/public/watchlist/toggle`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId: 550 }),
    });
    assert.equal(toggleAdd.status, 200);
    const addBody = (await toggleAdd.json()) as { data: { isInWatchlist: boolean } };
    assert.equal(addBody.data.isInWatchlist, true);

    // 6. Detail now shows isInWatchlist: true
    const detailAuth = await fetch(`${baseUrl}/api/v1/public/movies/1`, {
      headers: { Cookie: cookie },
    });
    const detailAuthParsed = publicMovieDetailSchema.parse(((await detailAuth.json()) as { data: unknown }).data);
    assert.equal(detailAuthParsed.isInWatchlist, true);

    // 7. Get Customer Watchlist
    const wlList = await fetch(`${baseUrl}/api/v1/public/watchlist`, {
      headers: { Cookie: cookie },
    });
    assert.equal(wlList.status, 200);
    const wlBody = (await wlList.json()) as { data: WatchlistRow[] };
    assert.equal(wlBody.data.length, 1);
    assert.equal(wlBody.data[0]?.tmdbId, 550);

    // 8. Toggle Watchlist again (Remove)
    const toggleRemove = await fetch(`${baseUrl}/api/v1/public/watchlist/toggle`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tmdbId: 550 }),
    });
    assert.equal(toggleRemove.status, 200);
    const remBody = (await toggleRemove.json()) as { data: { isInWatchlist: boolean } };
    assert.equal(remBody.data.isInWatchlist, false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
