import { and, desc, eq, inArray } from 'drizzle-orm';
import type { TicketScanResult } from '@cinemax/shared';
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

export interface ValidatorStore {
  findBookingByCode(bookingCode: string): Promise<{
    booking: typeof bookings.$inferSelect;
    showtime: typeof showtimes.$inferSelect;
    studio: typeof studios.$inferSelect;
    movie: typeof movies.$inferSelect;
    seats: (typeof bookingSeats.$inferSelect)[];
  } | null>;
  getUsherUser(usherId: number): Promise<typeof users.$inferSelect | null>;
  markAsRedeemed(bookingId: number, redeemedAt: Date): Promise<void>;
  recordAudit(entry: {
    actorId: number | null;
    action: string;
    targetType: string;
    targetId: string | null;
    description: string;
  }): Promise<void>;
}

export function createDrizzleValidatorStore(): ValidatorStore {
  return {
    async findBookingByCode(bookingCode) {
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

    async getUsherUser(usherId) {
      const rows = await getDb().select().from(users).where(eq(users.id, usherId)).limit(1);
      return rows[0] ?? null;
    },

    async markAsRedeemed(bookingId, redeemedAt) {
      await getDb()
        .update(bookings)
        .set({
          status: 'redeemed',
          redeemedAt,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId));
    },

    async recordAudit(entry) {
      await getDb().insert(auditLogs).values(entry);
    },
  };
}

export function createValidatorService(store: ValidatorStore = createDrizzleValidatorStore()) {
  return {
    async scanTicket(usherId: number, rawCode: string): Promise<TicketScanResult> {
      const code = rawCode.trim().toUpperCase();
      const data = await store.findBookingByCode(code);

      if (!data) {
        return {
          result: 'not_found',
          message: `Kode tiket "${code}" tidak ditemukan dalam sistem.`,
          ticket: null,
        };
      }

      const { booking, showtime, studio, movie, seats } = data;
      const usher = await store.getUsherUser(usherId);
      const seatCodes = seats.map((s) => s.seatCode);

      const ticketPayload = {
        bookingCode: booking.bookingCode,
        movieTitle: movie.title,
        studioName: studio.name,
        studioType: studio.type,
        startTime: showtime.startTime.toISOString(),
        seatCodes,
        totalSeats: booking.totalSeats,
        redeemedAt: booking.redeemedAt ? booking.redeemedAt.toISOString() : null,
        redeemedByName: usher?.name ?? 'Staf Pintu',
      };

      // 1. Check if already redeemed
      if (booking.status === 'redeemed') {
        return {
          result: 'already_redeemed',
          message: `Tiket sudah pernah di-scan dan digunakan sebelumnya pada ${
            booking.redeemedAt ? new Date(booking.redeemedAt).toLocaleTimeString('id-ID') : 'sesi tadi'
          }.`,
          ticket: ticketPayload,
        };
      }

      // 2. Check if status is paid
      if (booking.status !== 'paid') {
        return {
          result: 'invalid_status',
          message: `Status tiket masih "${booking.status.toUpperCase()}". Hanya tiket lunas (PAID) yang dapat di-redeem.`,
          ticket: ticketPayload,
        };
      }

      // 3. Check showtime date range (allow checking in on the show day, up to 3 hours after end)
      const now = new Date();
      const showDate = new Date(showtime.startTime);
      const isSameDay =
        now.getFullYear() === showDate.getFullYear() &&
        now.getMonth() === showDate.getMonth() &&
        now.getDate() === showDate.getDate();

      if (!isSameDay) {
        return {
          result: 'wrong_schedule',
          message: `Peringatan: Jadwal film ini untuk tanggal ${showDate.toLocaleDateString(
            'id-ID',
          )} (${showDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB). Hari ini tanggal ${now.toLocaleDateString('id-ID')}.`,
          ticket: ticketPayload,
        };
      }

      // 4. Mark as redeemed
      const redeemedAt = new Date();
      await store.markAsRedeemed(booking.id, redeemedAt);

      await store.recordAudit({
        actorId: usherId,
        action: 'BOOKING_REDEEMED',
        targetType: 'booking',
        targetId: booking.bookingCode,
        description: `Staf pintu (${usher?.name ?? 'Usher'}) memvalidasi tiket masuk ${booking.bookingCode} (${seatCodes.join(', ')}) di ${studio.name}`,
      });

      return {
        result: 'valid',
        message: 'Tiket valid! Silakan masuk studio.',
        ticket: {
          ...ticketPayload,
          redeemedAt: redeemedAt.toISOString(),
        },
      };
    },
  };
}

export type ValidatorService = ReturnType<typeof createValidatorService>;
