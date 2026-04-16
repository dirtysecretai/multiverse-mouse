import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { promoteNextQueuedJob, FAL_GLOBAL_ID } from '@/lib/fal-queue'
import { syncActiveCounters } from '../stats/route'

/**
 * POST /api/admin/queue/recover
 *
 * Re-queues all stuck 'processing' jobs so they get re-submitted to FAL.
 *
 * Use when FAL shows 0 active but our DB shows N processing — meaning FAL
 * finished/dropped those jobs without our webhook handler recording the result
 * (typically: 40 webhooks arrived simultaneously and overwhelmed the DB pool).
 *
 * Safety: does NOT refund ticket reservations — the original reservation stays
 * intact so users aren't double-charged when the job re-runs successfully.
 * Only call when FAL is genuinely at 0 active for the stuck jobs; if any are
 * still running at FAL, re-queuing them causes a duplicate submission.
 */
export async function POST() {
  try {
    // Find all jobs stuck in processing
    const stuckJobs = await prisma.generationQueue.findMany({
      where: { status: 'processing' },
      select: { id: true, modelId: true, userId: true },
    })

    if (stuckJobs.length === 0) {
      return NextResponse.json({ success: true, requeued: 0, message: 'No processing jobs to recover' })
    }

    // Re-queue them: clear falRequestId + startedAt so they act like fresh queue entries
    await prisma.generationQueue.updateMany({
      where: { id: { in: stuckJobs.map(j => j.id) } },
      data: {
        status: 'queued',
        startedAt: null,
        falRequestId: null,
        errorMessage: null,
      },
    })

    // Sync all counters to ground truth (all processing rows are now gone → counters → 0)
    await syncActiveCounters()

    // Read how many free slots are available and how many jobs are waiting
    const [globalLimit, queuedCount] = await Promise.all([
      prisma.modelConcurrencyLimit.findUnique({ where: { modelId: FAL_GLOBAL_ID } }),
      prisma.generationQueue.count({ where: { status: 'queued' } }),
    ])

    let promoted = 0
    if (globalLimit && queuedCount > 0) {
      const freeSlots = Math.max(0, globalLimit.maxConcurrent - globalLimit.currentActive)
      const toPromote = Math.min(freeSlots, queuedCount)

      if (toPromote > 0) {
        await Promise.all(
          Array.from({ length: toPromote }, () =>
            promoteNextQueuedJob().catch(e => console.error('[recover] promote error:', e))
          )
        )
        promoted = toPromote
      }
    }

    return NextResponse.json({
      success: true,
      requeued: stuckJobs.length,
      promoted,
      message: `Re-queued ${stuckJobs.length} stuck job(s) and kicked ${promoted} into processing`,
    })
  } catch (error) {
    console.error('[recover] Error:', error)
    return NextResponse.json({ error: 'Recovery failed' }, { status: 500 })
  }
}
