/**
 * fal-queue.ts
 *
 * Helper for promoting the next waiting job from our internal queue to FAL.ai
 * when a global concurrency slot opens up (after a job completes or fails).
 *
 * The global FAL concurrency limit is stored in ModelConcurrencyLimit under
 * the synthetic modelId 'fal-global'.  When a generation request arrives and
 * that counter is already at its max, the generate route creates a
 * GenerationQueue row with status='queued' (not submitted to FAL yet) and
 * stores the full FAL endpoint + input in the row's `parameters` field.
 * When a slot opens this helper picks up the oldest waiting row and submits it.
 */

import { fal } from '@fal-ai/client'
import prisma from '@/lib/prisma'

fal.config({ credentials: process.env.FAL_KEY })

export const FAL_GLOBAL_ID = 'fal-global'

/**
 * Called after any FAL webhook completes or fails.
 * Finds the oldest 'queued' job and promotes it to 'processing' by submitting
 * it to FAL.  Uses conditional WHERE clauses on both the global slot and the
 * job's status so concurrent webhook handlers can't double-promote the same job.
 */
export async function promoteNextQueuedJob(): Promise<void> {
  try {
    // Read current global limit
    const globalLimit = await prisma.modelConcurrencyLimit.findUnique({
      where: { modelId: FAL_GLOBAL_ID },
    })
    if (!globalLimit) return

    // Sync counter from ground truth before claiming — prevents a drifted counter
    // from blocking promotion of queued jobs when there are actually free slots.
    const actualProcessing = await prisma.generationQueue.count({ where: { status: 'processing' } })
    if (actualProcessing !== globalLimit.currentActive) {
      console.log(`[promoteNextQueuedJob] Counter drift: stored=${globalLimit.currentActive}, actual=${actualProcessing}. Syncing.`)
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: FAL_GLOBAL_ID },
        data: { currentActive: actualProcessing },
      })
      globalLimit.currentActive = actualProcessing
    }

    // Atomically claim a global slot — only succeeds if currentActive < maxConcurrent
    const slotClaim = await prisma.modelConcurrencyLimit.updateMany({
      where: {
        modelId: FAL_GLOBAL_ID,
        currentActive: { lt: globalLimit.maxConcurrent },
      },
      data: { currentActive: { increment: 1 } },
    })
    if (slotClaim.count === 0) return // Still at capacity

    // Find the oldest waiting job
    const nextJob = await prisma.generationQueue.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    })

    if (!nextJob) {
      // No waiting jobs — release the slot we just claimed
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: FAL_GLOBAL_ID },
        data: { currentActive: { decrement: 1 } },
      })
      return
    }

    // Atomically claim the job (guard against concurrent handlers)
    const jobClaim = await prisma.generationQueue.updateMany({
      where: { id: nextJob.id, status: 'queued' },
      data: { status: 'processing', startedAt: new Date() },
    })

    if (jobClaim.count === 0) {
      // Another handler already claimed this job — release the slot
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: FAL_GLOBAL_ID },
        data: { currentActive: { decrement: 1 } },
      })
      return
    }

    // Extract stored FAL submission data
    const params = nextJob.parameters as any
    const falEndpoint: string | undefined = params.falEndpoint
    const falInput: Record<string, unknown> | undefined = params.falInput
    // Polling-based jobs (NB2, Kling, Video): skip webhook so only the status route handles completion
    const usePolling: boolean = params.usePolling === true

    if (!falEndpoint || !falInput) {
      console.error(`Queued job #${nextJob.id} missing falEndpoint/falInput — failing it`)
      await prisma.generationQueue.update({
        where: { id: nextJob.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'Queued job missing stored FAL endpoint or input',
        },
      })
      // Release global counter (no per-model bump was done yet)
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: FAL_GLOBAL_ID },
        data: { currentActive: { decrement: 1 } },
      })
      return
    }

    // Bump per-model counter only for webhook-based jobs (polling routes handle their own cleanup)
    if (!usePolling) {
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: nextJob.modelId },
        data: { currentActive: { increment: 1 } },
      })
    }

    // Submit to FAL — webhook-based jobs get a webhookUrl; polling-based jobs don't
    const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`
    const submitOptions: Parameters<typeof fal.queue.submit>[1] = { input: falInput }
    if (!usePolling) {
      submitOptions.webhookUrl = `${appUrl}/api/webhooks/fal`
    }

    // Wrap FAL submit so that a transient error doesn't leave the job stuck in
    // 'processing' forever with no falRequestId and the counter permanently incremented.
    try {
      const { request_id } = await fal.queue.submit(falEndpoint, submitOptions)

      // Record the FAL request ID so the webhook/status-poller can find this job
      await prisma.generationQueue.update({
        where: { id: nextJob.id },
        data: { falRequestId: request_id },
      })

      console.log(
        `[fal-queue] Promoted job #${nextJob.id} (${nextJob.modelId}) → FAL ${falEndpoint} (request_id: ${request_id})`
      )
    } catch (submitErr) {
      console.error(`[fal-queue] FAL submit failed for promoted job #${nextJob.id} (${nextJob.modelId}):`, submitErr)

      // Mark the job as failed so it doesn't stay stuck in 'processing'
      await prisma.generationQueue.update({
        where: { id: nextJob.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'FAL submission failed during queue promotion',
        },
      }).catch(e => console.error('[fal-queue] Failed to mark job as failed:', e))

      // Release the global slot we claimed at the start of this function
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: FAL_GLOBAL_ID },
        data: { currentActive: { decrement: 1 } },
      }).catch(e => console.error('[fal-queue] Failed to decrement global counter:', e))

      // Also undo the per-model bump if we did one
      if (!usePolling) {
        await prisma.modelConcurrencyLimit.updateMany({
          where: { modelId: nextJob.modelId },
          data: { currentActive: { decrement: 1 } },
        }).catch(e => console.error('[fal-queue] Failed to decrement per-model counter:', e))
      }
    }
  } catch (err) {
    console.error('[fal-queue] promoteNextQueuedJob error:', err)
  }
}
