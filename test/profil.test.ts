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
const dbFile = `data/test-profil-${process.pid}.db`
process.env.DATABASE_URL = `file:${dbFile}`
delete process.env.SHOW_DEMO_ACCOUNTS

const { app } = await import('../src/server/app')
const { client } = await import('../src/server/db')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
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
const login = (username: string, password: string) => call('POST', '/login', { body: { username, password } })

// PNG 1x1 transparan
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let admin = ''
let guru = ''

before(async () => {
  admin = (await login('admin', 'admin123')).json.token
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

describe('profil sekolah', () => {
  it('nama sekolah dan logo bawaan tersedia tanpa login', async () => {
    const r = await call('GET', '/config')
    assert.equal(r.json.schoolName, 'SMP Dharma Bakti')
    assert.match(r.json.logo, /^data:image\/png;base64,/)
  })
  it('admin menyimpan logo, lalu tampil di konfigurasi publik', async () => {
    assert.equal((await call('PUT', '/settings/logo', { token: admin, body: { logo: PNG } })).status, 200)
    assert.equal((await call('GET', '/config')).json.logo, PNG)
  })
  it('menolak logo yang bukan gambar atau terlalu besar, dan menolak guru', async () => {
    assert.equal((await call('PUT', '/settings/logo', { token: admin, body: { logo: 'data:text/html;base64,PGI+' } })).status, 400)
    const huge = `data:image/png;base64,${'A'.repeat(260_000)}`
    assert.equal((await call('PUT', '/settings/logo', { token: admin, body: { logo: huge } })).status, 400)
    assert.equal((await call('PUT', '/settings/logo', { token: guru, body: { logo: PNG } })).status, 403)
  })
  it('logo tetap ada setelah data contoh dikembalikan', async () => {
    assert.equal((await call('POST', '/demo/reset', { token: admin })).status, 200)
    assert.equal((await call('GET', '/config')).json.logo, PNG)
  })
  it('logo bisa dihapus', async () => {
    assert.equal((await call('PUT', '/settings/logo', { token: admin, body: { logo: null } })).status, 200)
    assert.equal((await call('GET', '/config')).json.logo, null)
  })
})
