// Klien API ke server presensi (backend/). Semua halaman hanya memanggil fungsi di file ini.
// Alamat dasar: /api (di mode dev, Vite meneruskan /api ke server di port 3000).

import type {
  AcademicYear,
  Attendance,
  AttendanceLog,
  DailyRow,
  Holiday,
  ScanResult,
  SchoolClass,
  SchoolConfig,
  AuditRow,
  CekKartuResult,
  Settings,
  Status,
  Student,
  Subject,
  Teacher,
  User,
  DayMatrix,
  LessonRow,
  ClassStatus,
  SessionDay,
  TeachingSession,
} from './types'

export const SESSION_KEY = 'presensi-qr-session'
export const SESSION_EXPIRED_EVENT = 'presensi-session-expired'

export class ApiError extends Error {}

interface Session {
  token: string
  user: User
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const s = raw ? (JSON.parse(raw) as Partial<Session>) : null
    return s?.token && s.user ? (s as Session) : null
  } catch {
    return null
  }
}

export function writeSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // browser memblokir penyimpanan: login hanya berlaku selama tab terbuka
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = readSession()?.token
  let res: Response
  // Tanpa batas waktu, sinyal yang macet membuat layar berputar selamanya. Setelah 25 detik tampilkan pesan yang jelas.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25_000)
  let data: { error?: string } | null
  try {
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      })
      data = (await res.json().catch(() => null)) as { error?: string } | null
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new ApiError('Server terlalu lama menjawab. Periksa sinyal atau Wi-Fi, lalu coba lagi.')
      }
      throw new ApiError('Server presensi tidak bisa dihubungi. Periksa sinyal atau Wi-Fi, lalu coba lagi.')
    }
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    throw new ApiError(data?.error ?? 'Terjadi kesalahan. Coba lagi.')
  }
  return data as T
}

const get = <T>(path: string) => request<T>('GET', path)
const send = <T = { ok: true }>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => request<T>(method, path, body ?? (method === 'DELETE' ? undefined : {}))

export const getConfig = () => get<SchoolConfig>('/config')
/** Simpan logo sekolah (data URL) atau hapus dengan null. */
export const setSchoolLogo = (logo: string | null) => send('PUT', '/settings/logo', { logo })

/** Siswa memindai kartunya sendiri untuk melihat kehadirannya (tanpa login). */
export const cekKartu = (code: string) => send<CekKartuResult>('POST', '/cek-kartu', { code })

// ───────────── Riwayat perubahan dan pemulihan ─────────────
export const getAudit = (limit = 60) => get<AuditRow[]>(`/audit?limit=${limit}`)
export const restoreBackup = (backup: unknown) => send('POST', '/restore', backup)


// ───────────── Auth ─────────────
export const login = (username: string, password: string) => send<Session>('POST', '/login', { username, password })
export const changePassword = (oldPassword: string, newPassword: string) => send('PUT', '/me/password', { oldPassword, newPassword })
export const resetTeacherPassword = async (teacherId: number) => (await send<{ password: string }>('POST', `/teachers/${teacherId}/reset-password`)).password

// ───────────── Pengaturan ─────────────
export const getSettings = () => get<Settings>('/settings')
export const saveSettings = (s: Settings) => send('PUT', '/settings', s)
export const getAcademicYears = () => get<AcademicYear[]>('/academic-years')
export const addAcademicYear = (name: string) => send('POST', '/academic-years', { name })
export const activateAcademicYear = (id: number) => send('POST', `/academic-years/${id}/activate`)
export const getHolidays = () => get<Holiday[]>('/holidays')
export const addHoliday = (date: string, description: string) => send('POST', '/holidays', { date, description })
export const deleteHoliday = (id: number) => send('DELETE', `/holidays/${id}`)
export const checkSchoolDay = (date: string) => get<{ open: boolean; reason?: string }>(`/school-day?date=${date}`)

// ───────────── Kelas dan guru ─────────────
export const getClasses = () => get<SchoolClass[]>('/classes')
export const saveClass = (c: Omit<SchoolClass, 'id' | 'academicYearId'> & { id?: number }) =>
  c.id ? send('PUT', `/classes/${c.id}`, c) : send('POST', '/classes', c)
export const deleteClass = (id: number) => send('DELETE', `/classes/${id}`)

export const getTeachers = () => get<Teacher[]>('/teachers')
export const saveTeacher = (t: Omit<Teacher, 'id'> & { id?: number }) => (t.id ? send('PUT', `/teachers/${t.id}`, t) : send('POST', '/teachers', t))
export const deleteTeacher = (id: number) => send('DELETE', `/teachers/${id}`)

// ───────────── Siswa ─────────────
export const getStudents = (classId?: number) => get<Student[]>(`/students${classId ? `?classId=${classId}` : ''}`)
export const saveStudent = (s: Pick<Student, 'nis' | 'name' | 'gender' | 'classId'> & { id?: number }) => {
  const { id, ...body } = s
  return id ? send('PUT', `/students/${id}`, body) : send('POST', '/students', body)
}
export const deleteStudent = (id: number) => send('DELETE', `/students/${id}`)
/** Kartu lama otomatis tidak berlaku. */
export const regenerateQr = (id: number) => send<Student>('POST', `/students/${id}/regenerate-qr`)

export interface ImportRow {
  nis: string
  name: string
  gender: string
  className: string
}
export const importStudents = (rows: ImportRow[]) => send<{ added: number; errors: { row: number; message: string }[] }>('POST', '/students/import', { rows })

// ───────────── Presensi ─────────────
/** code berupa token QR atau NIS (input manual). */
export const scan = (code: string, subjectId?: number) => send<ScanResult>('POST', '/scan', { code, subjectId })
export const getRecentScans = (limit = 10) => get<{ student: Student; className: string; attendance: Attendance }[]>(`/attendances/recent?limit=${limit}`)
export const getDaily = (date: string, classId?: number) => get<DailyRow[]>(`/attendances?date=${date}${classId ? `&classId=${classId}` : ''}`)
export const setStatus = (studentId: number, date: string, status: Status, note: string) => send('PUT', '/attendances', { studentId, date, status, note })
export const getLogs = (attendanceId: number) => get<AttendanceLog[]>(`/attendances/${attendanceId}/logs`)

// ───────────── Mata pelajaran ─────────────
export const getSubjects = () => get<Subject[]>('/subjects')
/** Pelajaran yang boleh diajar pengguna ini (semua jika admin atau belum diatur). */
export const getMySubjects = () => get<Subject[]>('/subjects/mine')
export const addSubject = (name: string) => send('POST', '/subjects', { name })
export const deleteSubject = (id: number) => send('DELETE', `/subjects/${id}`)

/** Siswa satu kelas untuk satu pelajaran hari ini: siapa yang sudah dipindai. */
export const getLessons = (classId: number, subjectId: number, date?: string) =>
  get<LessonRow[]>(`/lessons?classId=${classId}&subjectId=${subjectId}${date ? `&date=${date}` : ''}`)
export const setLesson = (studentId: number, subjectId: number, date: string, status: Status, note: string) =>
  send('PUT', '/lessons', { studentId, subjectId, date, status, note })
export const getLessonDay = (classId: number, date: string) => get<DayMatrix>(`/lessons/day?classId=${classId}&date=${date}`)
export const getLessonRecap = (classId: number, subjectId: number, from: string, to: string) =>
  get<{ dates: string[]; rows: RecapRow[] }>(`/lessons/recap?classId=${classId}&subjectId=${subjectId}&from=${from}&to=${to}`)

// ───────────── Sesi mengajar: ambil kelas dan keluar kelas ─────────────
export const getMySession = () => get<TeachingSession | null>('/sessions/mine')
export const getClassStatuses = () => get<ClassStatus[]>('/sessions/classes')
export const startSession = (classId: number, subjectId: number) => send<TeachingSession>('POST', '/sessions/start', { classId, subjectId })
/** Mengakhiri sesi: kelas jadi kosong. markAbsent=false dipakai admin untuk mengosongkan kelas guru yang lupa keluar. */
export const endSession = (id: number, markAbsent = true) => send<{ marked: number; bolos: number }>('POST', `/sessions/${id}/end`, { markAbsent })
export const getSessionDay = (classId: number, date?: string) => get<SessionDay[]>(`/sessions/day?classId=${classId}${date ? `&date=${date}` : ''}`)

// ───────────── Dashboard dan rekap ─────────────
export interface DashboardData {
  date: string
  open: boolean
  closedReason?: string
  totalStudents: number
  counts: Record<Status, number>
  notYet: number
  perClass: { cls: SchoolClass; homeroom: string; total: number; counts: Record<Status, number>; notYet: number; cells: (Status | null)[]; teaching: { teacherName: string; subjectName: string; since: string } | null }[]
}
export const getDashboard = (date?: string) => get<DashboardData>(`/dashboard${date ? `?date=${date}` : ''}`)

export interface RecapRow {
  student: Student
  byDate: Record<string, Status | null>
  counts: Record<Status, number>
}
export const getRecap = (classId: number | undefined, from: string, to: string) =>
  get<{ dates: string[]; rows: RecapRow[] }>(`/recap?${classId ? `classId=${classId}&` : ''}from=${from}&to=${to}`)

// ───────────── Demo dan cadangan ─────────────
/** Hapus presensi hari ini saja (untuk mengulang praktik scan). */
export const resetToday = async () => (await send<{ removed: number }>('POST', '/demo/reset-today')).removed
/** Kembalikan seluruh data ke data contoh awal. */
export const resetDemo = () => send('POST', '/demo/reset')
export const exportBackup = async () => JSON.stringify(await get<unknown>('/backup'), null, 2)
