import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { promoteNextQueuedJob, FAL_GLOBAL_ID } from '@/lib/fal-queue'
import { syncActiveCounters } from '@/app/api/admin/queue/stats/route'

/**
 * GET /api/cron/drain-queue
 *
 * Called by Vercel Cron every minute (see vercel.json).  Syncs the global
 * concurrency counter from ground truth then fills every free slot from the
 * waiting queue.  This auto-heals counter drift and ensures the queue drains
 * even if a webhook was missed or the app restarted mid-flight.
 */
export async function GET(request: Request) {
  // Protect against arbitrary callers — Vercel sends the CRON_SECRET as a Bearer token
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Sync counters so currentActive reflects reality
    await syncActiveCounters()

    // 2. Read corrected state
    const [globalLimit, queuedCount] = await Promise.all([
      prisma.modelConcurrencyLimit.findUnique({ where: { modelId: FAL_GLOBAL_ID } }),
      prisma.generationQueue.count({ where: { status: 'queued' } }),
    ])

    if (!globalLimit || queuedCount === 0) {
      return NextResponse.json({ success: true, promoted: 0, message: 'Nothing to promote' })
    }

    const freeSlots = Math.max(0, globalLimit.maxConcurrent - globalLimit.currentActive)
    const toPromote = Math.min(freeSlots, queuedCount)

    if (toPromote === 0) {
      return NextResponse.json({
        success: true,
        promoted: 0,
        message: `Queue at capacity (${globalLimit.currentActive}/${globalLimit.maxConcurrent})`,
      })
    }

    // 3. Fill all free slots concurrently.  The retry loop inside
    //    promoteNextQueuedJob ensures each call claims a different job.
    await Promise.all(
      Array.from({ length: toPromote }, () =>
        promoteNextQueuedJob().catch(e => console.error('[cron-drain] promote error:', e))
      )
    )

    console.log(`[cron-drain] Promoted ${toPromote} queued job(s)`)
    return NextResponse.json({ success: true, promoted: toPromote })
  } catch (error) {
    console.error('[cron-drain] Error:', error)
    return NextResponse.json({ error: 'Drain failed' }, { status: 500 })
  }
}
