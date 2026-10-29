import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  buildTmdbImageUrl,
  calculatePointsEarned,
  type CustomerBookingSummary,
  type ParsedCustomerProfileUpdateInput,
  type PaymentProcessInput,
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
import { hashPassword, verifyPassword } from '../lib/crypto.js';

export interface PaymentStore {
  findBookingByCode(bookingCode: string): Promise<{
    booking: typeof bookings.$inferSelect;
    showtime: typeof showtimes.$inferSelect;
    studio: typeof studios.$inferSelect;
    movie: typeof movies.$inferSelect;
    seats: (typeof bookingSeats.$inferSelect)[];
  } | null>;
  markBookingAsPaid(data: {
    bookingId: number;
    paymentMethod: 'cash' | 'qris';
    paidAt: Date;
    userId: number | null;
    pointsToAdd: number;
  }): Promise<void>;
  recordAudit(entry: {
    actorId: number | null;
    action: string;
    targetType: string;
    targetId: string | null;
    description: string;
  }): Promise<void>;
  getUserBookings(userId: number): Promise<CustomerBookingSummary[]>;
  getUserById(userId: number): Promise<typeof users.$inferSelect | null>;
  updateUser(
    userId: number,
    data: { name?: string; phoneNumber?: string | null; passwordHash?: string },
  ): Promise<typeof users.$inferSelect>;
}

export function createDrizzlePaymentStore(): PaymentStore {
  return {
    async findBookingByCode(bookingCode: string) {
      const db = getDb();
      const rows = await db
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

      if (!rows[0]) return null;

      const { booking, showtime, studio, movie } = rows[0];
      const seats = await db
        .select()
        .from(bookingSeats)
        .where(eq(bookingSeats.bookingId, booking.id));

      return { booking, showtime, studio, movie, seats };
    },

    async markBookingAsPaid(data) {
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({
            status: 'paid',
            paymentMethod: data.paymentMethod,
            paidAt: data.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, data.bookingId));

        if (data.userId && data.pointsToAdd > 0) {
          await tx
            .update(users)
            .set({
              points: sql`${users.points} + ${data.pointsToAdd}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, data.userId));
        }
      });
    },

    async recordAudit(entry) {
      await getDb().insert(auditLogs).values(entry);
    },

    async getUserBookings(userId: number) {
      const db = getDb();
      const rows = await db
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
        .where(eq(bookings.userId, userId))
        .orderBy(desc(bookings.createdAt));

      if (rows.length === 0) return [];

      const bookingIds = rows.map((r) => r.booking.id);
      const seats = await db
        .select()
        .from(bookingSeats)
        .where(inArray(bookingSeats.bookingId, bookingIds));

      const seatMap = new Map<number, string[]>();
      for (const s of seats) {
        const arr = seatMap.get(s.bookingId) ?? [];
        arr.push(s.seatCode);
        seatMap.set(s.bookingId, arr);
      }

      return rows.map(({ booking: b, showtime: st, studio: std, movie: mv }) => ({
        id: b.id,
        bookingCode: b.bookingCode,
        status: b.status,
        totalSeats: b.totalSeats,
        totalPrice: b.totalPrice,
        paymentMethod: b.paymentMethod,
        seatCodes: seatMap.get(b.id) ?? [],
        paidAt: b.paidAt ? b.paidAt.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
        showtime: {
          id: st.id,
          startTime: st.startTime.toISOString(),
          endTime: st.endTime.toISOString(),
          price: st.price,
          movieTitle: mv.title,
          posterUrl: buildTmdbImageUrl(mv.posterPath, 'w185'),
          studioName: std.name,
          studioType: std.type,
        },
      }));
    },

    async getUserById(userId) {
      const rows = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
      return rows[0] ?? null;
    },

    async updateUser(userId, data) {
      const rows = await getDb()
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return rows[0]!;
    },
  };
}

export function createPaymentService(store: PaymentStore = createDrizzlePaymentStore()) {
  return {
    async processPayment(
      userId: number,
      input: PaymentProcessInput,
    ): Promise<{
      bookingCode: string;
      status: string;
      pointsEarned: number;
      totalPrice: number;
    }> {
      const data = await store.findBookingByCode(input.bookingCode);
      if (!data) {
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan');
      }

      const { booking, studio, movie } = data;

      if (booking.userId && booking.userId !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'Bukan pemilik pemesanan ini');
      }

      if (booking.status === 'paid') {
        const points = calculatePointsEarned(studio.type, booking.totalSeats);
        return {
          bookingCode: booking.bookingCode,
          status: 'paid',
          pointsEarned: points,
          totalPrice: booking.totalPrice,
        };
      }

      if (
        booking.status !== 'held' ||
        (booking.heldExpiresAt && booking.heldExpiresAt.getTime() < Date.now())
      ) {
        throw new AppError(
          400,
          'BOOKING_NOT_PAYABLE',
          'Waktu pembayaran pemesanan ini telah kedaluwarsa atau status tidak valid',
        );
      }

      const pointsEarned = calculatePointsEarned(studio.type, booking.totalSeats);
      const paidAt = new Date();

      await store.markBookingAsPaid({
        bookingId: booking.id,
        paymentMethod: input.paymentMethod,
        paidAt,
        userId: booking.userId,
        pointsToAdd: pointsEarned,
      });

      await store.recordAudit({
        actorId: userId,
        action: 'PAYMENT_PROCESSED',
        targetType: 'booking',
        targetId: String(booking.id),
        description: `Pembayaran tiket ${booking.bookingCode} berhasil (${input.paymentMethod.toUpperCase()}: Rp ${booking.totalPrice.toLocaleString('id-ID')}, +${pointsEarned} poin)`,
      });

      return {
        bookingCode: booking.bookingCode,
        status: 'paid',
        pointsEarned,
        totalPrice: booking.totalPrice,
      };
    },

    async getCustomerTickets(userId: number): Promise<{
      activeTickets: CustomerBookingSummary[];
      pastTickets: CustomerBookingSummary[];
    }> {
      const all = await store.getUserBookings(userId);
      const now = Date.now();

      const activeTickets = all.filter(
        (t) =>
          t.status === 'paid' && new Date(t.showtime.endTime).getTime() > now,
      );

      const pastTickets = all.filter(
        (t) =>
          t.status !== 'held' &&
          (t.status !== 'paid' || new Date(t.showtime.endTime).getTime() <= now),
      );

      return { activeTickets, pastTickets };
    },

    async updateProfile(userId: number, input: ParsedCustomerProfileUpdateInput) {
      const user = await store.getUserById(userId);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User tidak ditemukan');
      }

      let passwordHash: string | undefined = undefined;
      if (input.newPassword) {
        if (!input.currentPassword) {
          throw new AppError(400, 'PASSWORD_REQUIRED', 'Password lama wajib diisi untuk mengganti password');
        }
        const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new AppError(400, 'INVALID_PASSWORD', 'Password saat ini salah');
        }
        passwordHash = await hashPassword(input.newPassword);
      }

      const updated = await store.updateUser(userId, {
        name: input.name,
        phoneNumber: input.phoneNumber,
        passwordHash,
      });

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phoneNumber: updated.phoneNumber,
        role: updated.role,
        points: updated.points,
      };
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
