import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  dashboardSummarySchema,
  ticketScanResultSchema,
  type TicketScanResult,
} from '@cinemax/shared';
import { createApp } from '../app.js';
import { createAuthService, type AuthStore, type StoredUser } from '../services/auth-service.js';
import {
  createValidatorService,
  type ValidatorStore,
} from '../services/validator-service.js';
import {
  createDashboardService,
  type DashboardStore,
} from '../services/dashboard-service.js';
import { hashPassword } from '../lib/crypto.js';
import { bookings, bookingSeats, movies, studios, showtimes, users } from '../db/schema.js';

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

test('Validator & Dashboard: Scan valid ticket, prevent double-redeem, wrong schedule check, and aggregate dashboard KPIs', async () => {
  const passwordHash = await hashPassword('Cinemax123!');
  const staffList: StoredUser[] = [
    {
      id: 1,
      name: 'Usher Dan',
      email: 'staff@cinemax.local',
      passwordHash,
      phoneNumber: null,
      role: 'staff',
      points: 0,
      isActive: true,
    },
  ];

  const now = new Date();
  const todayShowtime: typeof showtimes.$inferSelect = {
    id: 1,
    movieId: 1,
    studioId: 1,
    startTime: new Date(now.getTime() + 30 * 60 * 1000), // starts in 30 mins
    endTime: new Date(now.getTime() + 150 * 60 * 1000),
    price: 50000,
    createdAt: new Date(),
  };

  const tomorrowShowtime: typeof showtimes.$inferSelect = {
    id: 2,
    movieId: 1,
    studioId: 1,
    startTime: new Date(now.getTime() + 26 * 60 * 60 * 1000), // tomorrow
    endTime: new Date(now.getTime() + 28 * 60 * 60 * 1000),
    price: 50000,
    createdAt: new Date(),
  };

  const std: typeof studios.$inferSelect = {
    id: 1,
    name: 'Studio 1 Regular',
    type: 'regular',
    rowsCount: 4,
    colsCount: 6,
    disabledSeats: [],
    totalSeats: 24,
    basePrice: 50000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mv: typeof movies.$inferSelect = {
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
  };

  const localBookings: (typeof bookings.$inferSelect)[] = [
    {
      id: 1,
      bookingCode: 'CX-VALID123',
      userId: 7,
      cashierId: null,
      showtimeId: 1,
      status: 'paid',
      totalSeats: 2,
      totalPrice: 100000,
      paymentMethod: 'qris',
      heldExpiresAt: null,
      paidAt: now,
      redeemedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      bookingCode: 'CX-TOMORROW',
      userId: 7,
      cashierId: null,
      showtimeId: 2,
      status: 'paid',
      totalSeats: 1,
      totalPrice: 50000,
      paymentMethod: 'cash',
      heldExpiresAt: null,
      paidAt: now,
      redeemedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      bookingCode: 'CX-UNPAID',
      userId: 7,
      cashierId: null,
      showtimeId: 1,
      status: 'held',
      totalSeats: 1,
      totalPrice: 50000,
      paymentMethod: null,
      heldExpiresAt: new Date(now.getTime() + 600000),
      paidAt: null,
      redeemedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const localSeats: (typeof bookingSeats.$inferSelect)[] = [
    {
      id: 1,
      bookingId: 1,
      showtimeId: 1,
      seatCode: 'A1',
      price: 50000,
      isActive: true,
      createdAt: now,
    },
    {
      id: 2,
      bookingId: 1,
      showtimeId: 1,
      seatCode: 'A2',
      price: 50000,
      isActive: true,
      createdAt: now,
    },
    {
      id: 3,
      bookingId: 2,
      showtimeId: 2,
      seatCode: 'B1',
      price: 50000,
      isActive: true,
      createdAt: now,
    },
  ];

  const validatorStore: ValidatorStore = {
    async findBookingByCode(bookingCode) {
      const b = localBookings.find((bk) => bk.bookingCode === bookingCode);
      if (!b) return null;
      const st = b.showtimeId === 1 ? todayShowtime : tomorrowShowtime;
      const seats = localSeats.filter((s) => s.bookingId === b.id);
      return { booking: b, showtime: st, studio: std, movie: mv, seats };
    },
    async getUsherUser(usherId) {
      const u = staffList.find((usr) => usr.id === usherId);
      if (!u) return null;
      return {
        ...u,
        dateOfBirth: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async markAsRedeemed(bookingId, redeemedAt) {
      const b = localBookings.find((bk) => bk.id === bookingId);
      if (b) {
        b.status = 'redeemed';
        b.redeemedAt = redeemedAt;
      }
    },
    async recordAudit() {},
  };

  const dashboardStore: DashboardStore = {
    async getTodaySummaryData() {
      return {
        todayRevenue: 150000,
        todayTicketsSold: 3,
        todayCheckInCount: 2,
        studiosList: [std],
        todayShowtimes: [{ showtimeId: 1, studioId: 1, occupiedSeats: 2 }],
        recentLogs: [
          {
            id: 1,
            action: 'BOOKING_REDEEMED',
            actorName: 'Usher Dan',
            description: 'Tiket CX-VALID123 di-scan',
            createdAt: now,
          },
        ],
      };
    },
  };

  const authStore = createMemoryAuthStore(staffList);
  const authService = createAuthService(authStore);
  const validatorService = createValidatorService(validatorStore);
  const dashboardService = createDashboardService(dashboardStore);

  const app = createApp({
    checkDb: async () => true,
    authService,
    validatorService,
    dashboardService,
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const staffCookie = await loginStaffAndGetCookie(baseUrl, 'staff@cinemax.local');

    // 1. Scan valid ticket
    const scan1 = await fetch(`${baseUrl}/api/v1/validator/scan`, {
      method: 'POST',
      headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingCode: 'CX-VALID123' }),
    });
    assert.equal(scan1.status, 200);
    const body1 = ((await scan1.json()) as { data: TicketScanResult }).data;
    assert.equal(body1.result, 'valid');
    assert.equal(body1.ticket?.seatCodes.join(', '), 'A1, A2');

    // 2. Scan again -> already_redeemed
    const scan2 = await fetch(`${baseUrl}/api/v1/validator/scan`, {
      method: 'POST',
      headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingCode: 'CX-VALID123' }),
    });
    assert.equal(scan2.status, 200);
    const body2 = ((await scan2.json()) as { data: TicketScanResult }).data;
    assert.equal(body2.result, 'already_redeemed');

    // 3. Scan ticket for tomorrow -> wrong_schedule
    const scanTomorrow = await fetch(`${baseUrl}/api/v1/validator/scan`, {
      method: 'POST',
      headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingCode: 'CX-TOMORROW' }),
    });
    assert.equal(scanTomorrow.status, 200);
    const bodyTomorrow = ((await scanTomorrow.json()) as { data: TicketScanResult }).data;
    assert.equal(bodyTomorrow.result, 'wrong_schedule');

    // 4. Scan uncompleted booking -> invalid_status
    const scanUnpaid = await fetch(`${baseUrl}/api/v1/validator/scan`, {
      method: 'POST',
      headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingCode: 'CX-UNPAID' }),
    });
    assert.equal(scanUnpaid.status, 200);
    const bodyUnpaid = ((await scanUnpaid.json()) as { data: TicketScanResult }).data;
    assert.equal(bodyUnpaid.result, 'invalid_status');

    // 5. Scan non-existent -> not_found
    const scanFake = await fetch(`${baseUrl}/api/v1/validator/scan`, {
      method: 'POST',
      headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingCode: 'CX-GHOST' }),
    });
    assert.equal(scanFake.status, 200);
    const bodyFake = ((await scanFake.json()) as { data: TicketScanResult }).data;
    assert.equal(bodyFake.result, 'not_found');

    // 6. Dashboard summary
    const dashRes = await fetch(`${baseUrl}/api/v1/dashboard/summary`, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(dashRes.status, 200);
    const dashBody = (await dashRes.json()) as { data: unknown };
    const summary = dashboardSummarySchema.parse(dashBody.data);
    assert.equal(summary.todayRevenue, 150000);
    assert.equal(summary.todayTicketsSold, 3);
    assert.equal(summary.todayCheckInCount, 2);
    assert.equal(summary.todayStudios.length, 1);
    assert.equal(summary.recentActivity.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
