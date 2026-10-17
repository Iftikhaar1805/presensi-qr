import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'

mkdirSync('data', { recursive: true })

// Database khusus pengujian, dibuat dari nol (termasuk data contoh) lalu dihapus
for (const f of readdirSync('data').filter((n) => n.startsWith('test-'))) {
  try {
    rmSync(`data/${f}`, { force: true })
  } catch {
    // masih terpakai
  }
}
const dbFile = `data/test-${process.pid}.db`
process.env.DATABASE_URL = `file:${dbFile}`
delete process.env.SHOW_DEMO_ACCOUNTS

const { app } = await import('../src/server/app')
const { client } = await import('../src/server/db')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

async function call(method: string, path: string, opts: { token?: string; body?: unknown; ip?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  if (opts.ip) headers['x-forwarded-for'] = opts.ip
  const res = await app.request(`/api${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  const text = await res.text()
  let json: Json = null
  try {
    json = JSON.parse(text)
  } catch {
    // bukan JSON
  }
  return { status: res.status, json }
}

const login = (username: string, password: string, ip = '10.0.0.1') => call('POST', '/login', { body: { username, password }, ip })

let admin = ''
let teacherA = ''
let teacherB = ''
let classes: Json[] = []
let demoClass: Json
let takenClass: Json
let mtk: Json
let ipa: Json
let demoStudents: Json[] = []
let today = ''

before(async () => {
  admin = (await login('admin', 'admin123')).json.token
  // Mode latihan: tes tidak boleh gagal hanya karena dijalankan pada hari Minggu atau hari libur
  const cfg = (await call('GET', '/settings', { token: admin })).json
  await call('PUT', '/settings', { token: admin, body: { ...cfg, practiceMode: true } })
  classes = (await call('GET', '/classes', { token: admin })).json
  const subjects: Json[] = (await call('GET', '/subjects', { token: admin })).json
  demoClass = classes.find((c) => c.name === 'DEMO')
  takenClass = classes.find((c) => c.name === '8B')
  mtk = subjects.find((s) => s.name === 'Matematika')
  ipa = subjects.find((s) => s.name === 'IPA')
  demoStudents = (await call('GET', `/students?classId=${demoClass.id}`, { token: admin })).json
  // Tanggal hari ini (WIB), sama dengan yang dipakai server
  today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date())

  // Dua guru baru yang bersih: A hanya Matematika, B Matematika dan IPA
  for (const [username, ids] of [['uji_a', [mtk.id]], ['uji_b', [mtk.id, ipa.id]]] as const) {
    const r = await call('POST', '/teachers', { token: admin, body: { name: `Guru ${username}`, username, subjectIds: ids } })
    assert.equal(r.status, 200, JSON.stringify(r.json))
  }
  teacherA = (await login('uji_a', 'guru123', '10.0.0.2')).json.token
  teacherB = (await login('uji_b', 'guru123', '10.0.0.3')).json.token
})

after(() => {
  client.close()
  // Di Windows berkas bisa masih terkunci sesaat; sisa berkas uji dibersihkan pada kali berikutnya
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      rmSync(`${dbFile}${suffix}`, { force: true })
    } catch {
      // dibiarkan
    }
  }
})

describe('akses dan login', () => {
  it('/config menyembunyikan akun contoh secara bawaan', async () => {
    assert.equal((await call('GET', '/config')).json.demoAccounts, false)
  })
  it('menolak password salah dan permintaan tanpa token', async () => {
    assert.equal((await login('admin', 'salah', '10.1.1.1')).status, 401)
    assert.equal((await call('GET', '/students')).status, 401)
  })
  it('menandai password bawaan sebagai lemah', async () => {
    assert.equal((await login('admin', 'admin123', '10.1.1.2')).json.user.weakPassword, true)
  })
  it('menahan tebakan password setelah 8 kali salah, hanya untuk alamat yang sama', async () => {
    for (let i = 0; i < 8; i++) assert.equal((await login('guru', 'tebak', '10.9.9.9')).status, 401)
    const blocked = await login('guru', 'guru123', '10.9.9.9')
    assert.equal(blocked.status, 429)
    assert.match(blocked.json.error, /Terlalu banyak percobaan/)
    assert.equal((await login('guru', 'guru123', '10.9.9.10')).status, 200)
  })
  it('guru tidak boleh mengubah data master', async () => {
    assert.equal((await call('POST', '/students', { token: teacherA, body: { nis: '1', name: 'X', gender: 'L', classId: demoClass.id } })).status, 403)
    assert.equal((await call('GET', '/teachers', { token: teacherA })).status, 403)
    assert.equal((await call('POST', '/demo/reset', { token: teacherA })).status, 403)
  })
})

describe('mengajar dan memindai', () => {
  let sessionA: Json

  it('menolak memindai sebelum mengambil kelas', async () => {
    assert.equal((await call('POST', '/scan', { token: teacherA, body: { code: demoStudents[0].qrToken } })).status, 409)
  })
  it('menolak pelajaran yang tidak diampu', async () => {
    const r = await call('POST', '/sessions/start', { token: teacherA, body: { classId: demoClass.id, subjectId: ipa.id } })
    assert.equal(r.status, 403)
    assert.match(r.json.error, /bukan pelajaran yang Anda ampu/)
  })
  it('hanya menawarkan pelajaran yang diampu', async () => {
    const mine: Json[] = (await call('GET', '/subjects/mine', { token: teacherA })).json
    assert.deepEqual(mine.map((s) => s.id), [mtk.id])
  })
  it('guru mengambil kelas kosong', async () => {
    const r = await call('POST', '/sessions/start', { token: teacherA, body: { classId: demoClass.id, subjectId: mtk.id } })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    sessionA = r.json
  })
  it('kelas yang sedang diajar tidak bisa diambil guru lain', async () => {
    const r = await call('POST', '/sessions/start', { token: teacherB, body: { classId: demoClass.id, subjectId: mtk.id } })
    assert.equal(r.status, 409)
    assert.match(r.json.error, /sedang diajar/)
  })
  it('satu guru tidak bisa memegang dua kelas', async () => {
    const other = classes.find((c) => c.name === '7A')
    const r = await call('POST', '/sessions/start', { token: teacherA, body: { classId: other.id, subjectId: mtk.id } })
    assert.equal(r.status, 409)
    assert.match(r.json.error, /Akhiri pelajaran itu dulu/)
  })
  it('memindai QR: hadir, lalu duplikat, lalu tidak dikenali', async () => {
    const ok = await call('POST', '/scan', { token: teacherA, body: { code: demoStudents[0].qrToken } })
    assert.equal(ok.json.kind, 'ok')
    assert.equal(ok.json.subjectName, 'Matematika')
    assert.equal((await call('POST', '/scan', { token: teacherA, body: { code: demoStudents[0].qrToken } })).json.kind, 'duplicate')
    assert.equal((await call('POST', '/scan', { token: teacherA, body: { code: 'bukan-kartu-kami' } })).json.kind, 'invalid')
  })
  it('memindai lewat NIS bila kartu tertinggal', async () => {
    assert.equal((await call('POST', '/scan', { token: teacherA, body: { code: demoStudents[1].nis } })).json.kind, 'ok')
  })
  it('guru bisa mengoreksi status siswa di pelajarannya', async () => {
    const r = await call('PUT', '/lessons', { token: teacherA, body: { studentId: demoStudents[1].id, subjectId: mtk.id, date: sessionA.date, status: 'sakit', note: 'UKS' } })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    const rows: Json[] = (await call('GET', `/lessons?classId=${demoClass.id}&subjectId=${mtk.id}&date=${sessionA.date}`, { token: teacherA })).json
    assert.equal(rows.find((x) => x.student.id === demoStudents[1].id).lesson.status, 'sakit')
  })
  it('mengakhiri pelajaran menandai yang belum dipindai sebagai tidak hadir dan mengosongkan kelas', async () => {
    const r = await call('POST', `/sessions/${sessionA.id}/end`, { token: teacherA, body: {} })
    assert.equal(r.status, 200)
    assert.equal(r.json.marked, demoStudents.length - 2) // sisanya belum dipindai
    const board: Json[] = (await call('GET', '/sessions/classes', { token: teacherA })).json
    assert.equal(board.find((x) => x.cls.id === demoClass.id).active, null)
  })
  it('pelajaran yang sama tidak bisa diakhiri dua kali', async () => {
    assert.equal((await call('POST', `/sessions/${sessionA.id}/end`, { token: teacherA, body: {} })).status, 404)
  })
  it('hanya pemilik sesi atau admin yang bisa mengakhiri sesi', async () => {
    const r = await call('POST', '/sessions/start', { token: teacherB, body: { classId: demoClass.id, subjectId: mtk.id } })
    assert.equal(r.status, 200)
    assert.equal((await call('POST', `/sessions/${r.json.id}/end`, { token: teacherA, body: {} })).status, 403)
    assert.equal((await call('POST', `/sessions/${r.json.id}/end`, { token: admin, body: { markAbsent: false } })).status, 200)
  })
  it('kelas kedua yang sedang diajar juga tidak bisa direbut guru lain', async () => {
    // tidak bergantung pada data contoh hari ini (yang kosong pada hari Minggu)
    const own = await call('POST', '/sessions/start', { token: teacherA, body: { classId: takenClass.id, subjectId: mtk.id } })
    assert.equal(own.status, 200, JSON.stringify(own.json))
    const r = await call('POST', '/sessions/start', { token: teacherB, body: { classId: takenClass.id, subjectId: mtk.id } })
    assert.equal(r.status, 409)
    assert.equal((await call('POST', `/sessions/${own.json.id}/end`, { token: teacherA, body: {} })).status, 200)
  })
})

describe('bolos dan rekap per pelajaran', () => {
  it('siswa hadir di Matematika tetapi tidak dipindai di IPA terhitung bolos', async () => {
    const s = await call('POST', '/sessions/start', { token: teacherB, body: { classId: demoClass.id, subjectId: ipa.id } })
    assert.equal(s.status, 200, JSON.stringify(s.json))
    const end = await call('POST', `/sessions/${s.json.id}/end`, { token: teacherB, body: {} })
    assert.equal(end.status, 200)
    assert.equal(end.json.bolos, 2) // dua siswa sudah hadir hari ini, ketiga belum pernah dipindai

    const day = (await call('GET', `/lessons/day?classId=${demoClass.id}&date=${today}`, { token: admin })).json
    const row = day.rows.find((r: Json) => r.student.id === demoStudents[0].id)
    assert.deepEqual(row.bolos, ['IPA'])
    assert.equal(row.byLesson[mtk.id], 'hadir')
  })
  it('jadwal kelas hari ini mencatat siapa mengajar apa', async () => {
    const list: Json[] = (await call('GET', `/sessions/day?classId=${demoClass.id}&date=${today}`, { token: admin })).json
    assert.ok(list.length >= 3)
    assert.ok(list.every((x) => x.endedAt))
  })
})

describe('data siswa dan kartu', () => {
  it('membuat ulang QR satu siswa membuat token lama tidak berlaku', async () => {
    const before = demoStudents[2].qrToken
    const r = await call('POST', `/students/${demoStudents[2].id}/regenerate-qr`, { token: admin })
    assert.equal(r.status, 200)
    const after: Json[] = (await call('GET', `/students?classId=${demoClass.id}`, { token: admin })).json
    const now = after.find((s) => s.id === demoStudents[2].id)
    assert.notEqual(now.qrToken, before)
    // token lama tidak dikenali lagi
    const s = await call('POST', '/sessions/start', { token: teacherA, body: { classId: demoClass.id, subjectId: mtk.id } })
    assert.equal((await call('POST', '/scan', { token: teacherA, body: { code: before } })).json.kind, 'invalid')
    assert.equal((await call('POST', '/scan', { token: teacherA, body: { code: now.qrToken } })).json.kind, 'ok')
    await call('POST', `/sessions/${s.json.id}/end`, { token: teacherA, body: {} })
  })
  it('NIS ganda ditolak', async () => {
    const r = await call('POST', '/students', { token: admin, body: { nis: demoStudents[0].nis, name: 'Ganda', gender: 'L', classId: demoClass.id } })
    assert.ok(r.status === 400 || r.status === 409, String(r.status))
  })
})
