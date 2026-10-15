import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { mkdirSync } from 'node:fs'
import * as schema from './schema'

// DATABASE_URL:
//   file:data/presensi.db            -> file lokal (demo di laptop, tanpa internet)
//   libsql://nama-db.turso.io        -> Turso (hosting gratis, bersama DATABASE_AUTH_TOKEN)
// Nama TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN (dipakai integrasi Vercel dan dashboard Turso) juga dikenali.
const url = process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? 'file:data/presensi.db'
if (url.startsWith('file:data/')) mkdirSync('data', { recursive: true })

export const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN })
export const db = drizzle({ client, schema })
export { schema }

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL, teacher_id INTEGER, student_id INTEGER);
CREATE TABLE IF NOT EXISTS academic_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nip TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, grade INTEGER NOT NULL,
  homeroom_teacher_id INTEGER, academic_year_id INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nis TEXT NOT NULL UNIQUE, name TEXT NOT NULL, gender TEXT NOT NULL,
  class_id INTEGER NOT NULL, qr_token TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, date TEXT NOT NULL, check_in_time TEXT,
  status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', recorded_by INTEGER, updated_at TEXT NOT NULL,
  UNIQUE (student_id, date));
CREATE INDEX IF NOT EXISTS idx_att_date ON attendances(date);
CREATE TABLE IF NOT EXISTS attendance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, attendance_id INTEGER NOT NULL, old_status TEXT, new_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', changed_by INTEGER NOT NULL, changed_by_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS lesson_attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, date TEXT NOT NULL, subject_id INTEGER NOT NULL,
  status TEXT NOT NULL, check_in_time TEXT, note TEXT NOT NULL DEFAULT '', recorded_by INTEGER, updated_at TEXT NOT NULL,
  UNIQUE (student_id, date, subject_id));
CREATE INDEX IF NOT EXISTS idx_lesson_date ON lesson_attendances(date);
CREATE TABLE IF NOT EXISTS teaching_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
  date TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, ended_by INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_class ON teaching_sessions(class_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_user ON teaching_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_session_date ON teaching_sessions(date);
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, UNIQUE (teacher_id, subject_id));
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id INTEGER, user_name TEXT NOT NULL,
  action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, n INTEGER NOT NULL, first_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE, description TEXT NOT NULL);
`

/**
 * Perubahan struktur untuk database yang sudah berisi data (mis. ALTER TABLE atau tabel baru). Aturan:
 * 1. DDL di atas selalu menggambarkan struktur terbaru, jadi database baru tidak menjalankan migrasi.
 *    Setiap perubahan struktur WAJIB juga ditulis sebagai migrasi di bawah; database yang sudah siap tidak menjalankan DDL lagi.
 * 2. Tambahkan SQL baru di AKHIR daftar ini. Jangan mengubah atau menghapus yang sudah ada.
 * 3. Tiap migrasi dijalankan sekali; nomornya dicatat di tabel schema_migrations.
 */
const MIGRATIONS: string[] = [
  // 1: fitur kehadiran guru dihapus
  'DROP TABLE IF EXISTS teacher_attendances;',
]

let ready: Promise<void> | null = null

/** Membuat tabel jika belum ada, lalu menjalankan migrasi yang belum diterapkan. Hanya berjalan sekali per proses. */
export function initDb(): Promise<void> {
  ready ??= (async () => {
    // Jalur cepat untuk database yang sudah siap: satu pemeriksaan saja (penting di hosting, tiap permintaan dingin menembus jaringan ke database)
    try {
      const v = Number((await client.execute('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations')).rows[0]?.v ?? 0)
      if (v >= MIGRATIONS.length && (await client.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'")).rows.length) return
    } catch {
      // tabel belum ada: lanjut ke pembuatan lengkap
    }
    const fresh = (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")).rows.length === 0
    await client.executeMultiple(DDL)
    await client.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)')
    const done = fresh ? MIGRATIONS.length : Number((await client.execute('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations')).rows[0]?.v ?? 0)
    for (let v = done + 1; v <= MIGRATIONS.length; v++) {
      await client.executeMultiple(MIGRATIONS[v - 1]!)
      await client.execute({ sql: 'INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)', args: [v] })
    }
    if (fresh && MIGRATIONS.length) {
      for (let v = 1; v <= MIGRATIONS.length; v++) await client.execute({ sql: 'INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)', args: [v] })
    }
  })()
  return ready
}
