import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z, ZodError } from 'zod'
import { hashPassword, issueToken, requireAuth, requireRole, verifyPassword, type AuthUser, type Env, type Role } from './auth'
import { db, initDb, schema } from './db'
import {
  activeClassIds, activeSessionOf, closeStaleSessions, attendanceOf, canEditClass, classMap, emptyCounts, ensureAutoAlpa, getSettings, logChange, saveSettings, schoolDay,
  statusFor, studentsOf, toStudent, STATUS_LIST, type Status, getSchoolLogo, audit,
} from './logic'
import { ensureSeeded, seed } from './seed'
import { addDays as addDaysStr, datesBetween, isSunday, minutesOf, wib } from './time'

class ApiError extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 429
  constructor(message: string, status: 400 | 401 | 403 | 404 | 409 | 429 = 400) {
    super(message)
    this.status = status
  }
}

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data)
  } catch (e) {
    if (e instanceof ZodError) {
      const issue = e.issues[0]
      // Pesan bawaan zod berbahasa Inggris diganti pesan umum yang menyebut nama isiannya
      const generic = !issue || /^(Invalid|Too small|Too big)/.test(issue.message)
      const field = issue?.path.join('.')
      throw new ApiError(generic ? (field ? `Isian "${field}" belum diisi atau tidak valid.` : 'Data tidak lengkap atau tidak valid.') : issue.message)
    }
    throw e
  }
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Format jam harus HH:MM.')
const statusEnum = z.enum(['hadir', 'terlambat', 'izin', 'sakit', 'alpa'])

const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
function newQrToken(): string {
  return Array.from(randomBytes(32), (b) => TOKEN_CHARS[b % TOKEN_CHARS.length]).join('')
}

const publicUser = (u: { id: number; name: string; username: string; role: string; teacherId: number | null }) => ({
  id: u.id, name: u.name, username: u.username, role: u.role as Role, teacherId: u.teacherId ?? undefined,
})

export const app = new Hono<Env>().basePath('/api')

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Terjadi kesalahan di server.' }, 500)
})

app.get('/health', (c) => c.json({ ok: true }))

// Tabel dan data contoh disiapkan sekali per proses (penting di hosting serverless yang mulai dari nol)
/** Menyiapkan tabel dan data contoh. Aman dipanggil berulang. */
export async function prepareDatabase(): Promise<void> {
  await initDb()
  await ensureSeeded()
}

app.use('*', async (_c, next) => {
  await prepareDatabase()
  await next()
})

// ───────────── Konfigurasi publik ─────────────
// Tombol akun contoh di halaman masuk hanya untuk latihan: tampil bila SHOW_DEMO_ACCOUNTS=1, selain itu disembunyikan.
function showDemoAccounts(): boolean {
  const env = process.env.SHOW_DEMO_ACCOUNTS
  return env === '1' || env === 'true'
}

app.get('/config', async (c) => c.json({ demoAccounts: showDemoAccounts(), schoolName: (await getSettings()).schoolName, logo: await getSchoolLogo() }))

/** Dipanggil terjadwal (lihat vercel.json) agar database Turso gratis tidak tertidur. */
app.get('/warmup', async (c) => {
  const t0 = Date.now()
  await db.select().from(schema.settings).limit(1).all()
  return c.json({ ok: true, dbMs: Date.now() - t0 })
})

// Siswa memindai kartunya sendiri untuk melihat kehadirannya. Hanya baca, tanpa login; kodenya rahasia di kartu.
app.post('/cek-kartu', async (c) => {
  const key = `cek|${clientIp(c)}`
  const wait = await blockedMinutes(key, 30)
  if (wait) throw new ApiError(`Terlalu banyak percobaan. Coba lagi dalam ${wait} menit.`, 429)
  const { code } = parse(z.object({ code: z.string().trim().min(8).max(100) }), await c.req.json().catch(() => ({})))
  const st = await db.select().from(schema.students).where(eq(schema.students.qrToken, code)).get()
  if (!st) {
    await recordFailure(key)
    return c.json({ kind: 'invalid', message: 'Kartu tidak dikenali. Kartu mungkin sudah diganti. Tanyakan ke guru.' })
  }
  const today = wib().date
  const from = datesBetween(addDaysStr(today, -13), today)[0]!
  const [cm, daily, lessons, subjects] = await Promise.all([
    classMap(),
    db.select().from(schema.attendances).where(and(eq(schema.attendances.studentId, st.id), gte(schema.attendances.date, from), lte(schema.attendances.date, today))).orderBy(desc(schema.attendances.date)).all(),
    db.select().from(schema.lessonAttendances).where(and(eq(schema.lessonAttendances.studentId, st.id), eq(schema.lessonAttendances.date, today))).all(),
    db.select().from(schema.subjects).all(),
  ])
  const sName = new Map(subjects.map((x) => [x.id, x.name]))
  return c.json({
    kind: 'ok',
    name: st.name,
    nis: st.nis,
    className: cm.get(st.classId)?.name ?? '-',
    today: daily.find((d) => d.date === today) ? { status: daily.find((d) => d.date === today)!.status, checkInTime: daily.find((d) => d.date === today)!.checkInTime } : null,
    lessons: lessons.map((l) => ({ subjectName: sName.get(l.subjectId) ?? '-', status: l.status, checkInTime: l.checkInTime })),
    history: daily.map((d) => ({ date: d.date, status: d.status })),
  })
})

// ───────────── Auth ─────────────
// Pembatas tebakan password: 8 kali salah dalam 10 menit untuk kombinasi alamat dan username yang sama = ditahan.
const LOGIN_WINDOW_MS = 10 * 60_000
const LOGIN_MAX_FAILS = 8

function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'lokal'
}

function loginKey(c: Context, username: string): string {
  return `${clientIp(c)}|${username.trim().toLowerCase()}`
}

/** Sisa menit penahanan untuk kunci ini, atau 0 bila belum ditahan. */
async function blockedMinutes(key: string, max: number): Promise<number> {
  const row = await db.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.key, key)).get()
  if (!row) return 0
  const age = Date.now() - row.firstAt
  if (age >= LOGIN_WINDOW_MS) {
    await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key)).run()
    return 0
  }
  return row.n >= max ? Math.ceil((LOGIN_WINDOW_MS - age) / 60_000) : 0
}

async function recordFailure(key: string): Promise<void> {
  const row = await db.select().from(schema.loginAttempts).where(eq(schema.loginAttempts.key, key)).get()
  const fresh = !row || Date.now() - row.firstAt >= LOGIN_WINDOW_MS
  await db
    .insert(schema.loginAttempts)
    .values({ key, n: 1, firstAt: Date.now() })
    .onConflictDoUpdate({ target: schema.loginAttempts.key, set: fresh ? { n: 1, firstAt: Date.now() } : { n: (row?.n ?? 0) + 1 } })
    .run()
}

const clearFailures = (key: string) => db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key)).run()

const DEFAULT_PASSWORDS = new Set(['admin123', 'guru123'])

app.post('/login', async (c) => {
  const body = parse(z.object({ username: z.string().min(1, 'Isi username.'), password: z.string().min(1, 'Isi password.') }), await c.req.json().catch(() => ({})))
  const key = loginKey(c, body.username)
  const wait = await blockedMinutes(key, LOGIN_MAX_FAILS)
  if (wait) throw new ApiError(`Terlalu banyak percobaan masuk. Coba lagi dalam ${wait} menit.`, 429)
  const u = await db.select().from(schema.users).where(eq(schema.users.username, body.username.trim())).get()
  if (!u || !verifyPassword(body.password, u.passwordHash)) {
    await recordFailure(key)
    throw new ApiError('Username atau password salah.', 401)
  }
  await clearFailures(key)
  const user: AuthUser = { id: u.id, name: u.name, username: u.username, role: u.role as Role, teacherId: u.teacherId }
  // Pengguna yang masih memakai password bawaan diminta menggantinya (tampil sebagai peringatan di aplikasi)
  return c.json({ token: await issueToken(user), user: { ...publicUser(user), weakPassword: DEFAULT_PASSWORDS.has(body.password) } })
})

app.use('*', async (c, next) => (['/api/login', '/api/health', '/api/config', '/api/warmup', '/api/cek-kartu'].includes(c.req.path) ? next() : requireAuth(c, next)))

const staff = requireRole('admin', 'guru')
const adminOnly = requireRole('admin')

app.get('/me', (c) => c.json(publicUser(c.get('user'))))

app.put('/me/password', async (c) => {
  const body = parse(z.object({ oldPassword: z.string(), newPassword: z.string().min(6, 'Password baru minimal 6 karakter.') }), await c.req.json())
  const me = c.get('user')
  const row = (await db.select().from(schema.users).where(eq(schema.users.id, me.id)).get())!
  if (!verifyPassword(body.oldPassword, row.passwordHash)) throw new ApiError('Password lama salah.')
  await db.update(schema.users).set({ passwordHash: hashPassword(body.newPassword) }).where(eq(schema.users.id, me.id)).run()
  return c.json({ ok: true })
})

// ───────────── Pengaturan ─────────────
app.get('/settings', async (c) => c.json(await getSettings()))

// Logo dikirim sebagai data URL (sudah dikecilkan di browser) dan disimpan di database, jadi ikut jalan di hosting tanpa penyimpanan berkas.
app.put('/settings/logo', adminOnly, async (c) => {
  const { logo } = parse(z.object({ logo: z.string().nullable() }), await c.req.json())
  if (logo === null) {
    await db.delete(schema.settings).where(eq(schema.settings.key, 'schoolLogo')).run()
    return c.json({ ok: true })
  }
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) throw new ApiError('Logo harus berupa gambar PNG, JPG, atau WebP.')
  if (logo.length > 250_000) throw new ApiError('Ukuran logo terlalu besar. Pilih gambar yang lebih kecil.')
  await db.insert(schema.settings).values({ key: 'schoolLogo', value: logo }).onConflictDoUpdate({ target: schema.settings.key, set: { value: logo } }).run()
  return c.json({ ok: true })
})

app.put('/settings', adminOnly, async (c) => {
  const s = parse(
    z.object({
      schoolName: z.string().min(1, 'Nama sekolah wajib diisi.'),
      schoolAddress: z.string(),
      checkInTime: timeStr,
      lateTolerance: z.number().int().min(0).max(240),
      cutoffTime: timeStr,
      practiceMode: z.boolean().default(false),
    }),
    await c.req.json(),
  )
  if (minutesOf(s.cutoffTime) <= minutesOf(s.checkInTime)) throw new ApiError('Jam batas presensi harus setelah jam masuk.')
  await saveSettings(s)
  await audit(c.get('user'), 'Ubah pengaturan', `jam masuk ${s.checkInTime}, toleransi ${s.lateTolerance} menit, batas ${s.cutoffTime}, mode latihan ${s.practiceMode ? 'nyala' : 'mati'}`)
  return c.json({ ok: true })
})

app.get('/academic-years', async (c) => c.json(await db.select().from(schema.academicYears).orderBy(asc(schema.academicYears.name)).all()))

app.post('/academic-years', adminOnly, async (c) => {
  const { name } = parse(z.object({ name: z.string().regex(/^\d{4}\/\d{4}$/, 'Format tahun ajaran: 2026/2027.') }), await c.req.json())
  if (await db.select().from(schema.academicYears).where(eq(schema.academicYears.name, name)).get()) throw new ApiError('Tahun ajaran sudah ada.', 409)
  await db.insert(schema.academicYears).values({ name, isActive: false }).run()
  return c.json({ ok: true })
})

app.post('/academic-years/:id/activate', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  await db.batch([db.update(schema.academicYears).set({ isActive: false }), db.update(schema.academicYears).set({ isActive: true }).where(eq(schema.academicYears.id, id))])
  return c.json({ ok: true })
})

app.get('/holidays', async (c) => c.json(await db.select().from(schema.holidays).orderBy(asc(schema.holidays.date)).all()))

app.post('/holidays', adminOnly, async (c) => {
  const b = parse(z.object({ date: dateStr, description: z.string().min(1, 'Isi keterangan hari libur.') }), await c.req.json())
  if (await db.select().from(schema.holidays).where(eq(schema.holidays.date, b.date)).get()) throw new ApiError('Tanggal itu sudah terdaftar sebagai hari libur.', 409)
  // Alpa otomatis pada hari itu tidak berlaku lagi
  await db.batch([
    db.insert(schema.holidays).values(b),
    db.delete(schema.attendances).where(and(eq(schema.attendances.date, b.date), eq(schema.attendances.status, 'alpa'))),
  ])
  return c.json({ ok: true })
})

app.delete('/holidays/:id', adminOnly, async (c) => {
  await db.delete(schema.holidays).where(eq(schema.holidays.id, Number(c.req.param('id')))).run()
  return c.json({ ok: true })
})

app.get('/school-day', async (c) => c.json(await schoolDay(parse(dateStr, c.req.query('date')))))

// ───────────── Kelas ─────────────
app.get('/classes', async (c) => {
  const ids = await activeClassIds()
  const rows = await db.select().from(schema.classes).where(inArray(schema.classes.id, ids.length ? ids : [-1])).all()
  return c.json(rows.sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name)))
})

const classBody = z.object({ name: z.string().min(1, 'Nama kelas wajib diisi.'), grade: z.number().int().min(1).max(12), homeroomTeacherId: z.number().int().nullable() })

app.post('/classes', adminOnly, async (c) => {
  const b = parse(classBody, await c.req.json())
  const year = await db.select().from(schema.academicYears).where(eq(schema.academicYears.isActive, true)).get()
  if (!year) throw new ApiError('Belum ada tahun ajaran aktif.')
  const name = b.name.trim().toUpperCase()
  if (await db.select().from(schema.classes).where(and(eq(schema.classes.name, name), eq(schema.classes.academicYearId, year.id))).get()) throw new ApiError(`Kelas ${name} sudah ada.`, 409)
  await db.insert(schema.classes).values({ name, grade: b.grade, homeroomTeacherId: b.homeroomTeacherId, academicYearId: year.id }).run()
  return c.json({ ok: true })
})

app.put('/classes/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  const b = parse(classBody, await c.req.json())
  const cls = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).get()
  if (!cls) throw new ApiError('Kelas tidak ditemukan.', 404)
  const name = b.name.trim().toUpperCase()
  const dup = await db.select().from(schema.classes).where(and(eq(schema.classes.name, name), eq(schema.classes.academicYearId, cls.academicYearId))).get()
  if (dup && dup.id !== id) throw new ApiError(`Kelas ${name} sudah ada.`, 409)
  await db.update(schema.classes).set({ name, grade: b.grade, homeroomTeacherId: b.homeroomTeacherId }).where(eq(schema.classes.id, id)).run()
  return c.json({ ok: true })
})

app.delete('/classes/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  if (await db.select().from(schema.students).where(eq(schema.students.classId, id)).limit(1).get()) throw new ApiError('Kelas masih berisi siswa. Pindahkan atau hapus siswanya dulu.', 409)
  await db.delete(schema.classes).where(eq(schema.classes.id, id)).run()
  return c.json({ ok: true })
})

// ───────────── Guru ─────────────
app.get('/teachers', adminOnly, async (c) => {
  const [teachers, users, links] = await Promise.all([
    db.select().from(schema.teachers).orderBy(asc(schema.teachers.name)).all(),
    db.select().from(schema.users).where(eq(schema.users.role, 'guru')).all(),
    db.select().from(schema.teacherSubjects).all(),
  ])
  const byTeacher = new Map(users.map((u) => [u.teacherId, u.username]))
  return c.json(teachers.map((t) => ({ id: t.id, nip: t.nip, name: t.name, phone: t.phone, username: byTeacher.get(t.id) ?? '', subjectIds: links.filter((l) => l.teacherId === t.id).map((l) => l.subjectId) })))
})

async function setTeacherSubjects(teacherId: number, subjectIds: number[]) {
  await db.delete(schema.teacherSubjects).where(eq(schema.teacherSubjects.teacherId, teacherId)).run()
  const unique = [...new Set(subjectIds)]
  if (unique.length) await db.insert(schema.teacherSubjects).values(unique.map((subjectId) => ({ teacherId, subjectId }))).run()
}

const teacherBody = z.object({ subjectIds: z.array(z.number().int()).default([]), nip: z.string().default(''), name: z.string().min(1, 'Nama guru wajib diisi.'), phone: z.string().default(''), username: z.string().optional() })

app.post('/teachers', adminOnly, async (c) => {
  const b = parse(teacherBody, await c.req.json())
  const username = (b.username ?? '').trim().toLowerCase()
  if (!username) throw new ApiError('Username wajib diisi.')
  if (await db.select().from(schema.users).where(eq(schema.users.username, username)).get()) throw new ApiError('Username sudah dipakai.', 409)
  const t = await db.insert(schema.teachers).values({ nip: b.nip, name: b.name.trim(), phone: b.phone }).returning().get()
  await db.insert(schema.users).values({ name: t.name, username, passwordHash: hashPassword('guru123'), role: 'guru', teacherId: t.id }).run()
  await setTeacherSubjects(t.id, b.subjectIds)
  return c.json({ ok: true })
})

app.put('/teachers/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  const b = parse(teacherBody, await c.req.json())
  await db.batch([
    db.update(schema.teachers).set({ nip: b.nip, name: b.name.trim(), phone: b.phone }).where(eq(schema.teachers.id, id)),
    db.update(schema.users).set({ name: b.name.trim() }).where(eq(schema.users.teacherId, id)),
  ])
  await setTeacherSubjects(id, b.subjectIds)
  return c.json({ ok: true })
})

app.delete('/teachers/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  await db.batch([
    db.update(schema.classes).set({ homeroomTeacherId: null }).where(eq(schema.classes.homeroomTeacherId, id)),
    db.delete(schema.users).where(eq(schema.users.teacherId, id)),
    db.delete(schema.teacherSubjects).where(eq(schema.teacherSubjects.teacherId, id)),
    db.delete(schema.teachers).where(eq(schema.teachers.id, id)),
  ])
  return c.json({ ok: true })
})

app.post('/teachers/:id/reset-password', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(schema.users).set({ passwordHash: hashPassword('guru123') }).where(eq(schema.users.teacherId, id)).run()
  await audit(c.get('user'), 'Atur ulang password guru', `guru nomor ${id}`)
  return c.json({ password: 'guru123' })
})

// ───────────── Siswa ─────────────
app.get('/students', staff, async (c) => {
  const classId = Number(c.req.query('classId')) || undefined
  const [list, cm] = await Promise.all([studentsOf(classId), classMap()])
  return c.json(list.map((s) => toStudent(s, cm)))
})

const studentBody = z.object({
  nis: z.string().trim().min(1, 'NIS wajib diisi.'),
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  gender: z.enum(['L', 'P']),
  classId: z.number().int(),
})

app.post('/students', adminOnly, async (c) => {
  const b = parse(studentBody, await c.req.json())
  if (await db.select().from(schema.students).where(eq(schema.students.nis, b.nis)).get()) throw new ApiError(`NIS ${b.nis} sudah terdaftar.`, 409)
  await db.insert(schema.students).values({ ...b, qrToken: newQrToken() }).run()
  return c.json({ ok: true })
})

app.put('/students/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  const b = parse(studentBody, await c.req.json())
  const dup = await db.select().from(schema.students).where(eq(schema.students.nis, b.nis)).get()
  if (dup && dup.id !== id) throw new ApiError(`NIS ${b.nis} sudah terdaftar.`, 409)
  await db.update(schema.students).set(b).where(eq(schema.students.id, id)).run()
  return c.json({ ok: true })
})

app.delete('/students/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  const ids = (await db.select({ id: schema.attendances.id }).from(schema.attendances).where(eq(schema.attendances.studentId, id)).all()).map((r) => r.id)
  for (let i = 0; i < ids.length; i += 500) await db.delete(schema.attendanceLogs).where(inArray(schema.attendanceLogs.attendanceId, ids.slice(i, i + 500))).run()
  await db.batch([
    db.delete(schema.lessonAttendances).where(eq(schema.lessonAttendances.studentId, id)),
    db.delete(schema.attendances).where(eq(schema.attendances.studentId, id)),
    db.delete(schema.students).where(eq(schema.students.id, id)),
  ])
  return c.json({ ok: true })
})

app.post('/students/:id/regenerate-qr', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  const s = await db.update(schema.students).set({ qrToken: newQrToken() }).where(eq(schema.students.id, id)).returning().get()
  if (!s) throw new ApiError('Siswa tidak ditemukan.', 404)
  await audit(c.get('user'), 'Buat QR baru', `${s.name} (NIS ${s.nis}), kartu lama tidak berlaku`)
  return c.json(toStudent(s, await classMap()))
})

app.post('/students/import', adminOnly, async (c) => {
  const { rows } = parse(z.object({ rows: z.array(z.object({ nis: z.any(), name: z.any(), gender: z.any(), className: z.any() })).max(2000, 'Maksimal 2000 baris sekali import.') }), await c.req.json())
  const [cm, activeIds, existing] = await Promise.all([classMap(), activeClassIds(), db.select({ nis: schema.students.nis }).from(schema.students).all()])
  const active = new Set(activeIds)
  const taken = new Set(existing.map((r) => r.nis))
  const errors: { row: number; message: string }[] = []
  const valid: { nis: string; name: string; gender: 'L' | 'P'; classId: number; qrToken: string }[] = []
  rows.forEach((r, i) => {
    const rowNo = i + 2 // baris 1 = judul kolom
    const nis = String(r.nis ?? '').trim()
    const name = String(r.name ?? '').trim()
    const g = String(r.gender ?? '').trim().toUpperCase()
    const cls = [...cm.values()].find((x) => active.has(x.id) && x.name === String(r.className ?? '').trim().toUpperCase())
    if (!nis || !name) return void errors.push({ row: rowNo, message: 'NIS atau nama kosong.' })
    if (taken.has(nis)) return void errors.push({ row: rowNo, message: `NIS ${nis} sudah ada.` })
    if (g !== 'L' && g !== 'P') return void errors.push({ row: rowNo, message: 'Jenis kelamin harus L atau P.' })
    if (!cls) return void errors.push({ row: rowNo, message: `Kelas "${r.className}" tidak ditemukan.` })
    taken.add(nis)
    valid.push({ nis, name, gender: g, classId: cls.id, qrToken: newQrToken() })
  })
  for (let i = 0; i < valid.length; i += 300) await db.insert(schema.students).values(valid.slice(i, i + 300)).run()
  return c.json({ added: valid.length, errors })
})

// ───────────── Presensi ─────────────
/** Membuat atau memperbarui kehadiran harian saat siswa pertama kali dipindai hari ini. */
async function ensureDaily(studentId: number, now: { date: string; time: string }, user: AuthUser) {
  const stamp = `${now.date} ${now.time}`
  const existing = await attendanceOf(studentId, now.date)
  if (!existing) {
    const created = await db.insert(schema.attendances).values({ studentId, date: now.date, checkInTime: now.time, status: await statusFor(now.time), note: '', recordedBy: user.id, updatedAt: stamp }).returning().get()
    return { daily: created, fresh: true }
  }
  // Alpa otomatis, lalu siswa datang setelah jam batas: dicatat Terlambat
  if (existing.status === 'alpa' && existing.recordedBy === null) {
    await logChange(existing, 'terlambat', 'Scan setelah jam batas', user)
    const updated = await db.update(schema.attendances).set({ status: 'terlambat', checkInTime: now.time, note: 'Scan setelah jam batas', recordedBy: user.id, updatedAt: stamp }).where(eq(schema.attendances.id, existing.id)).returning().get()
    return { daily: updated, fresh: true }
  }
  return { daily: existing, fresh: false }
}

app.post('/scan', staff, async (c) => {
  const user = c.get('user')
  const { code } = parse(z.object({ code: z.string().min(1) }), await c.req.json())
  const now = wib()
  const day = await schoolDay(now.date)
  if (!day.open) return c.json({ kind: 'closed', message: `Presensi ditutup: ${day.reason}` })

  // Memindai hanya bisa dilakukan guru yang sedang mengajar: mata pelajaran dan kelas ikut sesinya
  const session = await activeSessionOf(user.id, now.date)
  if (!session) throw new ApiError('Anda belum mengambil kelas. Buka menu Mengajar, pilih pelajaran dan kelas dulu.', 409)
  const subjectId = session.subjectId

  const key = code.trim()
  const student = (await db.select().from(schema.students).where(eq(schema.students.qrToken, key)).get()) ?? (await db.select().from(schema.students).where(eq(schema.students.nis, key)).get())
  if (!student) return c.json({ kind: 'invalid', message: 'QR atau NIS tidak dikenali. Kartu mungkin sudah tidak berlaku.' })

  const cm = await classMap()
  const className = cm.get(student.classId)?.name ?? '-'
  const stamp = `${now.date} ${now.time}`

  // Kehadiran di pelajaran ini. Scan pertama siswa hari ini sekaligus menjadi kehadiran harian (bisa Terlambat).
  const subject = await db.select().from(schema.subjects).where(eq(schema.subjects.id, subjectId)).get()
  if (!subject) throw new ApiError('Mata pelajaran tidak ditemukan.', 404)
  const lesson = await db.select().from(schema.lessonAttendances).where(and(eq(schema.lessonAttendances.studentId, student.id), eq(schema.lessonAttendances.date, now.date), eq(schema.lessonAttendances.subjectId, subjectId))).get()

  // Sudah tercatat hadir, izin, atau sakit di pelajaran ini. Yang berstatus Alpa boleh dipindai ulang (datang terlambat ke kelas).
  if (lesson && lesson.status !== 'alpa') return c.json({ kind: 'duplicate', student: toStudent(student, cm), attendance: lesson, className, subjectName: subject.name })
  const { daily, fresh } = await ensureDaily(student.id, now, user)
  const record = lesson
    ? await db.update(schema.lessonAttendances).set({ status: 'hadir', checkInTime: now.time, note: '', recordedBy: user.id, updatedAt: stamp }).where(eq(schema.lessonAttendances.id, lesson.id)).returning().get()
    : await db.insert(schema.lessonAttendances).values({ studentId: student.id, date: now.date, subjectId, status: 'hadir', checkInTime: now.time, note: '', recordedBy: user.id, updatedAt: stamp }).returning().get()
  // Stempel memakai status harian jika scan ini yang pertama hari ini (bisa Terlambat); selain itu Hadir
  return c.json({ kind: 'ok', student: toStudent(student, cm), attendance: { ...record, status: fresh ? daily.status : 'hadir' }, className, subjectName: subject.name })
})

app.get('/attendances/recent', staff, async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50)
  const today = wib().date
  const [cm, rows, all] = await Promise.all([
    classMap(),
    db.select().from(schema.attendances).where(eq(schema.attendances.date, today)).orderBy(desc(schema.attendances.updatedAt)).all(),
    db.select().from(schema.students).all(),
  ])
  const byId = new Map(all.map((s) => [s.id, s]))
  const out = rows
    .filter((a) => a.checkInTime)
    .slice(0, limit)
    .flatMap((a) => {
      const s = byId.get(a.studentId)
      return s ? [{ student: toStudent(s, cm), className: cm.get(s.classId)?.name ?? '-', attendance: a }] : []
    })
  return c.json(out)
})

app.get('/attendances', staff, async (c) => {
  const date = parse(dateStr, c.req.query('date'))
  const classId = Number(c.req.query('classId')) || undefined
  const user = c.get('user')
  await ensureAutoAlpa(date)
  const [cm, list, att] = await Promise.all([classMap(), studentsOf(classId), db.select().from(schema.attendances).where(eq(schema.attendances.date, date)).all()])
  const map = new Map(att.map((a) => [a.studentId, a]))
  return c.json(list.map((s) => ({ student: toStudent(s, cm), attendance: map.get(s.id) ?? null, canEdit: canEditClass(user, s.classId, cm) })))
})

app.put('/attendances', staff, async (c) => {
  const user = c.get('user')
  const b = parse(z.object({ studentId: z.number().int(), date: dateStr, status: statusEnum, note: z.string().max(200).default('') }), await c.req.json())
  const student = await db.select().from(schema.students).where(eq(schema.students.id, b.studentId)).get()
  if (!student) throw new ApiError('Siswa tidak ditemukan.', 404)
  if (!canEditClass(user, student.classId, await classMap())) throw new ApiError('Hanya admin atau wali kelas yang bisa mengubah status siswa ini.', 403)
  const t = wib()
  const stamp = `${t.date} ${t.time}`
  const existing = await attendanceOf(b.studentId, b.date)
  if (existing) {
    await logChange(existing, b.status, b.note, user)
    await db.update(schema.attendances).set({ status: b.status, note: b.note, recordedBy: user.id, updatedAt: stamp }).where(eq(schema.attendances.id, existing.id)).run()
  } else {
    const a = await db.insert(schema.attendances).values({ studentId: b.studentId, date: b.date, checkInTime: null, status: b.status, note: b.note, recordedBy: user.id, updatedAt: stamp }).returning().get()
    await db.insert(schema.attendanceLogs).values({ attendanceId: a.id, oldStatus: null, newStatus: b.status, note: b.note, changedBy: user.id, changedByName: user.name, at: stamp }).run()
  }
  return c.json({ ok: true })
})

app.get('/attendances/:id/logs', staff, async (c) => {
  return c.json(await db.select().from(schema.attendanceLogs).where(eq(schema.attendanceLogs.attendanceId, Number(c.req.param('id')))).orderBy(desc(schema.attendanceLogs.at)).all())
})

// ───────────── Sesi mengajar: ambil kelas dan keluar kelas ─────────────
type SessionRow = typeof schema.teachingSessions.$inferSelect

async function sessionView(rows: SessionRow[]) {
  const [cm, subs, users] = await Promise.all([classMap(), db.select().from(schema.subjects).all(), db.select().from(schema.users).all()])
  const sName = new Map(subs.map((x) => [x.id, x.name]))
  const uName = new Map(users.map((u) => [u.id, u.name]))
  return rows.map((r) => ({
    id: r.id,
    classId: r.classId,
    className: cm.get(r.classId)?.name ?? '-',
    subjectId: r.subjectId,
    subjectName: sName.get(r.subjectId) ?? '-',
    userId: r.userId,
    teacherName: uName.get(r.userId) ?? '-',
    date: r.date,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  }))
}

/** Sesi yang sedang dijalankan guru ini, atau null jika belum mengambil kelas. */
app.get('/sessions/mine', staff, async (c) => {
  const t = wib()
  await closeStaleSessions(t.date)
  const mine = await activeSessionOf(c.get('user').id, t.date)
  return c.json(mine ? (await sessionView([mine]))[0] : null)
})

/** Semua kelas dengan status sekarang: kosong atau sedang diajar siapa. */
app.get('/sessions/classes', staff, async (c) => {
  const t = wib()
  await closeStaleSessions(t.date)
  const ids = await activeClassIds()
  const [classes, teachers, today] = await Promise.all([
    db.select().from(schema.classes).where(inArray(schema.classes.id, ids.length ? ids : [-1])).all(),
    db.select().from(schema.teachers).all(),
    db.select().from(schema.teachingSessions).where(eq(schema.teachingSessions.date, t.date)).all(),
  ])
  const views = await sessionView(today)
  const tName = new Map(teachers.map((x) => [x.id, x.name]))
  return c.json(
    classes
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
      .map((cls) => ({
        cls: { id: cls.id, name: cls.name, grade: cls.grade },
        homeroom: (cls.homeroomTeacherId && tName.get(cls.homeroomTeacherId)) || '-',
        active: views.find((v) => v.classId === cls.id && !v.endedAt) ?? null,
        finishedToday: views.filter((v) => v.classId === cls.id && v.endedAt).length,
      })),
  )
})

/** Guru mengambil kelas yang sedang kosong untuk mengajar satu mata pelajaran. */
app.post('/sessions/start', staff, async (c) => {
  const user = c.get('user')
  const b = parse(z.object({ classId: z.number().int(), subjectId: z.number().int() }), await c.req.json())
  const t = wib()
  const day = await schoolDay(t.date)
  if (!day.open) throw new ApiError(`Hari ini tidak ada pelajaran: ${day.reason}.`, 409)
  await closeStaleSessions(t.date)

  const [cls, subject] = await Promise.all([
    db.select().from(schema.classes).where(eq(schema.classes.id, b.classId)).get(),
    db.select().from(schema.subjects).where(eq(schema.subjects.id, b.subjectId)).get(),
  ])
  if (!cls) throw new ApiError('Kelas tidak ditemukan.', 404)
  if (!subject) throw new ApiError('Mata pelajaran tidak ditemukan.', 404)

  const allowed = await allowedSubjectIds(user)
  if (allowed && !allowed.includes(b.subjectId)) throw new ApiError(`${subject.name} bukan pelajaran yang Anda ampu. Minta admin menambahkannya di Data Guru.`, 403)
  const mine = await activeSessionOf(user.id, t.date)
  if (mine) {
    const [v] = await sessionView([mine])
    throw new ApiError(`Anda masih mengajar ${v!.subjectName} di kelas ${v!.className}. Akhiri pelajaran itu dulu.`, 409)
  }
  const taken = await db.select().from(schema.teachingSessions).where(and(eq(schema.teachingSessions.classId, b.classId), isNull(schema.teachingSessions.endedAt))).get()
  if (taken) {
    const [v] = await sessionView([taken])
    throw new ApiError(`Kelas ${v!.className} sedang diajar ${v!.teacherName} (${v!.subjectName}) sejak ${v!.startedAt.slice(11, 16)}.`, 409)
  }
  try {
    const created = await db.insert(schema.teachingSessions).values({ classId: b.classId, subjectId: b.subjectId, userId: user.id, date: t.date, startedAt: `${t.date} ${t.time}`, endedAt: null, endedBy: null }).returning().get()
    return c.json((await sessionView([created]))[0])
  } catch {
    // Dua guru menekan Ambil pada detik yang sama: yang kedua ditolak oleh batas unik di database
    throw new ApiError('Kelas ini baru saja diambil guru lain. Muat ulang daftar kelas.', 409)
  }
})

/**
 * Mengakhiri sesi: kelas kembali kosong. Secara bawaan siswa yang belum dipindai ditandai tidak hadir.
 * Admin boleh mengosongkan kelas guru lain (misal guru lupa keluar) dengan markAbsent false.
 */
app.post('/sessions/:id/end', staff, async (c) => {
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const { markAbsent } = parse(z.object({ markAbsent: z.boolean().default(true) }), await c.req.json().catch(() => ({})))
  const sess = await db.select().from(schema.teachingSessions).where(eq(schema.teachingSessions.id, id)).get()
  if (!sess || sess.endedAt) throw new ApiError('Sesi tidak ditemukan atau sudah berakhir.', 404)
  if (sess.userId !== user.id && user.role !== 'admin') throw new ApiError('Hanya guru yang mengajar atau admin yang bisa mengakhiri sesi ini.', 403)
  const result = markAbsent ? await finishLessonCore(sess.classId, sess.subjectId, sess.date, user) : { marked: 0, bolos: 0 }
  const t = wib()
  await db.update(schema.teachingSessions).set({ endedAt: `${t.date} ${t.time}`, endedBy: user.id }).where(eq(schema.teachingSessions.id, id)).run()
  return c.json(result)
})

/** Jadwal satu kelas pada satu hari: siapa mengajar apa, jam berapa, berapa yang hadir. Untuk wali kelas. */
app.get('/sessions/day', staff, async (c) => {
  const classId = Number(c.req.query('classId'))
  const date = c.req.query('date') ? parse(dateStr, c.req.query('date')) : wib().date
  if (!classId) throw new ApiError('Pilih kelas.')
  const [rows, list] = await Promise.all([
    db.select().from(schema.teachingSessions).where(and(eq(schema.teachingSessions.classId, classId), eq(schema.teachingSessions.date, date))).orderBy(asc(schema.teachingSessions.startedAt)).all(),
    studentsOf(classId),
  ])
  const ids = list.map((s) => s.id)
  const lessons = ids.length ? await db.select().from(schema.lessonAttendances).where(and(eq(schema.lessonAttendances.date, date), inArray(schema.lessonAttendances.studentId, ids))).all() : []
  const views = await sessionView(rows)
  return c.json(
    views.map((v) => {
      const mine = lessons.filter((l) => l.subjectId === v.subjectId)
      return { ...v, hadir: mine.filter((l) => l.status === 'hadir').length, izin: mine.filter((l) => l.status === 'izin').length, sakit: mine.filter((l) => l.status === 'sakit').length, alpa: mine.filter((l) => l.status === 'alpa').length, total: list.length }
    }),
  )
})

// ───────────── Mata pelajaran dan kehadiran per pelajaran ─────────────
const lessonStatus = z.enum(['hadir', 'izin', 'sakit', 'alpa'])

app.get('/subjects', async (c) => c.json(await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name)).all()))

/** Pelajaran yang boleh diajar pengguna ini. Admin dan guru tanpa catatan boleh semuanya. */
async function allowedSubjectIds(user: AuthUser): Promise<number[] | null> {
  if (user.role === 'admin' || !user.teacherId) return null
  const links = await db.select().from(schema.teacherSubjects).where(eq(schema.teacherSubjects.teacherId, user.teacherId)).all()
  return links.length ? links.map((l) => l.subjectId) : null
}

app.get('/subjects/mine', staff, async (c) => {
  const allowed = await allowedSubjectIds(c.get('user'))
  const all = await db.select().from(schema.subjects).orderBy(asc(schema.subjects.name)).all()
  return c.json(allowed ? all.filter((s) => allowed.includes(s.id)) : all)
})

app.post('/subjects', adminOnly, async (c) => {
  const { name } = parse(z.object({ name: z.string().trim().min(1, 'Nama mata pelajaran wajib diisi.').max(60) }), await c.req.json())
  if (await db.select().from(schema.subjects).where(eq(schema.subjects.name, name)).get()) throw new ApiError('Mata pelajaran itu sudah ada.', 409)
  await db.insert(schema.subjects).values({ name }).run()
  return c.json({ ok: true })
})

app.delete('/subjects/:id', adminOnly, async (c) => {
  const id = Number(c.req.param('id'))
  await db.batch([
    db.delete(schema.lessonAttendances).where(eq(schema.lessonAttendances.subjectId, id)),
    db.delete(schema.teacherSubjects).where(eq(schema.teacherSubjects.subjectId, id)),
    db.delete(schema.subjects).where(eq(schema.subjects.id, id)),
  ])
  return c.json({ ok: true })
})

/** Daftar siswa satu kelas untuk satu pelajaran hari itu: siapa yang sudah dipindai. */
app.get('/lessons', staff, async (c) => {
  const date = c.req.query('date') ? parse(dateStr, c.req.query('date')) : wib().date
  const classId = Number(c.req.query('classId'))
  const subjectId = Number(c.req.query('subjectId'))
  if (!classId || !subjectId) throw new ApiError('Pilih kelas dan mata pelajaran.')
  const [cm, list, daily, lessons] = await Promise.all([
    classMap(),
    studentsOf(classId),
    db.select().from(schema.attendances).where(eq(schema.attendances.date, date)).all(),
    db.select().from(schema.lessonAttendances).where(and(eq(schema.lessonAttendances.date, date), eq(schema.lessonAttendances.subjectId, subjectId))).all(),
  ])
  const dMap = new Map(daily.map((a) => [a.studentId, a]))
  const lMap = new Map(lessons.map((l) => [l.studentId, l]))
  return c.json(list.map((s) => ({ student: toStudent(s, cm), lesson: lMap.get(s.id) ?? null, daily: dMap.get(s.id) ?? null })))
})

/** Guru mengubah kehadiran satu siswa di pelajarannya (misal izin atau sakit). */
app.put('/lessons', staff, async (c) => {
  const user = c.get('user')
  const b = parse(z.object({ studentId: z.number().int(), subjectId: z.number().int(), date: dateStr, status: lessonStatus, note: z.string().max(200).default('') }), await c.req.json())
  const t = wib()
  await db
    .insert(schema.lessonAttendances)
    .values({ studentId: b.studentId, date: b.date, subjectId: b.subjectId, status: b.status, checkInTime: null, note: b.note, recordedBy: user.id, updatedAt: `${t.date} ${t.time}` })
    .onConflictDoUpdate({ target: [schema.lessonAttendances.studentId, schema.lessonAttendances.date, schema.lessonAttendances.subjectId], set: { status: b.status, note: b.note, recordedBy: user.id, updatedAt: `${t.date} ${t.time}` } })
    .run()
  const [stu, sub] = await Promise.all([
    db.select().from(schema.students).where(eq(schema.students.id, b.studentId)).get(),
    db.select().from(schema.subjects).where(eq(schema.subjects.id, b.subjectId)).get(),
  ])
  await audit(user, 'Ubah absen pelajaran', `${stu?.name ?? `siswa ${b.studentId}`}, ${sub?.name ?? `pelajaran ${b.subjectId}`}, ${b.date}, ${b.status}${b.note ? `, ${b.note}` : ''}`)
  return c.json({ ok: true })
})

/**
 * Menutup absen satu pelajaran: siswa yang tidak dipindai ditandai Alpa
 * (atau Izin/Sakit jika hari itu sudah tercatat demikian). Siswa yang hadir pagi tetapi alpa di sini terhitung bolos.
 */
async function finishLessonCore(classId: number, subjectId: number, date: string, user: AuthUser): Promise<{ marked: number; bolos: number }> {
  const t = wib()
  const [list, lessons, daily] = await Promise.all([
    studentsOf(classId),
    db.select().from(schema.lessonAttendances).where(and(eq(schema.lessonAttendances.date, date), eq(schema.lessonAttendances.subjectId, subjectId))).all(),
    db.select().from(schema.attendances).where(eq(schema.attendances.date, date)).all(),
  ])
  const done = new Set(lessons.map((l) => l.studentId))
  const dMap = new Map(daily.map((a) => [a.studentId, a]))
  let bolos = 0
  const rows = list
    .filter((s) => !done.has(s.id))
    .map((s) => {
      const d = dMap.get(s.id)
      const excused = d && (d.status === 'izin' || d.status === 'sakit')
      const status = excused ? (d.status as 'izin' | 'sakit') : ('alpa' as const)
      if (status === 'alpa' && d && (d.status === 'hadir' || d.status === 'terlambat')) bolos++
      return { studentId: s.id, date, subjectId, status, checkInTime: null, note: excused ? d.note : 'Tidak hadir di pelajaran ini', recordedBy: user.id, updatedAt: `${t.date} ${t.time}` }
    })
  for (let i = 0; i < rows.length; i += 300) await db.insert(schema.lessonAttendances).values(rows.slice(i, i + 300)).onConflictDoNothing().run()
  return { marked: rows.length, bolos }
}

/** Tabel harian untuk wali kelas: siswa x pelajaran, dengan penanda bolos. */
app.get('/lessons/day', staff, async (c) => {
  const date = parse(dateStr, c.req.query('date'))
  const classId = Number(c.req.query('classId'))
  if (!classId) throw new ApiError('Pilih kelas.')
  await ensureAutoAlpa(date)
  const [cm, list, daily, lessons, subjects] = await Promise.all([
    classMap(),
    studentsOf(classId),
    db.select().from(schema.attendances).where(eq(schema.attendances.date, date)).all(),
    db.select().from(schema.lessonAttendances).where(eq(schema.lessonAttendances.date, date)).all(),
    db.select().from(schema.subjects).orderBy(asc(schema.subjects.id)).all(),
  ])
  const ids = new Set(list.map((s) => s.id))
  const mine = lessons.filter((l) => ids.has(l.studentId))
  const usedIds = [...new Set(mine.map((l) => l.subjectId))]
  const used = subjects.filter((s) => usedIds.includes(s.id))
  const dMap = new Map(daily.map((a) => [a.studentId, a.status as Status]))
  const byStudent = new Map<number, Map<number, Status>>()
  for (const l of mine) {
    if (!byStudent.has(l.studentId)) byStudent.set(l.studentId, new Map())
    byStudent.get(l.studentId)!.set(l.subjectId, l.status as Status)
  }
  const rows = list.map((s) => {
    const dailyStatus = dMap.get(s.id) ?? null
    const lessonMap = byStudent.get(s.id)
    const byLesson: Record<number, Status | null> = {}
    const bolos: string[] = []
    for (const sub of used) {
      const st = lessonMap?.get(sub.id) ?? null
      byLesson[sub.id] = st
      // Bolos: hadir atau terlambat pagi hari, tetapi alpa di pelajaran ini
      if (st === 'alpa' && (dailyStatus === 'hadir' || dailyStatus === 'terlambat')) bolos.push(sub.name)
    }
    return { student: toStudent(s, cm), daily: dailyStatus, byLesson, bolos }
  })
  return c.json({ subjects: used, rows })
})

/** Rekap satu mata pelajaran dalam satu rentang tanggal, untuk diserahkan guru mapel ke wali kelas. */
app.get('/lessons/recap', staff, async (c) => {
  const classId = Number(c.req.query('classId'))
  const subjectId = Number(c.req.query('subjectId'))
  const from = parse(dateStr, c.req.query('from'))
  const to = parse(dateStr, c.req.query('to'))
  if (!classId || !subjectId) throw new ApiError('Pilih kelas dan mata pelajaran.')
  const [cm, list] = await Promise.all([classMap(), studentsOf(classId)])
  const rows = list.length
    ? await db
        .select()
        .from(schema.lessonAttendances)
        .where(and(eq(schema.lessonAttendances.subjectId, subjectId), gte(schema.lessonAttendances.date, from), lte(schema.lessonAttendances.date, to), inArray(schema.lessonAttendances.studentId, list.map((s) => s.id))))
        .all()
    : []
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const index = new Map(rows.map((r) => [`${r.studentId}|${r.date}`, r.status as Status]))
  const out = list.map((s) => {
    const byDate: Record<string, Status | null> = {}
    const counts = emptyCounts()
    for (const d of dates) {
      const st = index.get(`${s.id}|${d}`) ?? null
      byDate[d] = st
      if (st) counts[st]++
    }
    return { student: toStudent(s, cm), byDate, counts }
  })
  return c.json({ dates, rows: out })
})

// ───────────── Dashboard dan rekap ─────────────
app.get('/dashboard', staff, async (c) => {
  const date = c.req.query('date') ? parse(dateStr, c.req.query('date')) : wib().date
  await ensureAutoAlpa(date)
  const day = await schoolDay(date)
  const ids = await activeClassIds()
  const [teachers, classes, att, all] = await Promise.all([
    db.select().from(schema.teachers).all(),
    db.select().from(schema.classes).where(inArray(schema.classes.id, ids.length ? ids : [-1])).all(),
    db.select().from(schema.attendances).where(eq(schema.attendances.date, date)).all(),
    studentsOf(),
  ])
  const teacherName = new Map(teachers.map((t) => [t.id, t.name]))
  const nowSessions = date === wib().date ? await sessionView(await db.select().from(schema.teachingSessions).where(and(isNull(schema.teachingSessions.endedAt), eq(schema.teachingSessions.date, date))).all()) : []
  const status = new Map(att.map((a) => [a.studentId, a.status as Status]))
  const counts = emptyCounts()
  let notYet = 0
  const perClass = classes
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
    .map((cls) => {
      const cc = emptyCounts()
      let ny = 0
      const list = all.filter((s) => s.classId === cls.id)
      // Satu sel per siswa (urut nama): dipakai dashboard untuk papan kehadiran
      const cells: (Status | null)[] = list.map((s) => {
        const st = status.get(s.id) ?? null
        if (st) cc[st]++
        else ny++
        return st
      })
      for (const k of STATUS_LIST) counts[k] += cc[k]
      notYet += ny
      const teaching = nowSessions.find((v) => v.classId === cls.id)
      return { cls, homeroom: (cls.homeroomTeacherId && teacherName.get(cls.homeroomTeacherId)) || '-', total: list.length, counts: cc, notYet: ny, cells, teaching: teaching ? { teacherName: teaching.teacherName, subjectName: teaching.subjectName, since: teaching.startedAt.slice(11, 16) } : null }
    })
  return c.json({ date, open: day.open, closedReason: day.reason, totalStudents: all.length, counts, notYet, perClass })
})

app.get('/recap', staff, async (c) => {
  const classId = Number(c.req.query('classId')) || undefined
  const from = parse(dateStr, c.req.query('from'))
  const toRaw = parse(dateStr, c.req.query('to'))
  const today = wib().date
  const to = toRaw > today ? today : toRaw
  const open = await Promise.all(datesBetween(from, to).map(async (d) => ((await schoolDay(d)).open ? d : null)))
  const dates = open.filter((d): d is string => d !== null)
  for (const d of dates) await ensureAutoAlpa(d)
  const [cm, list] = await Promise.all([classMap(), studentsOf(classId)])
  const index = new Map<string, Status>()
  if (dates.length && list.length) {
    const rows = await db
      .select()
      .from(schema.attendances)
      .where(and(gte(schema.attendances.date, dates[0]!), lte(schema.attendances.date, dates[dates.length - 1]!), inArray(schema.attendances.studentId, list.map((s) => s.id))))
      .all()
    for (const a of rows) index.set(`${a.studentId}|${a.date}`, a.status as Status)
  }
  const rows = list.map((s) => {
    const byDate: Record<string, Status | null> = {}
    const counts = emptyCounts()
    for (const d of dates) {
      const st = index.get(`${s.id}|${d}`) ?? null
      byDate[d] = st
      if (st) counts[st]++
    }
    return { student: toStudent(s, cm), byDate, counts }
  })
  return c.json({ dates, rows })
})

// ───────────── Demo dan cadangan ─────────────
app.post('/demo/reset-today', adminOnly, async (c) => {
  const today = wib().date
  const ids = (await db.select({ id: schema.attendances.id }).from(schema.attendances).where(eq(schema.attendances.date, today)).all()).map((r) => r.id)
  for (let i = 0; i < ids.length; i += 500) await db.delete(schema.attendanceLogs).where(inArray(schema.attendanceLogs.attendanceId, ids.slice(i, i + 500))).run()
  await db.delete(schema.teachingSessions).where(eq(schema.teachingSessions.date, today)).run()
  await db.delete(schema.lessonAttendances).where(eq(schema.lessonAttendances.date, today)).run()
  await db.delete(schema.attendances).where(eq(schema.attendances.date, today)).run()
  await audit(c.get('user'), 'Hapus absen hari ini', `${ids.length} catatan harian dihapus untuk latihan`)
  return c.json({ removed: ids.length })
})

app.post('/demo/reset', adminOnly, async (c) => {
  const me = c.get('user')
  await seed()
  await audit(me, 'Kembalikan data contoh', 'semua data diganti data contoh')
  return c.json({ ok: true })
})

/** Riwayat perubahan penting, terbaru di atas. */
app.get('/audit', adminOnly, async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 60, 300)
  return c.json(await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.id)).limit(limit).all())
})

// Pemulihan dari berkas cadangan (hasil /backup versi 2). Semua atau tidak sama sekali: bila ada baris yang tidak sah, data lama tetap utuh.
const rowsOf = z.array(z.record(z.string(), z.unknown()))
const backupBody = z.object({
  version: z.literal(2, 'Berkas ini bukan cadangan terbaru dan tidak memuat akun, jadi tidak bisa dipulihkan.'),
  settingsRaw: z.array(z.object({ key: z.string(), value: z.string() })),
  users: rowsOf.min(1, 'Berkas cadangan tidak memuat akun.'),
  academicYears: rowsOf,
  classes: rowsOf,
  teachers: rowsOf,
  students: rowsOf,
  attendances: rowsOf,
  attendanceLogs: rowsOf,
  holidays: rowsOf,
  subjects: rowsOf,
  lessonAttendances: rowsOf,
  teachingSessions: rowsOf,
  teacherSubjects: rowsOf,
  auditLogs: rowsOf,
})

app.post('/restore', adminOnly, async (c) => {
  const me = c.get('user')
  const b = parse(backupBody, await c.req.json().catch(() => null))
  if (!b.users.some((u) => u.role === 'admin')) throw new ApiError('Berkas cadangan tidak memuat akun admin.')
  const S = schema
  const plan: [object, Record<string, unknown>[]][] = [
    [S.users, b.users], [S.academicYears, b.academicYears], [S.classes, b.classes], [S.teachers, b.teachers], [S.students, b.students],
    [S.attendances, b.attendances], [S.attendanceLogs, b.attendanceLogs], [S.holidays, b.holidays], [S.subjects, b.subjects],
    [S.lessonAttendances, b.lessonAttendances], [S.teachingSessions, b.teachingSessions], [S.teacherSubjects, b.teacherSubjects],
    [S.auditLogs, b.auditLogs], [S.settings, b.settingsRaw],
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [...plan.map(([t]) => db.delete(t as never))]
  for (const [t, rows] of plan) for (let i = 0; i < rows.length; i += 300) ops.push(db.insert(t as never).values(rows.slice(i, i + 300) as never))
  try {
    await db.batch(ops as never)
  } catch {
    throw new ApiError('Berkas cadangan rusak atau tidak cocok dengan aplikasi ini. Data Anda tidak diubah.')
  }
  await audit({ id: 0, name: me.name }, 'Pulihkan dari cadangan', `${b.students.length} siswa, ${b.attendances.length} catatan harian`)
  return c.json({ ok: true })
})

app.get('/backup', adminOnly, async (c) => {
  const [users, settingsRaw, auditLogs, academicYears, classes, teachers, students, attendances, attendanceLogs, holidays, subjects, lessonAttendances, teachingSessions, teacherSubjects] = await Promise.all([
    db.select().from(schema.users).all(),
    db.select().from(schema.settings).all(),
    db.select().from(schema.auditLogs).all(),
    db.select().from(schema.academicYears).all(),
    db.select().from(schema.classes).all(),
    db.select().from(schema.teachers).all(),
    db.select().from(schema.students).all(),
    db.select().from(schema.attendances).all(),
    db.select().from(schema.attendanceLogs).all(),
    db.select().from(schema.holidays).all(),
    db.select().from(schema.subjects).all(),
    db.select().from(schema.lessonAttendances).all(),
    db.select().from(schema.teachingSessions).all(),
    db.select().from(schema.teacherSubjects).all(),
  ])
  return c.json({ version: 2, exportedAt: new Date().toISOString(), settings: await getSettings(), settingsRaw, users, auditLogs, academicYears, classes, teachers, students, attendances, attendanceLogs, holidays, subjects, lessonAttendances, teachingSessions, teacherSubjects })
})

// Dipakai server lokal untuk menjalankan alpa otomatis tiap menit
export async function runAutoAlpaToday(): Promise<void> {
  const today = wib().date
  if (!isSunday(today)) await ensureAutoAlpa(today)
}
