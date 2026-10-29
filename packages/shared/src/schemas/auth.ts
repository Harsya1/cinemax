import { z } from 'zod';
import { USER_ROLES } from '../enums.js';

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  role: z.enum(USER_ROLES),
  points: z.number().int().nonnegative(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const registerInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120),
    email: z.string().trim().toLowerCase().email('Format email tidak valid').max(255),
    phoneNumber: z
      .string()
      .trim()
      .max(25)
      .optional()
      .transform((val) => (val && val.length > 0 ? val : null)),
    password: z.string().min(8, 'Password minimal 8 karakter').max(128),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'Konfirmasi password tidak cocok',
    path: ['passwordConfirmation'],
  });

export type RegisterInput = z.input<typeof registerInputSchema>;
export type ParsedRegisterInput = z.output<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
