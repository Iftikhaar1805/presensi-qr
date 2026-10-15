// Tipe data mengikuti struktur tabel di PRD §9.
// Saat backend Laravel siap, respons API cukup mengikuti bentuk ini.

export type Role = 'admin' | 'guru'

export type Status = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alpa'

export interface User {
  id: number
  name: string
  username: string
  role: Role
  teacherId?: number
  /** Hanya diisi saat masuk: true jika masih memakai password bawaan */
  weakPassword?: boolean
}

export interface AcademicYear {
  id: number
  name: string
  isActive: boolean
}

export interface SchoolClass {
  id: number
  name: string
  grade: number
  homeroomTeacherId: number | null
  academicYearId: number
}

export interface Teacher {
  id: number
  nip: string
  name: string
  phone: string
  username: string
  /** Mata pelajaran yang diampu. Kosong = boleh semua. */
  subjectIds: number[]
}

export interface Student {
  id: number
  nis: string
  name: string
  gender: 'L' | 'P'
  classId: number
  className: string
  qrToken: string
}

export interface Attendance {
  id: number
  studentId: number
  date: string // YYYY-MM-DD
  checkInTime: string | null // HH:mm:ss
  status: Status
  note: string
  recordedBy: number | null
  updatedAt: string
}

export interface AttendanceLog {
  id: number
  attendanceId: number
  oldStatus: Status | null
  newStatus: Status
  note: string
  changedBy: number
  changedByName: string
  at: string
}

export interface Settings {
  schoolName: string
  schoolAddress: string
  checkInTime: string // HH:mm
  lateTolerance: number // menit
  cutoffTime: string // HH:mm — setelah ini yang belum scan = alpa
}

export interface Holiday {
  id: number
  date: string
  description: string
}

/** Satu baris di rekap harian: siswa + presensinya (null = belum scan) */
export interface DailyRow {
  student: Student
  attendance: Attendance | null
  /** true jika pengguna ini boleh mengubah status siswa tersebut (admin atau wali kelasnya) */
  canEdit: boolean
}

/** Guru yang sedang mengajar di satu kelas. Selama sesi berjalan kelas itu tidak bisa diambil guru lain. */
export interface TeachingSession {
  id: number
  classId: number
  className: string
  subjectId: number
  subjectName: string
  userId: number
  teacherName: string
  date: string
  startedAt: string
  endedAt: string | null
}

export interface ClassStatus {
  cls: { id: number; name: string; grade: number }
  homeroom: string
  active: TeachingSession | null
  finishedToday: number
}

export interface SessionDay extends TeachingSession {
  hadir: number
  izin: number
  sakit: number
  alpa: number
  total: number
}

export interface Subject {
  id: number
  name: string
}

/** Kehadiran satu siswa di satu mata pelajaran pada satu hari */
export interface LessonRecord {
  id: number
  studentId: number
  date: string
  subjectId: number
  status: Status
  checkInTime: string | null
  note: string
  recordedBy: number | null
  updatedAt: string
}

export interface LessonRow {
  student: Student
  lesson: LessonRecord | null
  daily: Attendance | null
}

/** Tabel harian untuk wali kelas: siswa x pelajaran. `bolos` berisi pelajaran yang dilewati padahal hadir pagi. */
export interface DayMatrix {
  subjects: Subject[]
  rows: { student: Student; daily: Status | null; byLesson: Record<number, Status | null>; bolos: string[] }[]
}

export type ScanResult =
  | { kind: 'ok'; student: Student; attendance: Attendance; className: string; subjectName?: string }
  | { kind: 'duplicate'; student: Student; attendance: Attendance; className: string; subjectName?: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'closed'; message: string }

export interface SchoolConfig {
  demoAccounts: boolean
  schoolName: string
  logo: string | null
}

export type CekKartuResult =
  | { kind: 'invalid'; message: string }
  | {
      kind: 'ok'
      name: string
      nis: string
      className: string
      today: { status: Status; checkInTime: string | null } | null
      lessons: { subjectName: string; status: string; checkInTime: string | null }[]
      history: { date: string; status: Status }[]
    }

export interface AuditRow {
  id: number
  at: string
  userName: string
  action: string
  detail: string
}
