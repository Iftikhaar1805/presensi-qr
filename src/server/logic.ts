import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import type { AuthUser } from './auth'
import { db, schema } from './db'
import { isSunday, minutesOf, wib } from './time'

export type Status = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa'
export const STATUS_LIST: Status[] = ['hadir', 'terlambat', 'izin', 'sakit', 'alpa']

export interface Settings {
  schoolName: string
  schoolAddress: string
  checkInTime: string
  lateTolerance: number
  cutoffTime: string
}

export async function getSettings(): Promise<Settings> {
  const kv = Object.fromEntries((await db.select().from(schema.settings).all()).map((r) => [r.key, r.value]))
  return {
    schoolName: kv.schoolName ?? 'Sekolah',
    schoolAddress: kv.schoolAddress ?? '',
    checkInTime: kv.checkInTime ?? '07:00',
    lateTolerance: Number(kv.lateTolerance ?? 15),
    cutoffTime: kv.cutoffTime ?? '09:00',
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  for (const [key, value] of Object.entries(s)) {
    await db.insert(schema.settings).values({ key, value: String(value) }).onConflictDoUpdate({ target: schema.settings.key, set: { value: String(value) } }).run()
  }
}

export function emptyCounts(): Record<Status, number> {
  return { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpa: 0 }
}

export async function schoolDay(date: string): Promise<{ open: boolean; reason?: string }> {
  if (isSunday(date)) return { open: false, reason: 'Hari Minggu' }
  const h = await db.select().from(schema.holidays).where(eq(schema.holidays.date, date)).get()
  if (h) return { open: false, reason: h.description }
  return { open: true }
}

export async function statusFor(time: string): Promise<Status> {
  const s = await getSettings()
  return minutesOf(time) <= minutesOf(s.checkInTime) + s.lateTolerance ? 'hadir' : 'terlambat'
}

const CHUNK = 400 // batas variabel SQLite: 400 baris x 8 kolom masih jauh di bawah 32766

/**
 * Siswa yang belum scan setelah jam batas ditandai Alpa.
 * Dipanggil saat data hari itu dibuka (dan tiap menit oleh server lokal).
 */
export async function ensureAutoAlpa(date: string): Promise<void> {
  const now = wib()
  if (date > now.date || !(await schoolDay(date)).open) return
  const s = await getSettings()
  if (date === now.date && minutesOf(now.time) < minutesOf(s.cutoffTime)) return
  const has = new Set((await db.select({ id: schema.attendances.studentId }).from(schema.attendances).where(eq(schema.attendances.date, date)).all()).map((r) => r.id))
  const missing = (await db.select({ id: schema.students.id }).from(schema.students).all()).filter((r) => !has.has(r.id))
  for (let i = 0; i < missing.length; i += CHUNK) {
    const rows = missing.slice(i, i + CHUNK).map((m) => ({
      studentId: m.id,
      date,
      checkInTime: null,
      status: 'alpa' as const,
      note: 'Otomatis: tidak scan sampai jam batas',
      recordedBy: null,
      updatedAt: `${date} ${s.cutoffTime}:00`,
    }))
    await db.insert(schema.attendances).values(rows).onConflictDoNothing().run()
  }
}

export type ClassMap = Map<number, { id: number; name: string; homeroomTeacherId: number | null }>

export async function classMap(): Promise<ClassMap> {
  return new Map((await db.select().from(schema.classes).all()).map((c) => [c.id, c]))
}

/** Bentuk siswa yang dikirim ke frontend. Token QR hanya untuk admin dan guru (semua pengguna adalah salah satunya). */
export function toStudent(s: typeof schema.students.$inferSelect, classes: ClassMap) {
  return { id: s.id, nis: s.nis, name: s.name, gender: s.gender, classId: s.classId, qrToken: s.qrToken, className: classes.get(s.classId)?.name ?? '-' }
}

export function canEditClass(user: AuthUser, classId: number, classes: ClassMap): boolean {
  if (user.role === 'admin') return true
  return user.teacherId !== null && classes.get(classId)?.homeroomTeacherId === user.teacherId
}

export async function logChange(a: { id: number; status: string }, newStatus: Status, note: string, user: AuthUser): Promise<void> {
  const t = wib()
  await db
    .insert(schema.attendanceLogs)
    .values({ attendanceId: a.id, oldStatus: a.status, newStatus, note, changedBy: user.id, changedByName: user.name, at: `${t.date} ${t.time}` })
    .run()
}

export async function activeClassIds(): Promise<number[]> {
  const year = await db.select().from(schema.academicYears).where(eq(schema.academicYears.isActive, true)).get()
  const rows = year ? await db.select().from(schema.classes).where(eq(schema.classes.academicYearId, year.id)).all() : await db.select().from(schema.classes).all()
  return rows.map((c) => c.id)
}

export async function studentsOf(classId?: number) {
  const rows = classId
    ? await db.select().from(schema.students).where(eq(schema.students.classId, classId)).all()
    : await (async () => {
        const ids = await activeClassIds()
        return db.select().from(schema.students).where(inArray(schema.students.classId, ids.length ? ids : [-1])).all()
      })()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export async function attendanceOf(studentId: number, date: string) {
  return db.select().from(schema.attendances).where(and(eq(schema.attendances.studentId, studentId), eq(schema.attendances.date, date))).get()
}

/** Sesi mengajar yang lupa diakhiri di hari sebelumnya ditutup otomatis, supaya kelas tidak terkunci. */
export async function closeStaleSessions(today: string): Promise<void> {
  await db
    .update(schema.teachingSessions)
    .set({ endedAt: sql`${schema.teachingSessions.date} || ' 23:59:59'` })
    .where(and(isNull(schema.teachingSessions.endedAt), lt(schema.teachingSessions.date, today)))
    .run()
}

/** Sesi mengajar guru ini yang sedang berjalan hari ini (atau undefined jika belum mengambil kelas). */
export async function activeSessionOf(userId: number, date: string) {
  return db
    .select()
    .from(schema.teachingSessions)
    .where(and(eq(schema.teachingSessions.userId, userId), isNull(schema.teachingSessions.endedAt), eq(schema.teachingSessions.date, date)))
    .get()
}

export async function getSchoolLogo(): Promise<string | null> {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, 'schoolLogo')).get()
  return row?.value || null
}

/** Catat perubahan penting. Kegagalan mencatat tidak boleh membatalkan perubahan yang sudah berhasil. */
export async function audit(user: { id: number; name: string }, action: string, detail = ''): Promise<void> {
  try {
    const t = wib()
    await db.insert(schema.auditLogs).values({ at: `${t.date} ${t.time}`, userId: user.id, userName: user.name, action, detail }).run()
  } catch {
    // dibiarkan
  }
}
