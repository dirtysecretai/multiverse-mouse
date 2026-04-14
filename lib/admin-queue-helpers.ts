/**
 * admin-queue-helpers.ts
 *
 * Shared helpers for admin portal-v2 status routes (NB2, Kling, Video).
 * These routes use polling rather than FAL webhooks, so they must manually
 * decrement the global concurrency counter and promote the next queued job
 * when a generation completes or fails.
 */

import prisma from '@/lib/prisma'
import { FAL_GLOBAL_ID, promoteNextQueuedJob } from '@/lib/fal-queue'

/**
 * Syncs the global FAL concurrency counter from ground truth (actual DB count of
 * 'processing' rows), then atomically claims a slot.
 *
 * Why sync first: the counter can drift upward when a serverless function times
 * out, crashes, or loses its DB connection after incrementing but before the
 * corresponding decrement — leaving the counter permanently inflated.  An inflated
 * counter causes subsequent submissions to be falsely queued even when FAL has
 * plenty of capacity.  Syncing at submit time self-heals any drift without needing
 * a manual admin action.
 *
 * Returns { claimed: true } when a slot was successfully reserved, or
 * { claimed: false } when the queue is genuinely at capacity.
 */
export async function syncAndClaimFalSlot(): Promise<{ claimed: boolean; maxConcurrent: number }> {
  const globalLimit = await prisma.modelConcurrencyLimit.findUnique({ where: { modelId: FAL_GLOBAL_ID } })
  if (!globalLimit) return { claimed: true, maxConcurrent: 999 } // No limit row — allow

  // Sync counter to ground truth (idempotent — only writes when value actually changed)
  const actualProcessing = await prisma.generationQueue.count({ where: { status: 'processing' } })
  if (actualProcessing !== globalLimit.currentActive) {
    console.log(`[syncAndClaimFalSlot] Counter drift detected: stored=${globalLimit.currentActive}, actual=${actualProcessing}. Syncing.`)
    await prisma.modelConcurrencyLimit.updateMany({
      where: { modelId: FAL_GLOBAL_ID },
      data: { currentActive: actualProcessing },
    })
  }

  // Atomically claim a slot (safe against concurrent requests)
  const claim = await prisma.modelConcurrencyLimit.updateMany({
    where: { modelId: FAL_GLOBAL_ID, currentActive: { lt: globalLimit.maxConcurrent } },
    data: { currentActive: { increment: 1 } },
  })

  return { claimed: claim.count > 0, maxConcurrent: globalLimit.maxConcurrent }
}

/**
 * Called once per FAL job when its polling status route detects COMPLETED or FAILED.
 * Atomically marks the GenerationQueue entry, decrements the global slot counter,
 * and promotes the next waiting job.
 *
 * Uses `updateMany` with a `status: 'processing'` guard so concurrent poll calls
 * can't double-decrement.
 */
export async function releaseQueueSlot(falRequestId: string, failed: boolean, errorMessage?: string): Promise<void> {
  try {
    const updated = await prisma.generationQueue.updateMany({
      where: { falRequestId, status: 'processing' },
      data: {
        status: failed ? 'failed' : 'completed',
        completedAt: new Date(),
        ...(failed && errorMessage ? { errorMessage } : {}),
      },
    })

    if (updated.count === 0) {
      // Already settled (e.g., duplicate poll call) — nothing to do
      return
    }

    // Decrement global FAL concurrency counter
    await prisma.modelConcurrencyLimit.updateMany({
      where: { modelId: FAL_GLOBAL_ID },
      data: { currentActive: { decrement: 1 } },
    })

    // Promote the next waiting job
    await promoteNextQueuedJob()
  } catch (err) {
    console.error('[admin-queue-helpers] releaseQueueSlot error:', err)
  }
}
