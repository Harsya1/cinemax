import { randomBytes } from 'node:crypto';
import { and, desc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  buildTmdbImageUrl,
  calculatePointsEarned,
  isSeatWithinGrid,
  type PosCheckoutInput,
  type PosCheckoutResult,
  type PosTicketStub,
  type PosTodayShowtime,
} from '@cinemax/shared';
import { getDb } from '../db/index.js';
import {
  auditLogs,
  bookingSeats,
  bookings,
  movies,
  showtimes,
  studios,
  users,
} from '../db/schema.js';
import { AppError } from '../lib/http-error.js';

export interface TicketPosStore {
  getTodayShowtimes(): Promise<
    Array<{
      showtime: typeof showtimes.$inferSelect;
      studio: typeof studios.$inferSelect;
      movie: typeof movies.$inferSelect;
      occupiedCount: number;
    }>
  >;
  getShowtimeDetails(showtimeId: number): Promise<{
    showtime: typeof showtimes.$inferSelect;
    studio: typeof studios.$inferSelect;
    movie: typeof movies.$inferSelect;
  } | null>;
  findMemberByEmail(email: string): Promise<typeof users.$inferSelect | null>;
  getCashierUser(cashierId: number): Promise<typeof users.$inferSelect | null>;
  createPosTransaction(data: {
    bookingCode: string;
    userId: number | null;
    cashierId: number;
    showtimeId: number;
    seatCodes: string[];
    pricePerTicket: number;
    totalPrice: number;
    paymentMethod: 'cash' | 'qris';
    paidAt: Date;
    pointsEarned: number;
  }): Promise<void>;
  recordAudit(entry: {
    actorId: number | null;
    action: string;
    targetType: string;
    targetId: string | null;
    description: string;
  }): Promise<void>;
  getBookingForStub(bookingCode: string): Promise<{
    booking: typeof bookings.$inferSelect;
    showtime: typeof showtimes.$inferSelect;
    studio: typeof studios.$inferSelect;
    movie: typeof movies.$inferSelect;
    seats: (typeof bookingSeats.$inferSelect)[];
    cashier: typeof users.$inferSelect | null;
  } | null>;
}

export function createDrizzleTicketPosStore(): TicketPosStore {
  return {
    async getTodayShowtimes() {
      const db = getDb();
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const rows = await db
        .select({
          showtime: showtimes,
          studio: studios,
          movie: movies,
        })
        .from(showtimes)
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .where(
          and(
            gte(showtimes.startTime, startOfDay),
            lte(showtimes.startTime, endOfDay),
            gt(showtimes.endTime, now),
          ),
        )
        .orderBy(showtimes.startTime);

      if (rows.length === 0) return [];
      const showtimeIds = rows.map((r) => r.showtime.id);

      const activeSeats = await db
        .select({
          showtimeId: bookingSeats.showtimeId,
          count: sql<number>`count(*)::int`,
        })
        .from(bookingSeats)
        .where(
          and(
            inArray(bookingSeats.showtimeId, showtimeIds),
            eq(bookingSeats.isActive, true),
          ),
        )
        .groupBy(bookingSeats.showtimeId);

      const occupiedMap = new Map<number, number>();
      for (const s of activeSeats) {
        occupiedMap.set(s.showtimeId, s.count);
      }

      return rows.map((r) => ({
        ...r,
        occupiedCount: occupiedMap.get(r.showtime.id) ?? 0,
      }));
    },

    async getShowtimeDetails(showtimeId) {
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

    async findMemberByEmail(email) {
      const rows = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
      return rows[0] ?? null;
    },

    async getCashierUser(cashierId) {
      const rows = await getDb().select().from(users).where(eq(users.id, cashierId)).limit(1);
      return rows[0] ?? null;
    },

    async createPosTransaction(data) {
      const db = getDb();
      await db.transaction(async (tx) => {
        // Double check active conflict
        const existing = await tx
          .select({ seatCode: bookingSeats.seatCode })
          .from(bookingSeats)
          .where(
            and(
              eq(bookingSeats.showtimeId, data.showtimeId),
              eq(bookingSeats.isActive, true),
              inArray(bookingSeats.seatCode, data.seatCodes),
            ),
          );

        if (existing.length > 0) {
          const taken = existing.map((s) => s.seatCode);
          throw new AppError(
            409,
            'SEATS_UNAVAILABLE',
            `Kursi ${taken.join(', ')} sudah terisi atau sedang diproses`,
          );
        }

        const inserted = await tx
          .insert(bookings)
          .values({
            bookingCode: data.bookingCode,
            userId: data.userId,
            cashierId: data.cashierId,
            showtimeId: data.showtimeId,
            status: 'paid',
            totalSeats: data.seatCodes.length,
            totalPrice: data.totalPrice,
            paymentMethod: data.paymentMethod,
            paidAt: data.paidAt,
          })
          .returning();

        const booking = inserted[0]!;

        await tx.insert(bookingSeats).values(
          data.seatCodes.map((seatCode) => ({
            bookingId: booking.id,
            showtimeId: data.showtimeId,
            seatCode,
            price: data.pricePerTicket,
            isActive: true,
          })),
        );

        if (data.userId && data.pointsEarned > 0) {
          await tx
            .update(users)
            .set({
              points: sql`${users.points} + ${data.pointsEarned}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, data.userId));
        }
      });
    },

    async recordAudit(entry) {
      await getDb().insert(auditLogs).values(entry);
    },

    async getBookingForStub(bookingCode) {
      const db = getDb();
      const rows = await db
        .select({
          booking: bookings,
          showtime: showtimes,
          studio: studios,
          movie: movies,
          cashier: users,
        })
        .from(bookings)
        .innerJoin(showtimes, eq(bookings.showtimeId, showtimes.id))
        .innerJoin(studios, eq(showtimes.studioId, studios.id))
        .innerJoin(movies, eq(showtimes.movieId, movies.id))
        .leftJoin(users, eq(bookings.cashierId, users.id))
        .where(eq(bookings.bookingCode, bookingCode))
        .limit(1);

      if (!rows[0]) return null;

      const { booking, showtime, studio, movie, cashier } = rows[0];
      const seats = await db
        .select()
        .from(bookingSeats)
        .where(eq(bookingSeats.bookingId, booking.id));

      return { booking, showtime, studio, movie, seats, cashier };
    },
  };
}

export function createTicketPosService(store: TicketPosStore = createDrizzleTicketPosStore()) {
  return {
    async getTodayShowtimes(): Promise<PosTodayShowtime[]> {
      const rows = await store.getTodayShowtimes();
      return rows.map(({ showtime: st, studio: std, movie: mv, occupiedCount }) => {
        const available = Math.max(0, std.totalSeats - occupiedCount);
        return {
          id: st.id,
          movieId: mv.id,
          movieTitle: mv.title,
          posterUrl: buildTmdbImageUrl(mv.posterPath, 'w185'),
          runtimeMinutes: mv.runtimeMinutes,
          studioId: std.id,
          studioName: std.name,
          studioType: std.type,
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          price: st.price,
          totalSeats: std.totalSeats,
          availableSeatsCount: available,
        };
      });
    },

    async checkout(cashierId: number, input: PosCheckoutInput): Promise<PosCheckoutResult> {
      const cashier = await store.getCashierUser(cashierId);
      if (!cashier) {
        throw new AppError(404, 'CASHIER_NOT_FOUND', 'Data kasir tidak ditemukan');
      }

      const info = await store.getShowtimeDetails(input.showtimeId);
      if (!info) {
        throw new AppError(404, 'SHOWTIME_NOT_FOUND', 'Jadwal tayang tidak ditemukan');
      }

      const { showtime: st, studio: std, movie: mv } = info;
      if (st.endTime.getTime() <= Date.now()) {
        throw new AppError(400, 'SHOWTIME_ENDED', 'Penayangan jadwal ini sudah selesai');
      }

      // Check seat boundaries
      const disabledSet = new Set(std.disabledSeats.map((s) => s.trim().toUpperCase()));
      for (const seat of input.seatCodes) {
        if (!isSeatWithinGrid(seat, std.rowsCount, std.colsCount)) {
          throw new AppError(400, 'INVALID_SEAT_CODE', `Kursi ${seat} di luar kapasitas studio`);
        }
        if (disabledSet.has(seat)) {
          throw new AppError(400, 'SEAT_DISABLED', `Kursi ${seat} tidak dapat dipilih (lorong/rusak)`);
        }
      }

      const totalPrice = input.seatCodes.length * st.price;
      let amountPaid = totalPrice;
      let change = 0;

      if (input.paymentMethod === 'cash') {
        amountPaid = input.amountPaid ?? totalPrice;
        if (amountPaid < totalPrice) {
          throw new AppError(
            400,
            'INSUFFICIENT_PAYMENT',
            `Uang pembayaran kurang. Total: Rp ${totalPrice.toLocaleString('id-ID')}, Diterima: Rp ${amountPaid.toLocaleString('id-ID')}`,
          );
        }
        change = amountPaid - totalPrice;
      }

      // Check member for points
      let memberUser = null;
      let pointsEarned = 0;
      if (input.memberEmail && input.memberEmail.trim()) {
        memberUser = await store.findMemberByEmail(input.memberEmail.trim().toLowerCase());
        if (memberUser) {
          pointsEarned = calculatePointsEarned(std.type, input.seatCodes.length);
        }
      }

      const bookingCode = `CX-${randomBytes(4).toString('hex').toUpperCase()}`;
      const paidAt = new Date();

      await store.createPosTransaction({
        bookingCode,
        userId: memberUser?.id ?? null,
        cashierId,
        showtimeId: st.id,
        seatCodes: input.seatCodes,
        pricePerTicket: st.price,
        totalPrice,
        paymentMethod: input.paymentMethod,
        paidAt,
        pointsEarned,
      });

      await store.recordAudit({
        actorId: cashierId,
        action: 'TICKET_POS_CHECKOUT',
        targetType: 'booking',
        targetId: bookingCode,
        description: `Kasir (${cashier.name}) memproses walk-in tiket ${bookingCode}: ${input.seatCodes.length} kursi di ${std.name} (${input.paymentMethod.toUpperCase()}: Rp ${totalPrice.toLocaleString('id-ID')})`,
      });

      const sDate = new Date(st.startTime);
      const stub: PosTicketStub = {
        bookingCode,
        movieTitle: mv.title,
        studioName: std.name,
        studioType: std.type,
        dateFormatted: sDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        timeFormatted: `${sDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
        seatCodes: input.seatCodes,
        totalSeats: input.seatCodes.length,
        totalPrice,
        paymentMethod: input.paymentMethod.toUpperCase(),
        cashierName: cashier.name,
        paidAtFormatted: paidAt.toLocaleString('id-ID'),
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingCode)}`,
      };

      return {
        bookingCode,
        totalPrice,
        amountPaid,
        change,
        seatCodes: input.seatCodes,
        pointsEarned,
        stub,
      };
    },

    async getTicketStub(bookingCode: string): Promise<PosTicketStub> {
      const data = await store.getBookingForStub(bookingCode);
      if (!data) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Data tiket kasir tidak ditemukan');
      }

      const { booking: b, showtime: st, studio: std, movie: mv, seats, cashier } = data;
      const sDate = new Date(st.startTime);

      return {
        bookingCode: b.bookingCode,
        movieTitle: mv.title,
        studioName: std.name,
        studioType: std.type,
        dateFormatted: sDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        timeFormatted: `${sDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
        seatCodes: seats.map((s) => s.seatCode),
        totalSeats: b.totalSeats,
        totalPrice: b.totalPrice,
        paymentMethod: (b.paymentMethod || 'CASH').toUpperCase(),
        cashierName: cashier?.name || 'Kasir Bioskop',
        paidAtFormatted: b.paidAt ? new Date(b.paidAt).toLocaleString('id-ID') : 'N/A',
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(b.bookingCode)}`,
      };
    },
  };
}

export type TicketPosService = ReturnType<typeof createTicketPosService>;
