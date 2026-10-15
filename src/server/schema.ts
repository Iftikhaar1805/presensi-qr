import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

// Tabel mengikuti PRD §9. Nama kolom camelCase mengikuti bentuk JSON di frontend.

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'guru', 'siswa'] }).notNull(),
  teacherId: integer('teacher_id'),
  studentId: integer('student_id'),
})

export const academicYears = sqliteTable('academic_years', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
})

export const teachers = sqliteTable('teachers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nip: text('nip').notNull().default(''),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
})

export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  grade: integer('grade').notNull(),
  homeroomTeacherId: integer('homeroom_teacher_id'),
  academicYearId: integer('academic_year_id').notNull(),
})

export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nis: text('nis').notNull().unique(),
  name: text('name').notNull(),
  gender: text('gender', { enum: ['L', 'P'] }).notNull(),
  classId: integer('class_id').notNull(),
  qrToken: text('qr_token').notNull().unique(),
})

export const attendances = sqliteTable(
  'attendances',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id').notNull(),
    date: text('date').notNull(),
    checkInTime: text('check_in_time'),
    status: text('status', { enum: ['hadir', 'terlambat', 'izin', 'sakit', 'alpa'] }).notNull(),
    note: text('note').notNull().default(''),
    recordedBy: integer('recorded_by'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [unique('uniq_student_date').on(t.studentId, t.date)],
)

export const attendanceLogs = sqliteTable('attendance_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  attendanceId: integer('attendance_id').notNull(),
  oldStatus: text('old_status'),
  newStatus: text('new_status').notNull(),
  note: text('note').notNull().default(''),
  changedBy: integer('changed_by').notNull(),
  changedByName: text('changed_by_name').notNull(),
  at: text('at').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const holidays = sqliteTable('holidays', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  description: text('description').notNull(),
})

// Mata pelajaran dan kehadiran per pelajaran. Kehadiran harian (attendances) tetap ada;
// kehadiran per pelajaran dipakai untuk mendeteksi siswa yang hadir pagi lalu bolos di jam berikutnya.
export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const lessonAttendances = sqliteTable(
  'lesson_attendances',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id').notNull(),
    date: text('date').notNull(),
    subjectId: integer('subject_id').notNull(),
    status: text('status', { enum: ['hadir', 'izin', 'sakit', 'alpa'] }).notNull(),
    checkInTime: text('check_in_time'),
    note: text('note').notNull().default(''),
    recordedBy: integer('recorded_by'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [unique('uniq_lesson').on(t.studentId, t.date, t.subjectId)],
)

// Sesi mengajar: guru "mengambil" kelas (dengan mata pelajaran), memindai selama mengajar, lalu mengakhiri.
// Satu kelas hanya punya satu sesi aktif (endedAt kosong) pada satu waktu, begitu juga satu guru.
export const teachingSessions = sqliteTable('teaching_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  userId: integer('user_id').notNull(),
  date: text('date').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  endedBy: integer('ended_by'),
})

// Mata pelajaran yang diampu tiap guru. Guru tanpa catatan di sini boleh memilih semua pelajaran.
export const teacherSubjects = sqliteTable(
  'teacher_subjects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teacherId: integer('teacher_id').notNull(),
    subjectId: integer('subject_id').notNull(),
  },
  (t) => [unique('uniq_teacher_subject').on(t.teacherId, t.subjectId)],
)

// Riwayat perubahan penting (siapa mengubah apa dan kapan) untuk kehadiran per pelajaran, kehadiran guru, kartu, dan pemulihan data.
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: text('at').notNull(),
  userId: integer('user_id'),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull().default(''),
})

// Percobaan masuk yang gagal, disimpan di database agar pembatasnya tetap bekerja di hosting serverless.
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  n: integer('n').notNull(),
  firstAt: integer('first_at').notNull(),
})
