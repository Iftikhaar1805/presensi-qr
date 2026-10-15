import { hashPassword } from './auth'
import { client, db, schema } from './db'
import { eq } from 'drizzle-orm'
import { DEFAULT_LOGO } from './defaultLogo'
import { addDays, isSunday, wib } from './time'

// Data contoh untuk demo PKM. Generator acak bersifat deterministik, jadi hasilnya selalu sama.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST_M = ['Ahmad', 'Muhammad', 'Rizky', 'Dimas', 'Fajar', 'Bayu', 'Raka', 'Galih', 'Ilham', 'Arya', 'Farhan', 'Rafi', 'Yusuf', 'Aditya', 'Hafiz', 'Naufal', 'Dafa', 'Reza', 'Bima', 'Satria']
const FIRST_F = ['Siti', 'Nur', 'Aisyah', 'Putri', 'Dewi', 'Salsabila', 'Nabila', 'Zahra', 'Aulia', 'Fitri', 'Keisha', 'Anisa', 'Rahma', 'Citra', 'Laila', 'Intan', 'Amelia', 'Syifa', 'Nadia', 'Tiara']
const LAST = ['Pratama', 'Saputra', 'Hidayat', 'Ramadhan', 'Nugraha', 'Wijaya', 'Kurniawan', 'Maulana', 'Lestari', 'Rahmawati', 'Permata', 'Safitri', 'Anggraini', 'Firmansyah', 'Setiawan', 'Hakim', 'Fauzi', 'Purnama', 'Utami', 'Azzahra']
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

const pick = <T>(rand: () => number, arr: T[]): T => arr[Math.floor(rand() * arr.length)]!
const token = (rand: () => number, len = 32) => Array.from({ length: len }, () => TOKEN_CHARS[Math.floor(rand() * TOKEN_CHARS.length)]).join('')

function randomTime(rand: () => number, fromMin: number, toMin: number): string {
  const m = fromMin + Math.floor(rand() * (toMin - fromMin))
  const s = Math.floor(rand() * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TABLES = ['audit_logs', 'teacher_subjects', 'teaching_sessions', 'lesson_attendances', 'subjects', 'attendance_logs', 'attendances', 'students', 'classes', 'teachers', 'users', 'academic_years', 'holidays', 'settings']
const CHUNK = 400

// Anggota tim PKM sebagai siswa kelas DEMO supaya setiap anggota punya kartu untuk dipindai saat acara.
// Jenis kelamin hanya isian data; ubah di Data Siswa bila perlu.
const TEAM: [string, 'L' | 'P'][] = [
  ['Iftikhaar Imansyah', 'L'],
  ['Amera Alisiya Humaira', 'P'],
  ['Yudha Prabukusuma', 'L'],
  ['Tegar Nugraha', 'L'],
  ['Deta', 'L'],
  ['Intan Wulandari', 'P'],
  ['Rizky', 'L'],
]

type AttendanceRow = typeof schema.attendances.$inferInsert

/** Kosong, atau pengisian data contoh sebelumnya terputus di tengah jalan (penanda seedInProgress masih ada). */
export async function isEmpty(): Promise<boolean> {
  if ((await db.select().from(schema.users).limit(1).all()).length === 0) return true
  return !!(await db.select().from(schema.settings).where(eq(schema.settings.key, 'seedInProgress')).get())
}

async function insertChunked(rows: AttendanceRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) await db.insert(schema.attendances).values(rows.slice(i, i + CHUNK)).run()
}

export async function seed(): Promise<void> {
  const rand = mulberry32(20261014)
  const today = wib().date

  // Logo yang sudah diunggah admin tetap dipertahankan saat data contoh dikembalikan
  const keptLogo = (await db.select().from(schema.settings).where(eq(schema.settings.key, 'schoolLogo')).get())?.value

  await client.executeMultiple(`${TABLES.map((t) => `DELETE FROM ${t};`).join('\n')}\nDELETE FROM sqlite_sequence;`)

  await db
    .insert(schema.settings)
    .values(
      Object.entries({
        schoolName: 'SMP Dharma Bakti',
        schoolAddress: 'Jl. Raya Adiyasa Cisoka, Desa Cikuya, Kec. Solear, Kab. Tangerang, Banten',
        checkInTime: '07:00',
        lateTolerance: '15',
        cutoffTime: '09:00',
        // Dihapus di akhir pengisian. Bila koneksi terputus sebelum selesai, penanda ini membuat pengisian diulang dari nol.
        seedInProgress: '1',
      }).map(([key, value]) => ({ key, value })),
    )
    .run()
  await db.insert(schema.settings).values({ key: 'schoolLogo', value: keptLogo ?? DEFAULT_LOGO }).run()

  const year = await db.insert(schema.academicYears).values({ name: '2025/2026', isActive: true }).returning().get()

  const subjectNames = ['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'Bahasa Inggris', 'PKn', 'PJOK', 'Seni Budaya', 'Prakarya', 'Pendidikan Agama', 'Informatika', 'BK']
  const subjects = await db.insert(schema.subjects).values(subjectNames.map((name) => ({ name }))).returning().all()

  const teacherNames = ['Hj. Siti Rohmah, S.Pd.', 'Dedi Supriadi, S.Pd.', 'Rina Marlina, S.Pd.', 'Agus Salim, S.Kom.', 'Euis Kurniasih, S.Pd.', 'Bambang Hermawan, S.Pd.', 'Yuliani, S.Pd.', 'Asep Sunandar, S.Ag.']
  const teachers = await db
    .insert(schema.teachers)
    .values(teacherNames.map((name, i) => ({ nip: `19${70 + i}0${(i % 9) + 1}1220${10 + i}0${i + 1}100${i}`, name, phone: `0812${String(10000000 + Math.floor(rand() * 89999999))}` })))
    .returning()
    .all()

  const taught: string[][] = [
    ['Matematika', 'Informatika'],
    ['Matematika', 'IPA'],
    ['IPA', 'Bahasa Indonesia', 'Matematika'],
    ['Bahasa Inggris', 'IPA', 'Informatika'],
    ['Bahasa Indonesia', 'PKn'],
    ['IPS', 'PJOK'],
    ['Seni Budaya', 'Prakarya', 'BK'],
    ['Pendidikan Agama', 'PKn'],
  ]
  await db
    .insert(schema.teacherSubjects)
    .values(taught.flatMap((names, i) => names.map((n) => ({ teacherId: teachers[i]!.id, subjectId: subjects.find((s) => s.name === n)!.id }))))
    .run()

  const classDefs: [string, number][] = [['7A', 7], ['7B', 7], ['8A', 8], ['8B', 8], ['9A', 9], ['9B', 9]]
  const classes = await db
    .insert(schema.classes)
    .values(classDefs.map(([name, grade], i) => ({ name, grade, homeroomTeacherId: teachers[i]!.id, academicYearId: year.id })))
    .returning()
    .all()

  const adminHash = hashPassword('admin123')
  const guruHash = hashPassword('guru123')
  const adminUser = await db.insert(schema.users).values({ name: 'Operator TU', username: 'admin', passwordHash: adminHash, role: 'admin' }).returning().get()
  await db
    .insert(schema.users)
    .values(teachers.map((t, i) => ({ name: t.name, username: i === 0 ? 'guru' : `guru${i + 1}`, passwordHash: guruHash, role: 'guru' as const, teacherId: t.id })))
    .run()

  const studentRows: (typeof schema.students.$inferInsert)[] = []
  let nis = 1
  for (const cls of classes) {
    const count = 28 + Math.floor(rand() * 5)
    const used = new Set<string>()
    const batch: (typeof schema.students.$inferInsert)[] = []
    for (let i = 0; i < count; i++) {
      const gender: 'L' | 'P' = rand() < 0.5 ? 'L' : 'P'
      let name = ''
      do name = `${pick(rand, gender === 'L' ? FIRST_M : FIRST_F)} ${pick(rand, LAST)}`
      while (used.has(name))
      used.add(name)
      batch.push({ nis: `${2025 - (cls.grade - 7)}${String(nis++).padStart(4, '0')}`, name, gender, classId: cls.id, qrToken: token(rand) })
    }
    batch.sort((a, b) => a.name.localeCompare(b.name))
    studentRows.push(...batch)
  }
  const students: { id: number; classId: number }[] = []
  for (let i = 0; i < studentRows.length; i += CHUNK) {
    students.push(...(await db.insert(schema.students).values(studentRows.slice(i, i + CHUNK)).returning({ id: schema.students.id, classId: schema.students.classId }).all()))
  }

  // Kelas DEMO: 3 siswa contoh dan 7 anggota tim PKM untuk kartu QR yang dicetak sebelum acara. Token dibuat deterministik
  // dan paling akhir, jadi kartu cetak tetap berlaku walau data di-reset dan tidak mengubah token siswa lain.
  const demoClass = await db.insert(schema.classes).values({ name: 'DEMO', grade: 7, homeroomTeacherId: teachers[6]!.id, academicYearId: year.id }).returning().get()
  const demoStudents = await db
    .insert(schema.students)
    .values([
      { nis: '90001', name: 'Andi Contoh', gender: 'L', classId: demoClass.id, qrToken: token(rand) },
      { nis: '90002', name: 'Bunga Contoh', gender: 'P', classId: demoClass.id, qrToken: token(rand) },
      { nis: '90003', name: 'Candra Contoh', gender: 'L', classId: demoClass.id, qrToken: token(rand) },
      ...TEAM.map(([name, gender], i) => ({ nis: String(90004 + i), name, gender, classId: demoClass.id, qrToken: token(rand) })),
    ])
    .returning({ id: schema.students.id, classId: schema.students.classId })
    .all()

  const holidayDate = addDays(today, -9)
  const holidaySet = new Set<string>()
  if (!isSunday(holidayDate)) {
    await db.insert(schema.holidays).values({ date: holidayDate, description: 'Libur Kegiatan Sekolah' }).run()
    holidaySet.add(holidayDate)
  }

  // Riwayat 30 hari terakhir tanpa Minggu dan hari libur
  const rows: AttendanceRow[] = []
  for (let back = 30; back >= 1; back--) {
    const date = addDays(today, -back)
    if (isSunday(date) || holidaySet.has(date)) continue
    // Siswa kelas DEMO ikut punya riwayat 30 hari agar halaman Cek Kartu tidak kosong; hari ini tetap kosong untuk latihan
    for (const s of [...students, ...demoStudents]) {
      const r = rand()
      let status: AttendanceRow['status']
      let time: string | null = null
      if (r < 0.84) {
        status = 'hadir'
        time = randomTime(rand, 6 * 60 + 20, 7 * 60 + 14)
      } else if (r < 0.91) {
        status = 'terlambat'
        time = randomTime(rand, 7 * 60 + 16, 8 * 60 + 10)
      } else if (r < 0.945) status = 'izin'
      else if (r < 0.975) status = 'sakit'
      else status = 'alpa'
      rows.push({
        studentId: s.id,
        date,
        checkInTime: time,
        status,
        note: status === 'izin' ? 'Acara keluarga' : status === 'sakit' ? 'Surat dari orang tua' : '',
        recordedBy: adminUser.id,
        updatedAt: `${date} ${time ?? '09:00:00'}`,
      })
    }
  }

  // Hari ini: sebagian sudah scan, kecuali kelas 7A (dipakai untuk praktik PKM)
  if (!isSunday(today)) {
    for (const s of students) {
      if (s.classId === classes[0]!.id || rand() > 0.72) continue
      const late = rand() < 0.08
      const time = late ? randomTime(rand, 7 * 60 + 16, 7 * 60 + 40) : randomTime(rand, 6 * 60 + 20, 7 * 60 + 10)
      rows.push({ studentId: s.id, date: today, checkInTime: time, status: late ? 'terlambat' : 'hadir', note: '', recordedBy: adminUser.id, updatedAt: `${today} ${time}` })
    }
  }
  await insertChunked(rows)

  // Contoh pelajaran hari ini di 7B dan 8A: semua hadir di Matematika, tetapi sebagian hadir pagi lalu tidak ada di IPA (bolos).
  if (!isSunday(today)) {
    const mtk = subjects.find((s) => s.name === 'Matematika')!.id
    const ipa = subjects.find((s) => s.name === 'IPA')!.id
    const daily = new Map(rows.filter((r) => r.date === today).map((r) => [r.studentId, r]))
    const demoClassIds = new Set([classes[1]!.id, classes[2]!.id])
    const lessons: (typeof schema.lessonAttendances.$inferInsert)[] = []
    for (const s of students) {
      const d = daily.get(s.id)
      if (!demoClassIds.has(s.classId) || !d || !d.checkInTime) continue
      lessons.push({ studentId: s.id, date: today, subjectId: mtk, status: 'hadir', checkInTime: d.checkInTime, note: '', recordedBy: adminUser.id, updatedAt: `${today} ${d.checkInTime}` })
      const skipped = rand() < 0.12
      lessons.push({
        studentId: s.id,
        date: today,
        subjectId: ipa,
        status: skipped ? 'alpa' : 'hadir',
        checkInTime: skipped ? null : '08:45:00',
        note: skipped ? 'Tidak hadir di pelajaran ini' : '',
        recordedBy: adminUser.id,
        updatedAt: `${today} 08:45:00`,
      })
    }
    for (let i = 0; i < lessons.length; i += CHUNK) await db.insert(schema.lessonAttendances).values(lessons.slice(i, i + CHUNK)).run()

    // Jadwal contoh: 7B dan 8A sudah selesai dua pelajaran, 8B sedang diajar Bahasa Inggris, kelas lain kosong.
    const users = await db.select().from(schema.users).all()
    const guru = (teacherIndex: number) => users.find((u) => u.teacherId === teachers[teacherIndex]!.id)!.id
    const subj = (name: string) => subjects.find((s) => s.name === name)!.id
    const sess = (classIndex: number, subject: string, teacherIndex: number, from: string, to: string | null) => ({
      classId: classes[classIndex]!.id,
      subjectId: subj(subject),
      userId: guru(teacherIndex),
      date: today,
      startedAt: `${today} ${from}`,
      endedAt: to ? `${today} ${to}` : null,
    })
    await db
      .insert(schema.teachingSessions)
      .values([
        sess(1, 'Matematika', 1, '07:00:00', '08:10:00'),
        sess(1, 'IPA', 2, '08:15:00', '09:25:00'),
        sess(2, 'Matematika', 2, '07:00:00', '08:10:00'),
        sess(2, 'IPA', 3, '08:15:00', '09:25:00'),
        sess(3, 'Bahasa Inggris', 3, '07:30:00', null),
      ])
      .run()
  }
  await db.delete(schema.settings).where(eq(schema.settings.key, 'seedInProgress')).run()
}

let ensuring: Promise<void> | null = null

/** Isi data contoh sekali saja jika database masih kosong (aman dipanggil dari banyak permintaan sekaligus). */
export function ensureSeeded(): Promise<void> {
  ensuring ??= isEmpty().then((empty) => {
    if (empty) {
      console.log('Database kosong, mengisi data contoh...')
      return seed()
    }
  })
  return ensuring
}
