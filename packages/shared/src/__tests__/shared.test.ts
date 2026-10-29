import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND,
  USER_ROLES,
  STAFF_ROLES,
  isStaffRole,
  STUDIO_TYPES,
  BOOKING_STATUSES,
  PAYMENT_METHODS,
  healthDataSchema,
  registerInputSchema,
  loginInputSchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminUserListQuerySchema,
  generateStudioSeatCodes,
  sanitizeDisabledSeats,
  buildTmdbImageUrl,
  createStudioSchema,
  createShowtimeSchema,
  publicMovieDetailSchema,
  publicNowPlayingResponseSchema,
  holdSeatsInputSchema,
  seatMapResponseSchema,
  paymentProcessSchema,
  calculatePointsEarned,
  customerProfileUpdateSchema,
  dashboardSummarySchema,
  posCheckoutInputSchema,
  posCheckoutResultSchema,
  ticketScanInputSchema,
  ticketScanResultSchema,
} from '../index.js';

test('BRAND exposes CINEMAX identity and booking prefix', () => {
  assert.equal(BRAND.name, 'CINEMAX');
  assert.equal(BRAND.bookingPrefix, 'CX');
});

test('enums preserve legacy cinema-xxl roles plus staff and held/expired statuses', () => {
  assert.deepEqual(USER_ROLES, [
    'admin',
    'manager',
    'cashier',
    'fnb_staff',
    'cleaner',
    'staff',
    'user',
  ]);
  assert.deepEqual(STUDIO_TYPES, ['regular', '3d', 'premier']);
  assert.ok(BOOKING_STATUSES.includes('held'));
  assert.ok(BOOKING_STATUSES.includes('cancelled'));
  assert.deepEqual(PAYMENT_METHODS, ['cash', 'qris']);
});

test('healthDataSchema validates valid payload and rejects negative latency', () => {
  const valid = healthDataSchema.safeParse({
    service: 'cinemax-api',
    status: 'ok',
    db: 'connected',
    latencyMs: 4,
    timestamp: new Date().toISOString(),
  });
  assert.equal(valid.success, true);

  const invalid = healthDataSchema.safeParse({
    service: 'cinemax-api',
    status: 'ok',
    db: 'connected',
    latencyMs: -1,
    timestamp: 'not-iso',
  });
  assert.equal(invalid.success, false);
});

test('STAFF_ROLES and auth schemas validate and normalize inputs', () => {
  assert.equal(STAFF_ROLES.length, 6);
  assert.equal(isStaffRole('admin'), true);
  assert.equal(isStaffRole('user'), false);

  const ok = registerInputSchema.safeParse({
    name: '  Budi Santoso ',
    email: '  BUDI@Example.com ',
    phoneNumber: '  ',
    password: 'Password123!',
    passwordConfirmation: 'Password123!',
  });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.email, 'budi@example.com');
    assert.equal(ok.data.name, 'Budi Santoso');
    assert.equal(ok.data.phoneNumber, null);
  }

  const mismatch = registerInputSchema.safeParse({
    name: 'Budi',
    email: 'budi@example.com',
    password: 'Password123!',
    passwordConfirmation: 'Different123!',
  });
  assert.equal(mismatch.success, false);

  const loginOk = loginInputSchema.safeParse({
    email: '  ADMIN@CINEMAX.LOCAL ',
    password: 'secret',
  });
  assert.equal(loginOk.success, true);
  if (loginOk.success) {
    assert.equal(loginOk.data.email, 'admin@cinemax.local');
  }
});

test('admin user schemas validate create, optional password update, and list query', () => {
  const created = adminCreateUserSchema.safeParse({
    name: 'Kasir Baru',
    email: '  KASIR2@cinemax.local ',
    role: 'cashier',
    password: 'Password123!',
  });
  assert.equal(created.success, true);
  if (created.success) {
    assert.equal(created.data.email, 'kasir2@cinemax.local');
    assert.equal(created.data.isActive, true);
  }

  const updateBlankPass = adminUpdateUserSchema.safeParse({
    name: 'Kasir Update',
    password: '',
  });
  assert.equal(updateBlankPass.success, true);
  if (updateBlankPass.success) {
    assert.equal(updateBlankPass.data.password, undefined);
  }

  const updateShortPass = adminUpdateUserSchema.safeParse({
    password: 'short',
  });
  assert.equal(updateShortPass.success, false);

  const query = adminUserListQuerySchema.parse({ staffOnly: 'true', page: '2' });
  assert.equal(query.staffOnly, true);
  assert.equal(query.page, 2);
});

test('operations helpers and schemas calculate seat layouts and validate showtimes', () => {
  // Grid 2x3: A1, A2, A3, B1, B2, B3 with B2 disabled
  const seats = generateStudioSeatCodes(2, 3, ['B2']);
  assert.deepEqual(seats, ['A1', 'A2', 'A3', 'B1', 'B3']);

  // Out of bound seats sanitized
  const sanitized = sanitizeDisabledSeats(['A1', 'Z99', 'B2', 'A1'], 2, 2);
  assert.deepEqual(sanitized, ['A1', 'B2']);

  // TMDb image URL
  assert.equal(
    buildTmdbImageUrl('/poster.jpg', 'w500'),
    'https://image.tmdb.org/t/p/w500/poster.jpg',
  );
  assert.equal(buildTmdbImageUrl(null), null);

  // createStudioSchema auto-calculates totalSeats
  const studio = createStudioSchema.parse({
    name: 'Studio 1 Regular',
    type: 'regular',
    rowsCount: 5,
    colsCount: 10,
    disabledSeats: ['A1', 'A2'],
    basePrice: 50000,
  });
  assert.equal(studio.totalSeats, 48);
  assert.deepEqual(studio.disabledSeats, ['A1', 'A2']);

  // createShowtimeSchema requires either movieId or tmdbId
  const validShowtime = createShowtimeSchema.safeParse({
    tmdbId: 12345,
    studioId: 1,
    startTime: '2026-11-01T14:00:00Z',
  });
  assert.equal(validShowtime.success, true);

  const invalidShowtime = createShowtimeSchema.safeParse({
    studioId: 1,
    startTime: '2026-11-01T14:00:00Z',
  });
  assert.equal(invalidShowtime.success, false);
});

test('public movies schemas validate now playing and movie detail structures', () => {
  const np = publicNowPlayingResponseSchema.safeParse({
    heroMovie: {
      id: 1,
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'Cool movie',
      posterUrl: null,
      backdropUrl: null,
      releaseDate: '1999-10-15',
      voteAverage: 8.4,
      runtimeMinutes: 139,
      genres: ['Drama'],
      activeShowtimeCount: 2,
    },
    movies: [],
  });
  assert.equal(np.success, true);

  const detail = publicMovieDetailSchema.safeParse({
    id: 1,
    tmdbId: 550,
    title: 'Fight Club',
    overview: 'Cool movie',
    posterUrl: null,
    backdropUrl: null,
    releaseDate: '1999-10-15',
    runtimeMinutes: 139,
    voteAverage: 8.4,
    genres: ['Drama'],
    trailerYoutubeKey: 'O1nDozs-L79',
    isInWatchlist: true,
    showtimeDates: [
      {
        date: '2026-11-01',
        dateLabel: 'Min, 1 Nov',
        showtimes: [
          {
            id: 10,
            studioId: 1,
            studioName: 'Studio 1 Regular',
            studioType: 'regular',
            startTime: '2026-11-01T14:00:00Z',
            endTime: '2026-11-01T16:39:00Z',
            price: 50000,
            availableSeatsCount: 88,
          },
        ],
      },
    ],
  });
  assert.equal(detail.success, true);
});

test('booking schemas validate hold request rules (1-6 seats, no duplicates) and seat map response', () => {
  const validHold = holdSeatsInputSchema.safeParse({
    showtimeId: 1,
    seatCodes: ['a1', 'a2', 'b5'],
  });
  assert.equal(validHold.success, true);
  if (validHold.success) {
    assert.deepEqual(validHold.data.seatCodes, ['A1', 'A2', 'B5']);
  }

  const emptyHold = holdSeatsInputSchema.safeParse({
    showtimeId: 1,
    seatCodes: [],
  });
  assert.equal(emptyHold.success, false);

  const duplicateHold = holdSeatsInputSchema.safeParse({
    showtimeId: 1,
    seatCodes: ['A1', 'A1'],
  });
  assert.equal(duplicateHold.success, false);

  const tooManySeats = holdSeatsInputSchema.safeParse({
    showtimeId: 1,
    seatCodes: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
  });
  assert.equal(tooManySeats.success, false);

  const sm = seatMapResponseSchema.safeParse({
    showtime: {
      id: 1,
      startTime: '2026-11-05T14:00:00Z',
      endTime: '2026-11-05T16:39:00Z',
      price: 50000,
      movie: {
        id: 1,
        tmdbId: 550,
        title: 'Fight Club',
        posterUrl: null,
        runtimeMinutes: 139,
      },
    },
    studio: {
      id: 1,
      name: 'Studio 1 Regular',
      type: 'regular',
      rowsCount: 8,
      colsCount: 12,
      totalSeats: 88,
    },
    seats: [
      {
        code: 'A1',
        row: 'A',
        col: 1,
        status: 'available',
        price: 50000,
      },
    ],
  });
  assert.equal(sm.success, true);
});

test('payment schemas and point calculators validate payment methods and points per studio type', () => {
  const validPayment = paymentProcessSchema.parse({
    bookingCode: 'CX-ABCDEF',
    paymentMethod: 'qris',
  });
  assert.equal(validPayment.paymentMethod, 'qris');

  // Points calculation: 2 tickets in Premier = 2 * 15 = 30 pts
  assert.equal(calculatePointsEarned('premier', 2), 30);
  assert.equal(calculatePointsEarned('3d', 3), 39);
  assert.equal(calculatePointsEarned('regular', 1), 10);

  const profileUpdate = customerProfileUpdateSchema.parse({
    name: 'Budi Baru',
    phoneNumber: '08129999',
    newPassword: 'NewPassword123!',
  });
  assert.equal(profileUpdate.name, 'Budi Baru');
  assert.equal(profileUpdate.newPassword, 'NewPassword123!');
});

test('pos schemas validate cashier checkout input (up to 10 seats) and stub format', () => {
  const validCheckout = posCheckoutInputSchema.parse({
    showtimeId: 1,
    seatCodes: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
    paymentMethod: 'cash',
    amountPaid: 500000,
    memberEmail: 'vip@cinemax.local',
  });
  assert.equal(validCheckout.seatCodes.length, 7);
  assert.equal(validCheckout.seatCodes[0], 'A1');
  assert.equal(validCheckout.paymentMethod, 'cash');

  const stubTest = posCheckoutResultSchema.parse({
    bookingCode: 'CX-POS123',
    totalPrice: 100000,
    amountPaid: 150000,
    change: 50000,
    seatCodes: ['A1', 'A2'],
    pointsEarned: 20,
    stub: {
      bookingCode: 'CX-POS123',
      movieTitle: 'Fight Club',
      studioName: 'Studio 1 Regular',
      studioType: 'regular',
      dateFormatted: 'Kamis, 29 Okt 2026',
      timeFormatted: '14:00 WIB',
      seatCodes: ['A1', 'A2'],
      totalSeats: 2,
      totalPrice: 100000,
      paymentMethod: 'CASH',
      cashierName: 'Ticket Cashier',
      paidAtFormatted: '29/10/2026 13:45',
      qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=CX-POS123',
    },
  });
  assert.equal(stubTest.change, 50000);
});

test('validator and dashboard schemas parse scan results and summary KPI payloads', () => {
  const scanInput = ticketScanInputSchema.parse({ bookingCode: 'cx-abc999' });
  assert.equal(scanInput.bookingCode, 'CX-ABC999');

  const validScan = ticketScanResultSchema.parse({
    result: 'valid',
    message: 'Tiket valid! Silakan masuk studio.',
    ticket: {
      bookingCode: 'CX-ABC999',
      movieTitle: 'Inception',
      studioName: 'Studio 2 3D',
      studioType: '3d',
      startTime: '2026-10-29T14:00:00.000Z',
      seatCodes: ['C1', 'C2'],
      totalSeats: 2,
      redeemedAt: '2026-10-29T13:55:00.000Z',
      redeemedByName: 'Door Usher',
    },
  });
  assert.equal(validScan.result, 'valid');

  const summary = dashboardSummarySchema.parse({
    todayRevenue: 2500000,
    todayTicketsSold: 35,
    todayCheckInCount: 20,
    occupancyRatePercent: 42.5,
    todayStudios: [
      {
        studioId: 1,
        studioName: 'Studio 1 Regular',
        studioType: 'regular',
        activeShowtimesCount: 3,
        totalSeats: 88,
        occupiedSeats: 40,
        occupancyPercent: 45.45,
      },
    ],
    recentActivity: [
      {
        id: 1,
        action: 'BOOKING_REDEEMED',
        actorName: 'Usher',
        description: 'Tiket CX-ABC999 di-scan masuk',
        createdAt: '2026-10-29T13:55:00.000Z',
      },
    ],
  });
  assert.equal(summary.todayRevenue, 2500000);
});
