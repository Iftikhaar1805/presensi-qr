export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VERCEL || process.env.NEXT_PHASE === 'phase-production-build') return
  const { runAutoAlpaToday, prepareDatabase } = await import('./server/app')
  await prepareDatabase().catch(() => undefined)
  const timer = setInterval(() => void runAutoAlpaToday().catch(() => undefined), 60_000)
  timer.unref?.()
}
