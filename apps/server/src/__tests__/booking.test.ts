import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  bookingDetailSchema,
  seatMapResponseSchema,
  type BookingDetail,
  type SeatMapResponse,
} from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createBookingService,
  type BookingStore,
} from '../services/booking-service.js';
import { hashPassword } from '../lib/crypto.js';
import { bookings, bookingSeats, movies, studios, showtimes } from '../db/schema.js';

function createBookingMemoryStores() {
  const localStudios: (typeof studios.$inferSelect)[] = [
    {
      id: 1,
      name: 'Studio 1 Regular',
      type: 'regular',
      rowsCount: 4,
      colsCount: 6,
      disabledSeats: ['A3', 'B3'], // 2 disabled seats (corridor)
      totalSeats: 22,
      basePrice: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const localMovies: (typeof movies.$inferSelect)[] = [
    {
      id: 1,
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'Cool movie',
      posterPath: '/fightclub.jpg',
      backdropPath: null,
      releaseDate: '1999-10-15',
      runtimeMinutes: 139,
      voteAverage: 8.4,
      genres: ['Drama'],
      trailerYoutubeKey: null,
      syncedAt: new Date(),
    },
  ];

  // Starts in 2 hours
  const localShowtimes: (typeof showtimes.$inferSelect)[] = [
    {
      id: 1,
      movieId: 1,
      studioId: 1,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      price: 50000,
      createdAt: new Date(),
    },
  ];

  const localBookings: (typeof bookings.$inferSelect)[] = [];
  const localSeats: (typeof bookingSeats.$inferSelect)[] = [];
  let nextBookingId = 1;
  let nextSeatId = 1;

  const store: BookingStore = {
    async sweepExpiredHeld() {
      const now = Date.now();
      for (const b of localBookings) {
        if (b.status === 'held' && b.heldExpiresAt && b.heldExpiresAt.getTime() < now) {
          b.status = 'expired';
          for (const s of localSeats) {
            if (s.bookingId === b.id) {
              s.isActive = false;
            }
          }
        }
      }
    },

    async getShowtimeWithStudioAndMovie(showtimeId) {
      const st = localShowtimes.find((s) => s.id === showtimeId);
      if (!st) return null;
      return {
        showtime: st,
        studio: localStudios.find((s) => s.id === st.studioId)!,
        movie: localMovies.find((m) => m.id === st.movieId)!,
      };
    },

    async getActiveSeatsForShowtime(showtimeId) {
      const result: Array<{
        seatCode: string;
        bookingStatus: typeof bookings.$inferSelect['status'];
        userId: number | null;
        heldExpiresAt: Date | null;
      }> = [];

      for (const s of localSeats) {
        if (s.showtimeId === showtimeId && s.isActive) {
          const b = localBookings.find((bk) => bk.id === s.bookingId);
          if (b) {
            result.push({
              seatCode: s.seatCode,
              bookingStatus: b.status,
              userId: b.userId,
              heldExpiresAt: b.heldExpiresAt,
            });
          }
        }
      }

      return result;
    },

    async findBookingByCode(bookingCode) {
      const b = localBookings.find((bk) => bk.bookingCode === bookingCode);
      if (!b) return null;
      const st = localShowtimes.find((s) => s.id === b.showtimeId)!;
      const std = localStudios.find((s) => s.id === st.studioId)!;
      const mv = localMovies.find((m) => m.id === st.movieId)!;
      const seats = localSeats.filter((s) => s.bookingId === b.id);
      return { booking: b, seats, showtime: st, studio: std, movie: mv };
    },

    async createHeldBooking(data) {
      // Check active conflict
      for (const reqSeat of data.seatCodes) {
        const conflict = localSeats.find(
          (s) => s.showtimeId === data.showtimeId && s.seatCode === reqSeat && s.isActive,
        );
        if (conflict) {
          throw new Error(`Kursi ${reqSeat} baru saja diambil atau sedang diproses oleh pelanggan lain`);
        }
      }

      const totalSeats = data.seatCodes.length;
      const totalPrice = totalSeats * data.pricePerTicket;

      const newBooking: typeof bookings.$inferSelect = {
        id: nextBookingId++,
        bookingCode: data.bookingCode,
        userId: data.userId,
        cashierId: null,
        showtimeId: data.showtimeId,
        status: 'held',
        totalSeats,
        totalPrice,
        paymentMethod: null,
        heldExpiresAt: data.heldExpiresAt,
        paidAt: null,
        redeemedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      localBookings.push(newBooking);

      for (const seatCode of data.seatCodes) {
        localSeats.push({
          id: nextSeatId++,
          bookingId: newBooking.id,
          showtimeId: data.showtimeId,
          seatCode,
          price: data.pricePerTicket,
          isActive: true,
          createdAt: new Date(),
        });
      }

      const st = localShowtimes.find((s) => s.id === data.showtimeId)!;
      const std = localStudios.find((s) => s.id === st.studioId)!;
      const mv = localMovies.find((m) => m.id === st.movieId)!;
      const remainingSeconds = Math.max(0, Math.floor((data.heldExpiresAt.getTime() - Date.now()) / 1000));

      return {
        id: newBooking.id,
        bookingCode: newBooking.bookingCode,
        showtimeId: newBooking.showtimeId,
        userId: newBooking.userId,
        status: newBooking.status,
        totalSeats: newBooking.totalSeats,
        totalPrice: newBooking.totalPrice,
        paymentMethod: newBooking.paymentMethod,
        seatCodes: data.seatCodes,
        heldExpiresAt: newBooking.heldExpiresAt.toISOString(),
        remainingSeconds,
        showtime: {
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          movieTitle: mv.title,
          posterUrl: null,
          studioName: std.name,
          studioType: std.type,
        },
      };
    },

    async cancelHeldBooking(bookingId) {
      const b = localBookings.find((bk) => bk.id === bookingId);
      if (b) {
        b.status = 'cancelled';
        for (const s of localSeats) {
          if (s.bookingId === bookingId) {
            s.isActive = false;
          }
        }
      }
    },
  };

  return { store, localBookings, localSeats };
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

test('Booking Engine API: Seat Map, Atomic Hold, Conflict Prevention, and Cancelation', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const users: StoredUser[] = [
    {
      id: 1,
      name: 'Customer One',
      email: 'user1@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'user',
      points: 0,
      isActive: true,
    },
    {
      id: 2,
      name: 'Customer Two',
      email: 'user2@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'user',
      points: 0,
      isActive: true,
    },
  ];

  const authStore = createMemoryAuthStore(users);
  const authService = createAuthService(authStore);
  const { store } = createBookingMemoryStores();
  const bookingService = createBookingService(store);

  const app = createApp({
    checkDb: async () => true,
    authService,
    bookingService,
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Get Seat Map (Guest)
    const smRes = await fetch(`${baseUrl}/api/v1/booking/showtimes/1/seats`);
    assert.equal(smRes.status, 200);
    const smBody = (await smRes.json()) as { data: unknown };
    const sm = seatMapResponseSchema.parse(smBody.data);
    assert.equal(sm.studio.name, 'Studio 1 Regular');
    assert.equal(sm.seats.length, 24); // 4 rows x 6 cols
    const disabledSlot = sm.seats.find((s) => s.code === 'A3');
    assert.equal(disabledSlot?.status, 'disabled');

    // 2. Login User 1 and User 2
    const login1 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user1@cinemax.local', password: 'Cinemax123!' }),
    });
    const cookie1 = login1.headers.get('set-cookie')?.split(';')[0]!;

    const login2 = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user2@cinemax.local', password: 'Cinemax123!' }),
    });
    const cookie2 = login2.headers.get('set-cookie')?.split(';')[0]!;

    // 3. User 1 holds seats A1, A2
    const holdRes1 = await fetch(`${baseUrl}/api/v1/booking/hold`, {
      method: 'POST',
      headers: { Cookie: cookie1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showtimeId: 1,
        seatCodes: ['A1', 'A2'],
      }),
    });
    assert.equal(holdRes1.status, 201);
    const holdBody1 = (await holdRes1.json()) as { data: unknown };
    const bDetail1 = bookingDetailSchema.parse(holdBody1.data);
    assert.equal(bDetail1.status, 'held');
    assert.equal(bDetail1.totalSeats, 2);
    assert.equal(bDetail1.totalPrice, 100000);
    assert.ok(bDetail1.bookingCode.startsWith('CX-'));

    // 4. Concurrency Test: User 2 tries to hold A2 and A4 -> Rejected with 500/409 (conflict on A2)
    const holdRes2 = await fetch(`${baseUrl}/api/v1/booking/hold`, {
      method: 'POST',
      headers: { Cookie: cookie2, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showtimeId: 1,
        seatCodes: ['A2', 'A4'],
      }),
    });
    assert.notEqual(holdRes2.status, 201);

    // 5. Seat Map from User 2 perspective: A1 and A2 are 'held'
    const smRes2 = await fetch(`${baseUrl}/api/v1/booking/showtimes/1/seats`, {
      headers: { Cookie: cookie2 },
    });
    const sm2 = seatMapResponseSchema.parse(((await smRes2.json()) as { data: unknown }).data);
    const a1Slot = sm2.seats.find((s) => s.code === 'A1');
    const a2Slot = sm2.seats.find((s) => s.code === 'A2');
    assert.equal(a1Slot?.status, 'held');
    assert.equal(a2Slot?.status, 'held');

    // 6. User 1 cancels hold
    const cancelRes = await fetch(`${baseUrl}/api/v1/booking/${bDetail1.bookingCode}/cancel`, {
      method: 'POST',
      headers: { Cookie: cookie1 },
    });
    assert.equal(cancelRes.status, 200);

    // 7. Now User 2 CAN hold A2 and A4
    const holdRes2After = await fetch(`${baseUrl}/api/v1/booking/hold`, {
      method: 'POST',
      headers: { Cookie: cookie2, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showtimeId: 1,
        seatCodes: ['A2', 'A4'],
      }),
    });
    assert.equal(holdRes2After.status, 201);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
