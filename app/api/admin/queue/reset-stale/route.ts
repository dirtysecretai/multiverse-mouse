import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST - Reset stuck "processing" jobs that are older than the threshold.
// A job is considered stale if it has been in "processing" for more than
// STALE_MINUTES minutes. FAL.ai's own timeout is well under 30 minutes,
// so any job older than that will never receive a webhook callback.
const STALE_MINUTES = 30;

export async function POST(request: Request) {
  try {
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

    // Find all stale processing jobs
    const staleJobs = await prisma.generationQueue.findMany({
      where: {
        status: 'processing',
        startedAt: { lt: staleThreshold },
      },
      select: { id: true, modelId: true },
    });

    if (staleJobs.length === 0) {
      return NextResponse.json({ success: true, reset: 0, message: 'No stale jobs found' });
    }

    // Mark them all failed and release concurrency slots
    const staleIds = staleJobs.map(j => j.id);

    // Count how many slots to release per model
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
          errorMessage: `Stale job reset by admin after ${STALE_MINUTES}+ minutes in processing state`,
        },
      }),
      ...Object.entries(modelCounts).map(([modelId, count]) =>
        prisma.modelConcurrencyLimit.updateMany({
          where: { modelId },
          data: { currentActive: { decrement: count } },
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      reset: staleJobs.length,
      message: `Reset ${staleJobs.length} stale job(s)`,
    });
  } catch (error) {
    console.error('Failed to reset stale jobs:', error);
    return NextResponse.json({ error: 'Failed to reset stale jobs' }, { status: 500 });
  }
}
