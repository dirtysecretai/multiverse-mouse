import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { promoteNextQueuedJob, FAL_GLOBAL_ID } from '@/lib/fal-queue'
import { syncActiveCounters } from '@/app/api/admin/queue/stats/route'

// Jobs stuck in 'processing' longer than this are considered dead and are
// automatically reset so their slots can be reused.
const STALE_MINUTES = 30

/**
 * GET /api/cron/drain-queue
 *
 * Called by Vercel Cron every minute (see vercel.json).
 *
 * Safety model:
 *  - Does NOT call syncActiveCounters() unconditionally. That function does a
 *    SET operation which races with webhook DECREMENTs and causes counter drift.
 *  - ONLY calls syncActiveCounters() after forcefully failing confirmed-dead
 *    jobs (> STALE_MINUTES in processing). Those jobs will never receive a
 *    webhook, so no pending DECREMENTs exist — the SET is safe.
 *  - Slot promotion uses the atomic updateMany (currentActive < maxConcurrent)
 *    inside promoteNextQueuedJob, which is safe under concurrent webhook calls.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 1. Reset stale jobs ──────────────────────────────────────────────────
    // Mark any job that has been in 'processing' for > STALE_MINUTES as failed.
    // These jobs will never receive a webhook callback (FAL timeout is < 30 min),
    // so their slots are permanently leaked.  After failing them it is safe to
    // sync the counter because no in-flight webhook decrements exist for them.
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000)

    const staleJobs = await prisma.generationQueue.findMany({
      where: { status: 'processing', startedAt: { lt: staleThreshold } },
      select: { id: true },
    })

    let staleReset = 0
    if (staleJobs.length > 0) {
      await prisma.generationQueue.updateMany({
        where: { id: { in: staleJobs.map(j => j.id) } },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: `Auto-reset by cron: stuck in processing for ${STALE_MINUTES}+ minutes`,
        },
      })
      // Safe to sync here — no pending webhook decrements for these dead jobs
      await syncActiveCounters()
      staleReset = staleJobs.length
      console.log(`[cron-drain] Reset ${staleReset} stale job(s) and synced counters`)
    }

    // ── 2. Promote queued jobs into free slots ───────────────────────────────
    // Read current state.  If stale reset happened the counter was just synced;
    // otherwise we trust the stored counter (avoid the SET/DECREMENT race).
    const [globalLimit, queuedCount] = await Promise.all([
      prisma.modelConcurrencyLimit.findUnique({ where: { modelId: FAL_GLOBAL_ID } }),
      prisma.generationQueue.count({ where: { status: 'queued' } }),
    ])

    if (!globalLimit || queuedCount === 0) {
      return NextResponse.json({ success: true, staleReset, promoted: 0 })
    }

    const freeSlots = Math.max(0, globalLimit.maxConcurrent - globalLimit.currentActive)
    const toPromote = Math.min(freeSlots, queuedCount)

    if (toPromote === 0) {
      return NextResponse.json({
        success: true,
        staleReset,
        promoted: 0,
        message: `Queue at capacity (${globalLimit.currentActive}/${globalLimit.maxConcurrent})`,
      })
    }

    // Fill all free slots concurrently.  The retry loop inside promoteNextQueuedJob
    // ensures each concurrent call claims a different queued job.
    await Promise.all(
      Array.from({ length: toPromote }, () =>
        promoteNextQueuedJob().catch(e => console.error('[cron-drain] promote error:', e))
      )
    )

    console.log(`[cron-drain] Promoted ${toPromote} queued job(s)`)
    return NextResponse.json({ success: true, staleReset, promoted: toPromote })
  } catch (error) {
    console.error('[cron-drain] Error:', error)
    return NextResponse.json({ error: 'Drain failed' }, { status: 500 })
  }
}
