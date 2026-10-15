import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import type { Context, Next } from 'hono'
import { sign, verify } from 'hono/jwt'
import { db, schema } from './db'

export type Role = 'admin' | 'guru'

export interface AuthUser {
  id: number
  name: string
  username: string
  role: Role
  teacherId: number | null
}

export type Env = { Variables: { user: AuthUser } }

const SCRYPT_N = 4096 // cukup untuk demo lokal, hash ±5 ms

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32, { N: SCRYPT_N }).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = scryptSync(password, salt, 32, { N: SCRYPT_N })
  const known = Buffer.from(hash, 'hex')
  return known.length === test.length && timingSafeEqual(known, test)
}

/**
 * Kunci tanda tangan token: dari env JWT_SECRET (wajib di hosting), atau dibuat sekali dan
 * disimpan di data/jwt-secret untuk pemakaian lokal. Jika disk tidak bisa ditulis dan env kosong,
 * kunci sementara dipakai sehingga semua orang harus masuk lagi tiap server dimulai ulang.
 */
function loadSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const file = 'data/jwt-secret'
  try {
    if (existsSync(file)) return readFileSync(file, 'utf8').trim()
    mkdirSync('data', { recursive: true })
    const s = randomBytes(32).toString('hex')
    writeFileSync(file, s)
    return s
  } catch {
    console.warn('JWT_SECRET belum diatur dan disk tidak bisa ditulis. Memakai kunci sementara.')
    return randomBytes(32).toString('hex')
  }
}
const SECRET = loadSecret()
const TOKEN_HOURS = 12

export async function issueToken(u: AuthUser): Promise<string> {
  return sign({ sub: String(u.id), exp: Math.floor(Date.now() / 1000) + TOKEN_HOURS * 3600 }, SECRET, 'HS256')
}

export async function requireAuth(c: Context<Env>, next: Next) {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return c.json({ error: 'Silakan masuk terlebih dahulu.' }, 401)
  try {
    const payload = await verify(token, SECRET, 'HS256')
    const row = await db.select().from(schema.users).where(eq(schema.users.id, Number(payload.sub))).get()
    if (!row) return c.json({ error: 'Akun tidak ditemukan. Silakan masuk lagi.' }, 401)
    c.set('user', { id: row.id, name: row.name, username: row.username, role: row.role as Role, teacherId: row.teacherId })
  } catch {
    return c.json({ error: 'Sesi habis. Silakan masuk lagi.' }, 401)
  }
  await next()
}

export function requireRole(...roles: Role[]) {
  return async (c: Context<Env>, next: Next) => {
    if (!roles.includes(c.get('user').role)) return c.json({ error: 'Anda tidak punya akses ke fitur ini.' }, 403)
    await next()
  }
}
