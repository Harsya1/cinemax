import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import {
  buildTmdbImageUrl,
  getRowLetter,
  isSeatWithinGrid,
  type BookingDetail,
  type HoldSeatsInput,
  type SeatMapResponse,
  type SeatSlot,
  type SeatStatus,
} from '@cinemax/shared';
import { getDb } from '../db/index.js';
import {
  bookingSeats,
  bookings,
  movies,
  showtimes,
  studios,
} from '../db/schema.js';
import { AppError } from '../lib/http-error.js';

export const HELD_TTL_MINUTES = 10;

export interface BookingStore {
  sweepExpiredHeld(showtimeId?: number): Promise<void>;
  getShowtimeWithStudioAndMovie(showtimeId: number): Promise<{
    showtime: typeof showtimes.$inferSelect;
    studio: typeof studios.$inferSelect;
    movie: typeof movies.$inferSelect;
  } | null>;
  getActiveSeatsForShowtime(showtimeId: number): Promise<
    Array<{
      seatCode: string;
      bookingStatus: typeof bookings.$inferSelect['status'];
      userId: number | null;
      heldExpiresAt: Date | null;
    }>
  >;
  findBookingByCode(bookingCode: string): Promise<{
    booking: typeof bookings.$inferSelect;
    seats: (typeof bookingSeats.$inferSelect)[];
    showtime: typeof showtimes.$inferSelect;
    studio: typeof studios.$inferSelect;
    movie: typeof movies.$inferSelect;
  } | null>;
  createHeldBooking(data: {
    bookingCode: string;
    userId: number;
    showtimeId: number;
    seatCodes: string[];
    pricePerTicket: number;
    heldExpiresAt: Date;
  }): Promise<BookingDetail>;
  cancelHeldBooking(bookingId: number): Promise<void>;
}

export function createDrizzleBookingStore(): BookingStore {
  return {
    async sweepExpiredHeld(showtimeId?: number) {
      const db = getDb();
      const now = new Date();

      // Find expired held bookings
      const whereConds = [
        eq(bookings.status, 'held'),
        lt(bookings.heldExpiresAt, now),
      ];
      if (showtimeId) {
        whereConds.push(eq(bookings.showtimeId, showtimeId));
      }

      const expired = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(...whereConds));

      if (expired.length === 0) return;
      const expiredIds = expired.map((b) => b.id);

      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({ status: 'expired', updatedAt: now })
          .where(inArray(bookings.id, expiredIds));

        await tx
          .update(bookingSeats)
          .set({ isActive: false })
          .where(inArray(bookingSeats.bookingId, expiredIds));
      });
    },

    async getShowtimeWithStudioAndMovie(showtimeId: number) {
      const rows = await getDb()
        .select({
          showtime: showtimes,
          studio: studios,
          movie: movies,
        })
        .from(showtimes)
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .where(eq(showtimes.id, showtimeId))
        .limit(1);

      return rows[0] ?? null;
    },

    async getActiveSeatsForShowtime(showtimeId: number) {
      const rows = await getDb()
        .select({
          seatCode: bookingSeats.seatCode,
          bookingStatus: bookings.status,
          userId: bookings.userId,
          heldExpiresAt: bookings.heldExpiresAt,
        })
        .from(bookingSeats)
        .innerJoin(bookings, eq(bookingSeats.bookingId, bookings.id))
        .where(
          and(
            eq(bookingSeats.showtimeId, showtimeId),
            eq(bookingSeats.isActive, true),
          ),
        );

      return rows;
    },

    async findBookingByCode(bookingCode: string) {
      const db = getDb();
      const bookingRows = await db
        .select({
          booking: bookings,
          showtime: showtimes,
          studio: studios,
          movie: movies,
        })
        .from(bookings)
        .innerJoin(showtimes, eq(bookings.showtimeId, showtimes.id))
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .where(eq(bookings.bookingCode, bookingCode))
        .limit(1);

      if (!bookingRows[0]) return null;

      const { booking, showtime, studio, movie } = bookingRows[0];
      const seats = await db
        .select()
        .from(bookingSeats)
        .where(eq(bookingSeats.bookingId, booking.id));

      return { booking, seats, showtime, studio, movie };
    },

    async createHeldBooking(data) {
      const db = getDb();

      return await db.transaction(async (tx) => {
        // Double check conflicts inside transaction
        const existingActive = await tx
          .select({ seatCode: bookingSeats.seatCode })
          .from(bookingSeats)
          .where(
            and(
              eq(bookingSeats.showtimeId, data.showtimeId),
              eq(bookingSeats.isActive, true),
              inArray(bookingSeats.seatCode, data.seatCodes),
            ),
          );

        if (existingActive.length > 0) {
          const taken = existingActive.map((s) => s.seatCode);
          throw new AppError(
            409,
            'SEATS_UNAVAILABLE',
            `Kursi ${taken.join(', ')} baru saja diambil atau sedang diproses oleh pelanggan lain`,
          );
        }

        const totalSeats = data.seatCodes.length;
        const totalPrice = totalSeats * data.pricePerTicket;

        const insertedBooking = await tx
          .insert(bookings)
          .values({
            bookingCode: data.bookingCode,
            userId: data.userId,
            showtimeId: data.showtimeId,
            status: 'held',
            totalSeats,
            totalPrice,
            heldExpiresAt: data.heldExpiresAt,
          })
          .returning();

        const newBooking = insertedBooking[0]!;

        await tx.insert(bookingSeats).values(
          data.seatCodes.map((seatCode) => ({
            bookingId: newBooking.id,
            showtimeId: data.showtimeId,
            seatCode,
            price: data.pricePerTicket,
            isActive: true,
          })),
        );

        // Fetch showtime details
        const details = await tx
          .select({
            showtime: showtimes,
            studio: studios,
            movie: movies,
          })
          .from(showtimes)
          .innerJoin(studios, eq(showtimes.studioId, studios.id))
          .innerJoin(movies, eq(showtimes.movieId, movies.id))
          .where(eq(showtimes.id, data.showtimeId))
          .limit(1);

        const { showtime: st, studio: std, movie: mv } = details[0]!;
        const remainingSeconds = Math.max(
          0,
          Math.floor((data.heldExpiresAt.getTime() - Date.now()) / 1000),
        );

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
          heldExpiresAt: newBooking.heldExpiresAt ? newBooking.heldExpiresAt.toISOString() : null,
          remainingSeconds,
          showtime: {
            startTime: st.startTime.toISOString(),
            endTime: st.endTime.toISOString(),
            movieTitle: mv.title,
            posterUrl: buildTmdbImageUrl(mv.posterPath, 'w185'),
            studioName: std.name,
            studioType: std.type,
          },
        };
      });
    },

    async cancelHeldBooking(bookingId: number) {
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(bookings.id, bookingId));

        await tx
          .update(bookingSeats)
          .set({ isActive: false })
          .where(eq(bookingSeats.bookingId, bookingId));
      });
    },
  };
}

export function createBookingService(store: BookingStore = createDrizzleBookingStore()) {
  return {
    async getSeatMap(showtimeId: number, currentUserId?: number): Promise<SeatMapResponse> {
      // 1. Sweep expired held bookings
      await store.sweepExpiredHeld(showtimeId);

      // 2. Load showtime details
      const info = await store.getShowtimeWithStudioAndMovie(showtimeId);
      if (!info) {
        throw new AppError(404, 'SHOWTIME_NOT_FOUND', 'Jadwal tayang tidak ditemukan');
      }
      const { showtime: st, studio: std, movie: mv } = info;

      // 3. Load active seat assignments
      const activeSeats = await store.getActiveSeatsForShowtime(showtimeId);
      const activeSeatMap = new Map<string, typeof activeSeats[0]>();
      for (const s of activeSeats) {
        activeSeatMap.set(s.seatCode, s);
      }

      const disabledSet = new Set(std.disabledSeats.map((s) => s.trim().toUpperCase()));
      const now = Date.now();
      const allSlots: SeatSlot[] = [];

      for (let r = 0; r < std.rowsCount; r++) {
        const row = getRowLetter(r);
        for (let c = 1; c <= std.colsCount; c++) {
          const code = `${row}${c}`;
          let status: SeatStatus = 'available';

          if (disabledSet.has(code)) {
            status = 'disabled';
          } else {
            const assignment = activeSeatMap.get(code);
            if (assignment) {
              if (
                assignment.bookingStatus === 'booked' ||
                assignment.bookingStatus === 'paid' ||
                assignment.bookingStatus === 'redeemed'
              ) {
                status = 'occupied';
              } else if (assignment.bookingStatus === 'held') {
                if (assignment.heldExpiresAt && assignment.heldExpiresAt.getTime() > now) {
                  // If it's held by the current user, we can mark it as selected
                  if (currentUserId && assignment.userId === currentUserId) {
                    status = 'selected';
                  } else {
                    status = 'held';
                  }
                }
              }
            }
          }

          allSlots.push({
            code,
            row,
            col: c,
            status,
            price: st.price,
          });
        }
      }

      return {
        showtime: {
          id: st.id,
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          price: st.price,
          movie: {
            id: mv.id,
            tmdbId: mv.tmdbId,
            title: mv.title,
            posterUrl: buildTmdbImageUrl(mv.posterPath, 'w185'),
            runtimeMinutes: mv.runtimeMinutes,
          },
        },
        studio: {
          id: std.id,
          name: std.name,
          type: std.type,
          rowsCount: std.rowsCount,
          colsCount: std.colsCount,
          totalSeats: std.totalSeats,
        },
        seats: allSlots,
      };
    },

    async holdSeats(userId: number, input: HoldSeatsInput): Promise<BookingDetail> {
      // 1. Sweep expired held seats
      await store.sweepExpiredHeld(input.showtimeId);

      // 2. Validate showtime exists and has not started
      const info = await store.getShowtimeWithStudioAndMovie(input.showtimeId);
      if (!info) {
        throw new AppError(404, 'SHOWTIME_NOT_FOUND', 'Jadwal tayang tidak ditemukan');
      }
      if (info.showtime.startTime.getTime() <= Date.now()) {
        throw new AppError(400, 'SHOWTIME_STARTED', 'Penayangan film ini sudah dimulai');
      }

      // 3. Validate requested seat codes within studio bounds
      const { studio, showtime } = info;
      const disabledSet = new Set(studio.disabledSeats.map((s) => s.trim().toUpperCase()));
      for (const seat of input.seatCodes) {
        if (!isSeatWithinGrid(seat, studio.rowsCount, studio.colsCount)) {
          throw new AppError(400, 'INVALID_SEAT_CODE', `Kode kursi ${seat} berada di luar area studio`);
        }
        if (disabledSet.has(seat)) {
          throw new AppError(400, 'SEAT_DISABLED', `Kursi ${seat} tidak tersedia (lorong / rusak)`);
        }
      }

      // 4. Generate unique booking code
      const bookingCode = `CX-${randomBytes(4).toString('hex').toUpperCase()}`;
      const heldExpiresAt = new Date(Date.now() + HELD_TTL_MINUTES * 60 * 1000);

      return store.createHeldBooking({
        bookingCode,
        userId,
        showtimeId: showtime.id,
        seatCodes: input.seatCodes,
        pricePerTicket: showtime.price,
        heldExpiresAt,
      });
    },

    async cancelBooking(bookingCode: string, userId: number): Promise<{ cancelled: boolean }> {
      const data = await store.findBookingByCode(bookingCode);
      if (!data) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan');
      }
      if (data.booking.userId !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'Bukan pemilik pemesanan ini');
      }
      if (data.booking.status !== 'held' && data.booking.status !== 'booked') {
        throw new AppError(400, 'CANNOT_CANCEL', `Status ${data.booking.status} tidak dapat dibatalkan`);
      }

      await store.cancelHeldBooking(data.booking.id);
      return { cancelled: true };
    },

    async getBookingDetail(bookingCode: string, userId?: number): Promise<BookingDetail> {
      await store.sweepExpiredHeld();

      const data = await store.findBookingByCode(bookingCode);
      if (!data) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan');
      }
      if (userId && data.booking.userId && data.booking.userId !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'Bukan pemilik pemesanan ini');
      }

      const { booking, seats, showtime: st, studio: std, movie: mv } = data;
      const remainingSeconds = booking.heldExpiresAt
        ? Math.max(0, Math.floor((booking.heldExpiresAt.getTime() - Date.now()) / 1000))
        : 0;

      return {
        id: booking.id,
        bookingCode: booking.bookingCode,
        showtimeId: booking.showtimeId,
        userId: booking.userId,
        status: booking.status,
        totalSeats: booking.totalSeats,
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        seatCodes: seats.map((s) => s.seatCode),
        heldExpiresAt: booking.heldExpiresAt ? booking.heldExpiresAt.toISOString() : null,
        remainingSeconds,
        showtime: {
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          movieTitle: mv.title,
          posterUrl: buildTmdbImageUrl(mv.posterPath, 'w185'),
          studioName: std.name,
          studioType: std.type,
        },
      };
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;
