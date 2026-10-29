import type { StudioType, UserRole } from '@cinemax/shared';
import { closeDb, getDb } from './index.js';
import { studios, users } from './schema.js';
import { hashPassword } from '../lib/crypto.js';

const DEFAULT_ACCOUNTS: Array<{
  name: string;
  email: string;
  role: UserRole;
  points: number;
}> = [
  { name: 'Super Admin', email: 'admin@cinemax.local', role: 'admin', points: 0 },
  { name: 'Cinema Manager', email: 'manager@cinemax.local', role: 'manager', points: 0 },
  { name: 'Ticket Cashier', email: 'cashier@cinemax.local', role: 'cashier', points: 0 },
  { name: 'FnB Counter Staff', email: 'fnb@cinemax.local', role: 'fnb_staff', points: 0 },
  { name: 'Studio Cleaner', email: 'cleaner@cinemax.local', role: 'cleaner', points: 0 },
  { name: 'General Staff', email: 'staff@cinemax.local', role: 'staff', points: 0 },
  { name: 'Demo Customer', email: 'user@cinemax.local', role: 'user', points: 250 },
];

async function runSeed() {
  const db = getDb();
  const defaultHash = await hashPassword('Cinemax123!');

  const inserted = await db
    .insert(users)
    .values(
      DEFAULT_ACCOUNTS.map((acc) => ({
        name: acc.name,
        email: acc.email,
        passwordHash: defaultHash,
        role: acc.role,
        points: acc.points,
        isActive: true,
      })),
    )
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  console.info(
    `[CINEMAX SEED] Done. Newly inserted: ${inserted.length}/${DEFAULT_ACCOUNTS.length} default accounts.`,
  );

  const DEFAULT_STUDIOS: Array<{
    name: string;
    type: StudioType;
    rowsCount: number;
    colsCount: number;
    disabledSeats: string[];
    totalSeats: number;
    basePrice: number;
  }> = [
    {
      name: 'Studio 1 Regular',
      type: 'regular',
      rowsCount: 8,
      colsCount: 12,
      disabledSeats: ['A6', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6'],
      totalSeats: 88,
      basePrice: 50000,
    },
    {
      name: 'Studio 2 3D',
      type: '3d',
      rowsCount: 8,
      colsCount: 10,
      disabledSeats: [],
      totalSeats: 80,
      basePrice: 65000,
    },
    {
      name: 'Studio 3 Premier Velvet',
      type: 'premier',
      rowsCount: 5,
      colsCount: 8,
      disabledSeats: ['A4', 'B4', 'C4', 'D4', 'E4'],
      totalSeats: 35,
      basePrice: 100000,
    },
  ];

  const insertedStudios = await db
    .insert(studios)
    .values(DEFAULT_STUDIOS)
    .onConflictDoNothing({ target: studios.name })
    .returning({ id: studios.id });

  console.info(
    `[CINEMAX SEED] Studios. Newly inserted: ${insertedStudios.length}/${DEFAULT_STUDIOS.length} studios.`,
  );

  await closeDb();
}

runSeed().catch(async (err) => {
  console.error('[CINEMAX SEED ERROR]', err instanceof Error ? err.message : 'Seed failed');
  await closeDb();
  process.exit(1);
});
