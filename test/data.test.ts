import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'

mkdirSync('data', { recursive: true })
for (const f of readdirSync('data').filter((n) => n.startsWith('test-'))) {
  try {
    rmSync(`data/${f}`, { force: true })
  } catch {
    // masih terpakai
  }
}
const dbFile = `data/test-data-${process.pid}.db`
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
  return { status: res.status, json, text }
}
const login = (u: string, p: string, ip = '10.2.0.1') => call('POST', '/login', { body: { username: u, password: p }, ip })

let admin = ''
let guru = ''

before(async () => {
  admin = (await login('admin', 'admin123')).json.token
  const cfg = (await call('GET', '/settings', { token: admin })).json
  await call('PUT', '/settings', { token: admin, body: { ...cfg, practiceMode: true } })
  guru = (await login('guru', 'guru123')).json.token
})

after(() => {
  client.close()
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      rmSync(`${dbFile}${suffix}`, { force: true })
    } catch {
      // dibiarkan
    }
  }
})

const studentCount = async () => ((await call('GET', '/students', { token: admin })).json as Json[]).length

describe('cadangan dan pemulihan', () => {
  let backup: Json
  let before0 = 0

  it('cadangan versi 2 memuat akun dan pengaturan mentah', async () => {
    backup = (await call('GET', '/backup', { token: admin })).json
    before0 = await studentCount()
    assert.equal(backup.version, 2)
    assert.ok(backup.users.length >= 9)
    assert.ok(backup.settingsRaw.some((s: Json) => s.key === 'schoolName'))
  })
  it('guru tidak boleh mengunduh, memulihkan, atau melihat riwayat', async () => {
    assert.equal((await call('GET', '/backup', { token: guru })).status, 403)
    assert.equal((await call('POST', '/restore', { token: guru, body: backup })).status, 403)
    assert.equal((await call('GET', '/audit', { token: guru })).status, 403)
  })
  it('menolak berkas lama tanpa versi atau tanpa akun, data tetap utuh', async () => {
    const { version: _v, ...old } = backup
    void _v
    assert.equal((await call('POST', '/restore', { token: admin, body: old })).status, 400)
    assert.equal((await call('POST', '/restore', { token: admin, body: { ...backup, users: [] } })).status, 400)
    assert.equal(await studentCount(), before0)
  })
  it('berkas rusak membatalkan seluruh pemulihan (atomik)', async () => {
    const broken = structuredClone(backup)
    delete broken.students[0].nis // kolom wajib hilang: database menolak baris ini
    const r = await call('POST', '/restore', { token: admin, body: broken })
    assert.equal(r.status, 400)
    assert.match(r.json.error, /Data Anda tidak diubah/)
    assert.equal(await studentCount(), before0)
    assert.equal((await login('admin', 'admin123', '10.2.0.9')).status, 200)
  })
  it('data yang berubah kembali seperti cadangan setelah dipulihkan', async () => {
    const cls = ((await call('GET', '/classes', { token: admin })).json as Json[])[0]
    assert.equal((await call('POST', '/students', { token: admin, body: { nis: 'BARU1', name: 'Siswa Baru', gender: 'L', classId: cls.id } })).status, 200)
    assert.equal(await studentCount(), before0 + 1)
    assert.equal((await call('POST', '/restore', { token: admin, body: backup })).status, 200)
    assert.equal(await studentCount(), before0)
    assert.equal((await login('guru', 'guru123', '10.2.0.8')).status, 200)
  })
  it('pemulihan tercatat di riwayat perubahan', async () => {
    const log: Json[] = (await call('GET', '/audit', { token: admin })).json
    assert.ok(log.some((l) => l.action === 'Pulihkan dari cadangan'))
  })
})

describe('riwayat perubahan', () => {
  it('perubahan absen pelajaran oleh guru tercatat lengkap dengan nama dan pelaku', async () => {
    const classes: Json[] = (await call('GET', '/classes', { token: admin })).json
    const demo = classes.find((c) => c.name === 'DEMO')
    const stu: Json[] = ((await call('GET', `/students?classId=${demo.id}`, { token: admin })).json as Json[]).filter((s) => s.nis === '90001')
    const mtk = ((await call('GET', '/subjects', { token: admin })).json as Json[]).find((s) => s.name === 'Matematika')
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date())
    assert.equal((await call('PUT', '/lessons', { token: guru, body: { studentId: stu[0].id, subjectId: mtk.id, date, status: 'sakit', note: 'UKS' } })).status, 200)
    const log: Json[] = (await call('GET', '/audit', { token: admin })).json
    const row = log.find((l) => l.action === 'Ubah absen pelajaran')
    assert.match(row.detail, /Andi Contoh/)
    assert.match(row.detail, /Matematika/)
    assert.match(row.detail, /sakit/)
    assert.equal(row.userName, 'Hj. Siti Rohmah, S.Pd.')
  })
})

describe('cek kartu siswa (publik)', () => {
  let token = ''
  before(async () => {
    const demo = ((await call('GET', '/classes', { token: admin })).json as Json[]).find((c) => c.name === 'DEMO')
    token = ((await call('GET', `/students?classId=${demo.id}`, { token: admin })).json as Json[]).find((s) => s.nis === '90001').qrToken
  })

  it('kartu sah menampilkan nama, kelas, hari ini, dan riwayat tanpa membocorkan token', async () => {
    const r = await call('POST', '/cek-kartu', { body: { code: token }, ip: '10.3.0.1' })
    assert.equal(r.json.kind, 'ok')
    assert.equal(r.json.name, 'Andi Contoh')
    assert.equal(r.json.className, 'DEMO')
    assert.ok(Array.isArray(r.json.history))
    assert.ok(!r.text.includes(token))
    assert.ok(!r.text.includes('qrToken'))
  })
  it('NIS saja tidak cukup, hanya kode rahasia di kartu yang diterima', async () => {
    assert.equal((await call('POST', '/cek-kartu', { body: { code: '20250001' }, ip: '10.3.0.2' })).json.kind, 'invalid')
    assert.equal((await call('POST', '/cek-kartu', { body: { code: 'bukan-kartu-kami-sama-sekali' }, ip: '10.3.0.2' })).json.kind, 'invalid')
  })
  it('menahan penebak kode setelah 30 kali salah dari alamat yang sama', async () => {
    for (let i = 0; i < 30; i++) await call('POST', '/cek-kartu', { body: { code: `tebakan-ke-${i}-abcdefgh` }, ip: '10.3.0.3' })
    assert.equal((await call('POST', '/cek-kartu', { body: { code: token }, ip: '10.3.0.3' })).status, 429)
    assert.equal((await call('POST', '/cek-kartu', { body: { code: token }, ip: '10.3.0.4' })).json.kind, 'ok')
  })
})

describe('sistem', () => {
  it('warmup bisa dipanggil tanpa login', async () => {
    const r = await call('GET', '/warmup')
    assert.equal(r.status, 200)
    assert.equal(r.json.ok, true)
  })
  it('penahan login tetap berlaku (disimpan di database)', async () => {
    for (let i = 0; i < 8; i++) await login('admin', 'salah', '10.4.0.1')
    assert.equal((await login('admin', 'admin123', '10.4.0.1')).status, 429)
  })
})
