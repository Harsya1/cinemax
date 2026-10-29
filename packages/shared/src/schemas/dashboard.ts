import { z } from 'zod';
import { STUDIO_TYPES } from '../enums.js';

export const dashboardStudioStatusSchema = z.object({
  studioId: z.number().int().positive(),
  studioName: z.string(),
  studioType: z.enum(STUDIO_TYPES),
  activeShowtimesCount: z.number().int().nonnegative(),
  totalSeats: z.number().int().positive(),
  occupiedSeats: z.number().int().nonnegative(),
  occupancyPercent: z.number().nonnegative(),
});

export type DashboardStudioStatus = z.infer<typeof dashboardStudioStatusSchema>;

export const dashboardActivityItemSchema = z.object({
  id: z.number().int().positive(),
  action: z.string(),
  actorName: z.string().nullable(),
  description: z.string(),
  createdAt: z.string(),
});

export type DashboardActivityItem = z.infer<typeof dashboardActivityItemSchema>;

export const dashboardSummarySchema = z.object({
  todayRevenue: z.number().int().nonnegative(),
  todayTicketsSold: z.number().int().nonnegative(),
  todayCheckInCount: z.number().int().nonnegative(),
  occupancyRatePercent: z.number().nonnegative(),
  todayStudios: z.array(dashboardStudioStatusSchema),
  recentActivity: z.array(dashboardActivityItemSchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
