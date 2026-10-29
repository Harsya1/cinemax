export const USER_ROLES = [
  'admin',
  'manager',
  'cashier',
  'fnb_staff',
  'cleaner',
  'staff',
  'user',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES = [
  'admin',
  'manager',
  'cashier',
  'fnb_staff',
  'cleaner',
  'staff',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: UserRole): role is StaffRole {
  return role !== 'user';
}

export const STUDIO_TYPES = ['regular', '3d', 'premier'] as const;
export type StudioType = (typeof STUDIO_TYPES)[number];

export const BOOKING_STATUSES = [
  'held',
  'booked',
  'paid',
  'redeemed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'qris'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
