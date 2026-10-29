# CINEMAX — Plan 03 Generic Admin Framework, User Management, & Audit Logs Design Spec

Tanggal: 2026-10-29
Ketergantungan: Plan 01 & Plan 02 (Auth Session + RBAC 7 Role)
Target: Pengganti ringan FilamentPHP di React (`DataTable` + `ResourceModalForm` native `<dialog>`), tabel & pencatat `audit_logs`, serta modul CRUD User & Audit Logs di Workspace Light (`admin` full CRUD, `manager` read-only).

---

## 1. Tujuan & Batasan Cakupan (YAGNI)

### Masuk Cakupan Plan 03
- Skema Drizzle tabel `audit_logs` beserta migrasi PostgreSQL (`0002`).
- Service pencatat audit terpusat (`auditService.record`) yang bebas kebocoran PII/password dan siap dipakai lintas modul pada Plan 04–10.
- Kontrak `@cinemax/shared` untuk paginasi (`PaginationMeta`), filter query, `adminCreateUserSchema`, `adminUpdateUserSchema`, `adminUserRowSchema`, dan `auditLogRowSchema`.
- Endpoint Backend `/api/v1/admin/users` (`GET`, `POST`, `PATCH /:id`, `DELETE /:id`) dan `GET /api/v1/admin/audit-logs` lengkap dengan pengaman:
  - `manager` hanya boleh membaca (`GET`); mutasi (`POST`/`PATCH`/`DELETE`) wajib `admin`.
  - Admin dilarang menghapus, menonaktifkan (`isActive = false`), atau menurunkan role akun dirinya sendiri (`SELF_LOCKOUT_FORBIDDEN` / `SELF_DELETE_FORBIDDEN`).
  - Menonaktifkan user (`isActive = false`) langsung mencabut seluruh sesi aktif user tersebut di tabel `sessions` tanpa menghapus rekam jejak historis.
- Komponen Admin Generik di `@cinemax/client` tanpa dependency eksternal baru:
  - `DataTable<T>`: pencarian, slot filter tambahan, tabel responsif `tabular-nums`, dan paginasi.
  - `ResourceModalForm`: berbasis elemen `<dialog>` native HTML5 dengan konfigurasi field deklaratif dan validasi Zod.
- Halaman `/admin/users` dan `/admin/audit-logs` di dalam `WorkspaceLayout` Light beraksen Burgundy + Gold, lengkap dengan visibilitas navigasi berbasis role.

### Di Luar Cakupan Plan 03 (Non-Goals)
- Bulk delete massal (berisiko tinggi untuk data operasional karyawan/pelanggan; penghapusan satu per satu dengan konfirmasi jauh lebih aman).
- Blokir hapus user berdasarkan histori `bookings` (tabel `bookings` baru dibuat di Plan 07; relasi FK `ON DELETE RESTRICT` / pengecekan histori booking akan otomatis terpasang saat tabel `bookings` hadir).

---

## 2. Skema Database Baru (`apps/server/src/db/schema.ts`)

### Tabel `audit_logs`
- `id`: `serial('id').primaryKey()`
- `actorId`: `integer('actor_id').references(() => users.id, { onDelete: 'set null' })` (nullable agar log tetap bertahan walau akun salah input dihapus)
- `action`: `varchar('action', { length: 80 }).notNull()` (contoh: `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_ACTIVATED`, `USER_DELETED`)
- `targetType`: `varchar('target_type', { length: 50 }).notNull()` (contoh: `'user'`, `'studio'`, `'showtime'`, `'booking'`)
- `targetId`: `varchar('target_id', { length: 50 })` nullable
- `description`: `text('description').notNull()`
- `createdAt`: `timestamp('created_at', { withTimezone: true }).notNull().defaultNow()`
- Index pada `createdAt` dan `action` untuk pembacaan log terbaru secara cepat.

---

## 3. Desain Service & Endpoint Backend (`/api/v1/admin/*`)

### 3.1 `GET /api/v1/admin/users` — Role: `admin`, `manager`
- Query params: `page` (default `1`), `limit` (default `10`, maks `50`), `search` (ILIKE pada `name` atau `email`), `role` (opsional salah satu `UserRole`), `staffOnly` (`'true'` memfilter `role != 'user'`).
- Respons: `{ data: AdminUserRow[], meta: { page, limit, total, totalPages } }` tanpa `passwordHash`.

### 3.2 `POST /api/v1/admin/users` — Role: `admin`
- Validasi `adminCreateUserSchema` (`name`, `email`, `phoneNumber?`, `role`, `points` default `0`, `isActive` default `true`, `password` min 8 karakter).
- Tolak `409 EMAIL_TAKEN` bila email sudah dipakai.
- Simpan user + catat `USER_CREATED` ke `audit_logs` -> `201 { data: AdminUserRow }`.

### 3.3 `PATCH /api/v1/admin/users/:id` — Role: `admin`
- Validasi `adminUpdateUserSchema` (field opsional; jika `password` diisi min 8 karakter maka di-hash ulang, jika kosong/`undefined` password lama dipertahankan).
- Pengaman diri sendiri: bila `targetId === req.authUser.id` dan (`input.isActive === false` atau (`input.role && input.role !== 'admin'`)), tolak `400 SELF_LOCKOUT_FORBIDDEN`.
- Bila `input.isActive === false`, hapus seluruh baris `sessions` milik `targetId` dalam transaksi/operasi yang sama.
- Catat `USER_DEACTIVATED` / `USER_ACTIVATED` / `USER_UPDATED` ke `audit_logs` -> `200 { data: AdminUserRow }`.

### 3.4 `DELETE /api/v1/admin/users/:id` — Role: `admin`
- Bila `targetId === req.authUser.id`, tolak `400 SELF_DELETE_FORBIDDEN`.
- Hapus baris user, catat `USER_DELETED` ke `audit_logs` -> `200 { data: { deletedId } }`.

### 3.5 `GET /api/v1/admin/audit-logs` — Role: `admin`, `manager`
- Query params: `page` (default `1`), `limit` (default `15`, maks `50`), `search` (ILIKE pada `description` atau `action`), `action` (filter eksak opsional).
- Left join ke `users` untuk mengembalikan `{ id, action, targetType, targetId, description, createdAt, actor: { id, name, email, role } | null }`.

---

## 4. Desain Komponen Generik Frontend (`@cinemax/client`)

1. **`DataTable<T>` (`src/components/admin/DataTable.tsx`):**
   - Props: `title`, `subtitle?`, `columns` (`{ key, header, className?, render: (row: T) => ReactNode }`), `rows`, `rowKey`, `isLoading`, `searchPlaceholder?`, `searchValue`, `onSearchChange`, `filterSlot?`, `primaryAction?` (`{ label, onClick }`), `page`, `totalPages`, `totalItems`, `onPageChange`.
   - Seluruh sel numerik/waktu mendukung `tabular-nums`, permukaan putih bersih di atas `WorkspaceLayout`.

2. **`ResourceModalForm` (`src/components/admin/ResourceModalForm.tsx`):**
   - Menggunakan `<dialog ref={dialogRef}>` native (`showModal()` / `close()`), mendukung tombol `Esc` bawaan browser tanpa fokus bocor.
   - Props: `open`, `title`, `description?`, `fields` (`FieldConfig[]`: `name`, `label`, `type` [`text` | `email` | `password` | `select` | `number` | `checkbox`], `placeholder?`, `required?`, `options?`, `disabled?`, `colSpan?: 1 | 2`), `initialValues`, `submitLabel`, `onClose`, `onSubmit: (values) => Promise<void>`.
   - Catatan konvensi kolom (`colSpan`): `1` = lebar penuh (1 kolom penuh modal), `2` = setengah lebar (grid 2 kolom berdampingan).

3. **Halaman Admin Baru:**
   - `/admin/users` (`AdminUsersPage`): memakai `DataTable` + `ResourceModalForm`. Menampilkan tombol mutasi hanya untuk `user.role === 'admin'`; `manager` melihat badge `Read-Only Oversight`.
   - `/admin/audit-logs` (`AdminAuditLogsPage`): memakai `DataTable` yang sama dengan filter kode aksi dan pencarian deskripsi.

---

## 5. Strategi Pengujian & Kriteria Selesai

1. Test `@cinemax/shared`: validasi `adminCreateUserSchema` & `adminUpdateUserSchema` (termasuk password kosong saat update diabaikan, password pendek ditolak).
2. Test `@cinemax/server` (`admin-users.test.ts`):
   - `admin` dapat membuat staf baru (`201`), otomatis tercatat `USER_CREATED` di `GET /admin/audit-logs`.
   - `manager` dapat membaca `GET /admin/users` & `GET /admin/audit-logs` (`200`), namun ditolak `403` saat mencoba `POST` / `PATCH` / `DELETE`.
   - `cashier` ditolak `403` untuk semua rute `/admin/users` dan `/admin/audit-logs`.
   - `admin` ditolak `400 SELF_LOCKOUT_FORBIDDEN` saat mencoba menonaktifkan/menurunkan role dirinya sendiri, dan ditolak `400 SELF_DELETE_FORBIDDEN` saat mencoba menghapus dirinya sendiri.
   - Saat `admin` menonaktifkan akun staf (`isActive: false`), cookie sesi staf yang sebelumnya aktif langsung tertolak `401` pada request berikutnya.
3. Migrasi `0002` terpasang di `cinemax-db`, `npm run build` & `npm test` lulus bersih, serta bukti `curl` nyata atas CRUD User + pencabutan sesi instan + Audit Log.
