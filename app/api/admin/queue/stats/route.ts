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

    // Auto-clean stale processing jobs (mark failed only — counter sync happens below)
    const staleJobs = await prisma.generationQueue.findMany({
      where: { status: 'processing', startedAt: { lt: staleThreshold } },
      select: { id: true, modelId: true },
    });

    if (staleJobs.length > 0) {
      const staleIds = staleJobs.map(j => j.id);
      await prisma.generationQueue.updateMany({
        where: { id: { in: staleIds } },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: `Auto-reset: stuck in processing for over ${STALE_MINUTES} minutes`,
        },
      });
      console.log(`Auto-reset ${staleJobs.length} stale processing job(s)`);
    }

    // Always recalculate currentActive from ground truth (self-heals any drift / negative values)
    await syncActiveCounters();

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

// Recalculate currentActive for every model from the actual count of
// 'processing' queue rows.  This is the only source of truth and prevents
// the counter from going negative due to double-decrements.
// The synthetic 'fal-global' limit tracks the total across ALL FAL models
// (all queue entries are FAL jobs; Gemini is synchronous and has no queue rows).
export async function syncActiveCounters() {
  const [processingByModel, totalFalProcessing] = await Promise.all([
    prisma.generationQueue.groupBy({
      by: ['modelId'],
      where: { status: 'processing' },
      _count: { id: true },
    }),
    prisma.generationQueue.count({ where: { status: 'processing' } }),
  ]);

  const actualCounts: Record<string, number> = {};
  for (const row of processingByModel) {
    actualCounts[row.modelId] = row._count.id;
  }

  const { FAL_GLOBAL_ID } = await import('@/lib/fal-queue');

  const allLimits = await prisma.modelConcurrencyLimit.findMany({
    select: { modelId: true, currentActive: true },
  });

  await Promise.all(
    allLimits.map(limit => {
      // fal-global uses the total processing count across all FAL models
      const actual =
        limit.modelId === FAL_GLOBAL_ID
          ? totalFalProcessing
          : (actualCounts[limit.modelId] ?? 0);
      if (limit.currentActive !== actual) {
        return prisma.modelConcurrencyLimit.update({
          where: { modelId: limit.modelId },
          data: { currentActive: actual },
        });
      }
      return Promise.resolve();
    })
  );
}
