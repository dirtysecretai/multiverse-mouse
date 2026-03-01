import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Any job stuck in 'processing' for longer than this is considered dead.
// FAL.ai's own timeout is well under 30 minutes, and sync models (Gemini)
// finish in under 2 minutes, so 30 min is a safe threshold.
const STALE_MINUTES = 30;

// GET - Fetch queue statistics, auto-clearing phantom 'processing' rows
export async function GET(request: Request) {
  try {
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

    // Auto-clean stale processing jobs so the count is always accurate.
    // These are rows that got stuck when a Vercel function timed out before
    // the webhook could fire. We find affected models, reset the rows, then
    // decrement their concurrency slots.
    const staleJobs = await prisma.generationQueue.findMany({
      where: { status: 'processing', startedAt: { lt: staleThreshold } },
      select: { id: true, modelId: true },
    });

    if (staleJobs.length > 0) {
      const staleIds = staleJobs.map(j => j.id);
      const modelCounts: Record<string, number> = {};
      for (const job of staleJobs) {
        modelCounts[job.modelId] = (modelCounts[job.modelId] || 0) + 1;
      }
      await Promise.all([
        prisma.generationQueue.updateMany({
          where: { id: { in: staleIds } },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: `Auto-reset: stuck in processing for over ${STALE_MINUTES} minutes`,
          },
        }),
        ...Object.entries(modelCounts).map(([modelId, count]) =>
          prisma.modelConcurrencyLimit.updateMany({
            where: { modelId },
            data: { currentActive: { decrement: count } },
          })
        ),
      ]);
      console.log(`Auto-reset ${staleJobs.length} stale processing job(s)`);
    }

    const [totalQueued, totalProcessing, totalCompleted, totalFailed] = await Promise.all([
      prisma.generationQueue.count({ where: { status: 'queued' } }),
      prisma.generationQueue.count({ where: { status: 'processing' } }),
      prisma.generationQueue.count({ where: { status: 'completed' } }),
      prisma.generationQueue.count({ where: { status: 'failed' } }),
    ]);

    return NextResponse.json({ success: true, stats: { totalQueued, totalProcessing, totalCompleted, totalFailed } });
  } catch (error) {
    console.error('Failed to fetch queue stats:', error);
    return NextResponse.json({ error: 'Failed to fetch queue stats' }, { status: 500 });
  }
}
