import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  posCheckoutResultSchema,
  posTicketStubSchema,
  type PosTodayShowtime,
  type UserRole,
} from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createTicketPosService,
  type TicketPosStore,
} from '../services/ticket-pos-service.js';
import { hashPassword } from '../lib/crypto.js';
import { bookings, bookingSeats, movies, studios, showtimes, users } from '../db/schema.js';

function createTicketPosMemoryStores() {
  const localStudios: (typeof studios.$inferSelect)[] = [
    {
      id: 1,
      name: 'Studio 1 Regular',
      type: 'regular',
      rowsCount: 4,
      colsCount: 6,
      disabledSeats: ['A3'],
      totalSeats: 23,
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

  const now = new Date();
  const localShowtimes: (typeof showtimes.$inferSelect)[] = [
    {
      id: 1,
      movieId: 1,
      studioId: 1,
      startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000), // starts in 1 hr
      endTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // ends in 3 hrs
      price: 50000,
      createdAt: new Date(),
    },
  ];

  const localUsers: (typeof users.$inferSelect)[] = [];
  const localBookings: (typeof bookings.$inferSelect)[] = [];
  const localSeats: (typeof bookingSeats.$inferSelect)[] = [];
  const audits: Array<{ action: string; description: string }> = [];

  let nextBookingId = 1;

  const store: TicketPosStore = {
    async getTodayShowtimes() {
      return localShowtimes.map((st) => {
        const std = localStudios.find((s) => s.id === st.studioId)!;
        const mv = localMovies.find((m) => m.id === st.movieId)!;
        const occupiedCount = localSeats.filter((s) => s.showtimeId === st.id && s.isActive).length;
        return {
          showtime: st,
          studio: std,
          movie: mv,
          occupiedCount,
        };
      });
    },

    async getShowtimeDetails(showtimeId) {
      const st = localShowtimes.find((s) => s.id === showtimeId);
      if (!st) return null;
      const std = localStudios.find((s) => s.id === st.studioId)!;
      const mv = localMovies.find((m) => m.id === st.movieId)!;
      return { showtime: st, studio: std, movie: mv };
    },

    async findMemberByEmail(email) {
      return localUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },

    async getCashierUser(cashierId) {
      return localUsers.find((u) => u.id === cashierId) ?? null;
    },

    async createPosTransaction(data) {
      for (const seat of data.seatCodes) {
        const conflict = localSeats.find(
          (s) => s.showtimeId === data.showtimeId && s.seatCode === seat && s.isActive,
        );
        if (conflict) {
          throw new Error(`Kursi ${seat} sudah terisi atau sedang diproses`);
        }
      }

      const booking: typeof bookings.$inferSelect = {
        id: nextBookingId++,
        bookingCode: data.bookingCode,
        userId: data.userId,
        cashierId: data.cashierId,
        showtimeId: data.showtimeId,
        status: 'paid',
        totalSeats: data.seatCodes.length,
        totalPrice: data.totalPrice,
        paymentMethod: data.paymentMethod,
        heldExpiresAt: null,
        paidAt: data.paidAt,
        redeemedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      localBookings.push(booking);

      for (const seatCode of data.seatCodes) {
        localSeats.push({
          id: localSeats.length + 1,
          bookingId: booking.id,
          showtimeId: data.showtimeId,
          seatCode,
          price: data.pricePerTicket,
          isActive: true,
          createdAt: new Date(),
        });
      }

      if (data.userId && data.pointsEarned > 0) {
        const u = localUsers.find((usr) => usr.id === data.userId);
        if (u) u.points += data.pointsEarned;
      }
    },

    async recordAudit(entry) {
      audits.push({ action: entry.action, description: entry.description });
    },

    async getBookingForStub(bookingCode) {
      const b = localBookings.find((bk) => bk.bookingCode === bookingCode);
      if (!b) return null;
      const st = localShowtimes.find((s) => s.id === b.showtimeId)!;
      const std = localStudios.find((s) => s.id === st.studioId)!;
      const mv = localMovies.find((m) => m.id === st.movieId)!;
      const seats = localSeats.filter((s) => s.bookingId === b.id);
      const cashier = localUsers.find((u) => u.id === b.cashierId) ?? null;
      return { booking: b, showtime: st, studio: std, movie: mv, seats, cashier };
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

test('Ticket POS API: Cashier access, walk-in cash checkout with change calculation, member points, and stub printing', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const staffList: StoredUser[] = [
    {
      id: 1,
      name: 'Cashier Alice',
      email: 'cashier@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'cashier',
      points: 0,
      isActive: true,
    },
    {
      id: 2,
      name: 'Cleaner Bob',
      email: 'cleaner@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'cleaner',
      points: 0,
      isActive: true,
    },
    {
      id: 7,
      name: 'Member Charlie',
      email: 'charlie@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'user',
      points: 50,
      isActive: true,
    },
  ];

  const { store, localUsers, localBookings, audits } = createTicketPosMemoryStores();
  for (const u of staffList) {
    localUsers.push({
      ...u,
      dateOfBirth: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const authStore = createMemoryAuthStore(staffList);
  const authService = createAuthService(authStore);
  const ticketPosService = createTicketPosService(store);

  const app = createApp({
    checkDb: async () => true,
    authService,
    ticketPosService,
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const cashierCookie = await loginStaffAndGetCookie(baseUrl, 'cashier@cinemax.local');
    const cleanerCookie = await loginStaffAndGetCookie(baseUrl, 'cleaner@cinemax.local');

    // 1. RBAC Policy check: Cleaner is rejected on /pos/ticket routes
    const cleanerRes = await fetch(`${baseUrl}/api/v1/pos/ticket/today-showtimes`, {
      headers: { Cookie: cleanerCookie },
    });
    assert.equal(cleanerRes.status, 403);

    // 2. Cashier can view today showtimes
    const cashierRes = await fetch(`${baseUrl}/api/v1/pos/ticket/today-showtimes`, {
      headers: { Cookie: cashierCookie },
    });
    assert.equal(cashierRes.status, 200);
    const todayBody = (await cashierRes.json()) as { data: PosTodayShowtime[] };
    assert.equal(todayBody.data.length, 1);
    assert.equal(todayBody.data[0]?.movieTitle, 'Fight Club');

    // 3. Cashier walk-in checkout: 2 seats (A1, A2 @ Rp 50.000 = Rp 100.000)
    // Paid Rp 150.000 cash -> Change Rp 50.000
    // Credit points to Member Charlie (2 * 10 = 20 pts)
    const checkoutRes = await fetch(`${baseUrl}/api/v1/pos/ticket/checkout`, {
      method: 'POST',
      headers: { Cookie: cashierCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showtimeId: 1,
        seatCodes: ['A1', 'A2'],
        paymentMethod: 'cash',
        amountPaid: 150000,
        memberEmail: 'charlie@cinemax.local',
      }),
    });
    assert.equal(checkoutRes.status, 201);
    const checkoutBody = (await checkoutRes.json()) as { data: unknown };
    const res = posCheckoutResultSchema.parse(checkoutBody.data);

    assert.equal(res.totalPrice, 100000);
    assert.equal(res.amountPaid, 150000);
    assert.equal(res.change, 50000);
    assert.equal(res.pointsEarned, 20);
    assert.equal(res.stub.cashierName, 'Cashier Alice');

    // Member points verified: 50 + 20 = 70
    const charlie = localUsers.find((u) => u.email === 'charlie@cinemax.local');
    assert.equal(charlie?.points, 70);

    // 4. Fetch Stub for printing
    const stubRes = await fetch(`${baseUrl}/api/v1/pos/ticket/${res.bookingCode}/stub`, {
      headers: { Cookie: cashierCookie },
    });
    assert.equal(stubRes.status, 200);
    const stubBody = (await stubRes.json()) as { data: unknown };
    const stub = posTicketStubSchema.parse(stubBody.data);
    assert.equal(stub.bookingCode, res.bookingCode);
    assert.deepEqual(stub.seatCodes, ['A1', 'A2']);
    assert.equal(stub.totalPrice, 100000);

    // 5. Audit log verified
    assert.equal(audits.some((a) => a.action === 'TICKET_POS_CHECKOUT'), true);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
