import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'

mkdirSync('data', { recursive: true })
const dbFile = `data/test-race-${process.pid}.db`
process.env.DATABASE_URL = `file:${dbFile}`
delete process.env.SHOW_DEMO_ACCOUNTS

const { app } = await import('../src/server/app')
const { client } = await import('../src/server/db')

// Meniru Turso: tiap query menempuh jaringan (5-30 ms), sehingga permintaan serentak benar-benar saling menyela.
// Tanpa ini, database file lokal menjawab seketika dan celah balapan tidak pernah terlihat.
const realExecute = client.execute.bind(client)
;(client as unknown as { execute: typeof client.execute }).execute = (async (...args: Parameters<typeof client.execute>) => {
  await new Promise((r) => setTimeout(r, 5 + Math.random() * 25))
  return realExecute(...args)
}) as typeof client.execute

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any
async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await app.request(`/api${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: res.status, json: (await res.json().catch(() => null)) as Json }
}

let admin = ''
let guruA = ''
let guruB = ''
let classes: Json[] = []
let mtk: Json
let ipa: Json

before(async () => {
  admin = (await call('POST', '/login', undefined, { username: 'admin', password: 'admin123' })).json.token
  const cfg = (await call('GET', '/settings', admin)).json
  await call('PUT', '/settings', admin, { ...cfg, practiceMode: true })
  classes = (await call('GET', '/classes', admin)).json
  const subjects: Json[] = (await call('GET', '/subjects', admin)).json
  mtk = subjects.find((s) => s.name === 'Matematika')
  ipa = subjects.find((s) => s.name === 'IPA')
  for (const u of ['balap_a', 'balap_b']) await call('POST', '/teachers', admin, { name: u, username: u, subjectIds: [] })
  guruA = (await call('POST', '/login', undefined, { username: 'balap_a', password: 'guru123' })).json.token
  guruB = (await call('POST', '/login', undefined, { username: 'balap_b', password: 'guru123' })).json.token
})

after(() => {
  client.close()
  for (const s of ['', '-shm', '-wal']) {
    try {
      rmSync(`${dbFile}${s}`, { force: true })
    } catch {
      // dibiarkan
    }
  }
})

describe('pindaian serentak (balapan)', () => {
  it('kartu sama dipindai 8 kali bersamaan: tepat satu tercatat, sisanya sudah absen, tanpa galat 500', async () => {
    const demo = classes.find((c) => c.name === 'DEMO')
    const st = (await call('GET', `/students?classId=${demo.id}`, admin)).json[0]
    const s = await call('POST', '/sessions/start', guruA, { classId: demo.id, subjectId: mtk.id })
    assert.equal(s.status, 200, JSON.stringify(s.json))
    const res = await Promise.all(Array.from({ length: 8 }, () => call('POST', '/scan', guruA, { code: st.qrToken })))
    const kinds = res.map((r) => (r.status === 200 ? r.json.kind : `HTTP ${r.status}`))
    assert.deepEqual(kinds.filter((k) => k === 'ok').length, 1, JSON.stringify(kinds))
    assert.deepEqual(kinds.filter((k) => k === 'duplicate').length, 7, JSON.stringify(kinds))
    await call('POST', `/sessions/${s.json.id}/end`, guruA, { markAbsent: false })
  })

  it('siswa sama dipindai bersamaan di dua kelas: kehadiran harian dibuat sekali, keduanya berhasil', async () => {
    const c1 = classes.find((c) => c.name === '7A')
    const c2 = classes.find((c) => c.name === '9A')
    const st = (await call('GET', `/students?classId=${c1.id}`, admin)).json[5]
    const s1 = await call('POST', '/sessions/start', guruA, { classId: c1.id, subjectId: mtk.id })
    const s2 = await call('POST', '/sessions/start', guruB, { classId: c2.id, subjectId: ipa.id })
    const res = await Promise.all([call('POST', '/scan', guruA, { code: st.qrToken }), call('POST', '/scan', guruB, { code: st.qrToken })])
    assert.deepEqual(res.map((r) => (r.status === 200 ? r.json.kind : `HTTP ${r.status} ${r.json?.error}`)), ['ok', 'ok'])
    await call('POST', `/sessions/${s1.json.id}/end`, guruA, { markAbsent: false })
    await call('POST', `/sessions/${s2.json.id}/end`, guruB, { markAbsent: false })
  })
})
