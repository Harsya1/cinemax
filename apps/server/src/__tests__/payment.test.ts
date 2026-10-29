import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { CustomerBookingSummary } from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createPaymentService,
  type PaymentStore,
} from '../services/payment-service.js';
import { hashPassword } from '../lib/crypto.js';
import { bookings, bookingSeats, movies, studios, showtimes, users } from '../db/schema.js';

function createPaymentMemoryStores() {
  const localStudios: (typeof studios.$inferSelect)[] = [
    {
      id: 1,
      name: 'Studio 3 Premier Velvet',
      type: 'premier',
      rowsCount: 5,
      colsCount: 8,
      disabledSeats: [],
      totalSeats: 40,
      basePrice: 100000,
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
      posterPath: '/fc.jpg',
      backdropPath: null,
      releaseDate: '1999-10-15',
      runtimeMinutes: 139,
      voteAverage: 8.4,
      genres: ['Drama'],
      trailerYoutubeKey: null,
      syncedAt: new Date(),
    },
  ];

  const localShowtimes: (typeof showtimes.$inferSelect)[] = [
    {
      id: 1,
      movieId: 1,
      studioId: 1,
      startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
      price: 100000,
      createdAt: new Date(),
    },
  ];

  const localUsers: (typeof users.$inferSelect)[] = [];
  const localBookings: (typeof bookings.$inferSelect)[] = [];
  const localSeats: (typeof bookingSeats.$inferSelect)[] = [];
  const audits: Array<{ action: string; description: string }> = [];

  const store: PaymentStore = {
    async findBookingByCode(bookingCode) {
      const b = localBookings.find((bk) => bk.bookingCode === bookingCode);
      if (!b) return null;
      const st = localShowtimes.find((s) => s.id === b.showtimeId)!;
      const std = localStudios.find((s) => s.id === st.studioId)!;
      const mv = localMovies.find((m) => m.id === st.movieId)!;
      const seats = localSeats.filter((s) => s.bookingId === b.id);
      return { booking: b, showtime: st, studio: std, movie: mv, seats };
    },

    async markBookingAsPaid(data) {
      const b = localBookings.find((bk) => bk.id === data.bookingId);
      if (b) {
        b.status = 'paid';
        b.paymentMethod = data.paymentMethod;
        b.paidAt = data.paidAt;
      }
      if (data.userId && data.pointsToAdd > 0) {
        const u = localUsers.find((usr) => usr.id === data.userId);
        if (u) {
          u.points += data.pointsToAdd;
        }
      }
    },

    async recordAudit(entry) {
      audits.push({ action: entry.action, description: entry.description });
    },

    async getUserBookings(userId) {
      const userBks = localBookings.filter((b) => b.userId === userId);
      return userBks.map((b) => {
        const st = localShowtimes.find((s) => s.id === b.showtimeId)!;
        const std = localStudios.find((s) => s.id === st.studioId)!;
        const mv = localMovies.find((m) => m.id === st.movieId)!;
        const seats = localSeats.filter((s) => s.bookingId === b.id).map((s) => s.seatCode);
        return {
          id: b.id,
          bookingCode: b.bookingCode,
          status: b.status,
          totalSeats: b.totalSeats,
          totalPrice: b.totalPrice,
          paymentMethod: b.paymentMethod,
          seatCodes: seats,
          paidAt: b.paidAt ? b.paidAt.toISOString() : null,
          createdAt: b.createdAt.toISOString(),
          showtime: {
            id: st.id,
            startTime: st.startTime.toISOString(),
            endTime: st.endTime.toISOString(),
            price: st.price,
            movieTitle: mv.title,
            posterUrl: mv.posterPath ? `https://image.tmdb.org/t/p/w185${mv.posterPath}` : null,
            studioName: std.name,
            studioType: std.type,
          },
        };
      });
    },

    async getUserById(userId) {
      return localUsers.find((u) => u.id === userId) ?? null;
    },

    async updateUser(userId, data) {
      const idx = localUsers.findIndex((u) => u.id === userId);
      assert.notEqual(idx, -1);
      const curr = localUsers[idx]!;
      const updated = {
        ...curr,
        ...(data.name ? { name: data.name } : {}),
        ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
        ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
      };
      localUsers[idx] = updated;
      return updated;
    },
  };

  return { store, localUsers, localBookings, localSeats, audits };
}

function createMemoryAuthStore(usersList: StoredUser[]): AuthStore {
  const sessions = new Map<string, { userId: number; expiresAt: Date }>();
  return {
    async findUserByEmail(email) {
      return usersList.find((u) => u.email === email) ?? null;
    },
    async createUser(input) {
      const created: StoredUser = {
        id: usersList.length + 1,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phoneNumber: input.phoneNumber,
        role: input.role,
        points: 0,
        isActive: true,
      };
      usersList.push(created);
      return created;
    },
    async createSession(input) {
      sessions.set(input.tokenHash, { userId: input.userId, expiresAt: input.expiresAt });
    },
    async findSessionWithUser(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s) return null;
      const user = usersList.find((u) => u.id === s.userId);
      if (!user) return null;
      return { expiresAt: s.expiresAt, user };
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
  };
}

test('Payment & Profile API: QRIS payment adds points (+30 for 2 Premier tickets), populates profile tickets, and handles profile updates', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const testUser: StoredUser = {
    id: 10,
    name: 'Pelanggan VIP',
    email: 'vip@cinemax.local',
    passwordHash,
    phoneNumber: '0812345678',
    role: 'user',
    points: 100, // starting points
    isActive: true,
  };

  const { store, localUsers, localBookings, localSeats, audits } = createPaymentMemoryStores();
  localUsers.push({
    ...testUser,
    dateOfBirth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Seed 1 active held booking with 2 seats in Premier
  localBookings.push({
    id: 1,
    bookingCode: 'CX-PAYTEST1',
    userId: 10,
    cashierId: null,
    showtimeId: 1,
    status: 'held',
    totalSeats: 2,
    totalPrice: 200000,
    paymentMethod: null,
    heldExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    paidAt: null,
    redeemedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  localSeats.push(
    { id: 1, bookingId: 1, showtimeId: 1, seatCode: 'A1', price: 100000, isActive: true, createdAt: new Date() },
    { id: 2, bookingId: 1, showtimeId: 1, seatCode: 'A2', price: 100000, isActive: true, createdAt: new Date() },
  );

  const authStore = createMemoryAuthStore([testUser]);
  const authService = createAuthService(authStore);
  const paymentService = createPaymentService(store);

  const app = createApp({
    checkDb: async () => true,
    authService,
    paymentService,
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Login user 10
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vip@cinemax.local', password: 'Cinemax123!' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0]!;

    // 2. Process QRIS payment
    const payRes = await fetch(`${baseUrl}/api/v1/payment/process`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingCode: 'CX-PAYTEST1',
        paymentMethod: 'qris',
      }),
    });
    assert.equal(payRes.status, 200);
    const payBody = (await payRes.json()) as { data: { pointsEarned: number; status: string } };
    assert.equal(payBody.data.status, 'paid');
    assert.equal(payBody.data.pointsEarned, 30); // 2 seats * 15 pts for Premier

    // User points updated in memory store: 100 + 30 = 130
    assert.equal(localUsers[0]?.points, 130);
    assert.equal(audits.some((a) => a.action === 'PAYMENT_PROCESSED'), true);

    // 3. Get Customer Tickets
    const tixRes = await fetch(`${baseUrl}/api/v1/profile/tickets`, {
      headers: { Cookie: cookie },
    });
    assert.equal(tixRes.status, 200);
    const tixBody = (await tixRes.json()) as {
      data: { activeTickets: CustomerBookingSummary[]; pastTickets: CustomerBookingSummary[] };
    };
    assert.equal(tixBody.data.activeTickets.length, 1);
    assert.equal(tixBody.data.activeTickets[0]?.bookingCode, 'CX-PAYTEST1');
    assert.deepEqual(tixBody.data.activeTickets[0]?.seatCodes, ['A1', 'A2']);

    // 4. Update Profile (Name & Phone)
    const updateRes = await fetch(`${baseUrl}/api/v1/profile`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'VIP Member Updated',
        phoneNumber: '081299998888',
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateBody = (await updateRes.json()) as { data: { name: string; phoneNumber: string } };
    assert.equal(updateBody.data.name, 'VIP Member Updated');
    assert.equal(updateBody.data.phoneNumber, '081299998888');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
