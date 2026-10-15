import { handle } from 'hono/vercel'
import { app } from '../../../src/server/app'

// Semua alamat /api/... ditangani satu router (src/server/app.ts) yang berjalan di Node.js, bukan di Edge,
// karena database memakai driver libSQL.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
export const OPTIONS = handle(app)
