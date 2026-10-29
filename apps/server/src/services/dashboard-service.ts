import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { DashboardSummary } from '@cinemax/shared';
import { getDb } from '../db/index.js';
import {
  auditLogs,
  bookingSeats,
  bookings,
  showtimes,
  studios,
  users,
} from '../db/schema.js';

export interface DashboardStore {
  getTodaySummaryData(): Promise<{
    todayRevenue: number;
    todayTicketsSold: number;
    todayCheckInCount: number;
    studiosList: (typeof studios.$inferSelect)[];
    todayShowtimes: {
      showtimeId: number;
      studioId: number;
      occupiedSeats: number;
    }[];
    recentLogs: {
      id: number;
      action: string;
      actorName: string | null;
      description: string;
      createdAt: Date;
    }[];
  }>;
}

export function createDrizzleDashboardStore(): DashboardStore {
  return {
    async getTodaySummaryData() {
      const db = getDb();
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      // 1. Revenue & Tickets Sold today (status in 'paid', 'redeemed')
      const revenueRows = await db
        .select({
          totalRevenue: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)::int`,
          totalSeats: sql<number>`coalesce(sum(${bookings.totalSeats}), 0)::int`,
        })
        .from(bookings)
        .where(
          and(
            gte(bookings.paidAt, startOfDay),
            lte(bookings.paidAt, endOfDay),
            inArray(bookings.status, ['paid', 'redeemed']),
          ),
        );

      const todayRevenue = revenueRows[0]?.totalRevenue ?? 0;
      const todayTicketsSold = revenueRows[0]?.totalSeats ?? 0;

      // 2. Check-in count today
      const checkinRows = await db
        .select({
          totalCheckedIn: sql<number>`coalesce(sum(${bookings.totalSeats}), 0)::int`,
        })
        .from(bookings)
        .where(
          and(
            gte(bookings.redeemedAt, startOfDay),
            lte(bookings.redeemedAt, endOfDay),
            eq(bookings.status, 'redeemed'),
          ),
        );

      const todayCheckInCount = checkinRows[0]?.totalCheckedIn ?? 0;

      // 3. Studios list
      const studiosList = await db.select().from(studios).orderBy(studios.id);

      // 4. Today showtimes and occupied seats
      const showtimeRows = await db
        .select({
          id: showtimes.id,
          studioId: showtimes.studioId,
        })
        .from(showtimes)
        .where(
          and(
            gte(showtimes.startTime, startOfDay),
            lte(showtimes.startTime, endOfDay),
          ),
        );

      let todayShowtimes: { showtimeId: number; studioId: number; occupiedSeats: number }[] = [];
      if (showtimeRows.length > 0) {
        const ids = showtimeRows.map((r) => r.id);
        const occupiedCounts = await db
          .select({
            showtimeId: bookingSeats.showtimeId,
            count: sql<number>`count(*)::int`,
          })
          .from(bookingSeats)
          .where(
            and(
              inArray(bookingSeats.showtimeId, ids),
              eq(bookingSeats.isActive, true),
            ),
          )
          .groupBy(bookingSeats.showtimeId);

        const countMap = new Map<number, number>();
        for (const oc of occupiedCounts) {
          countMap.set(oc.showtimeId, oc.count);
        }

        todayShowtimes = showtimeRows.map((st) => ({
          showtimeId: st.id,
          studioId: st.studioId,
          occupiedSeats: countMap.get(st.id) ?? 0,
        }));
      }

      // 5. Recent 8 activity logs
      const logRows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          actorName: users.name,
          description: auditLogs.description,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorId, users.id))
        .orderBy(desc(auditLogs.id))
        .limit(8);

      return {
        todayRevenue,
        todayTicketsSold,
        todayCheckInCount,
        studiosList,
        todayShowtimes,
        recentLogs: logRows,
      };
    },
  };
}

export function createDashboardService(store: DashboardStore = createDrizzleDashboardStore()) {
  return {
    async getSummary(): Promise<DashboardSummary> {
      const data = await store.getTodaySummaryData();

      // Aggregate studio metrics
      let totalCapacityToday = 0;
      let totalOccupiedToday = 0;

      const todayStudios = data.studiosList.map((std) => {
        const stdShowtimes = data.todayShowtimes.filter((st) => st.studioId === std.id);
        const activeShowtimesCount = stdShowtimes.length;
        const totalCapacity = activeShowtimesCount * std.totalSeats;
        const occupiedSeats = stdShowtimes.reduce((acc, curr) => acc + curr.occupiedSeats, 0);

        totalCapacityToday += totalCapacity;
        totalOccupiedToday += occupiedSeats;

        const occupancyPercent =
          totalCapacity > 0 ? Math.round((occupiedSeats / totalCapacity) * 1000) / 10 : 0;

        return {
          studioId: std.id,
          studioName: std.name,
          studioType: std.type,
          activeShowtimesCount,
          totalSeats: std.totalSeats,
          occupiedSeats,
          occupancyPercent,
        };
      });

      const occupancyRatePercent =
        totalCapacityToday > 0
          ? Math.round((totalOccupiedToday / totalCapacityToday) * 1000) / 10
          : 0;

      return {
        todayRevenue: data.todayRevenue,
        todayTicketsSold: data.todayTicketsSold,
        todayCheckInCount: data.todayCheckInCount,
        occupancyRatePercent,
        todayStudios,
        recentActivity: data.recentLogs.map((log) => ({
          id: log.id,
          action: log.action,
          actorName: log.actorName ?? 'System',
          description: log.description,
          createdAt: log.createdAt.toISOString(),
        })),
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
