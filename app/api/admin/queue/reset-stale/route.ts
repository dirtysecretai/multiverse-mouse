import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncActiveCounters } from '../stats/route';

// POST - Reset stuck "processing" jobs that are older than the threshold.
// A job is considered stale if it has been in "processing" for more than
// STALE_MINUTES minutes. FAL.ai's own timeout is well under 30 minutes,
// so any job older than that will never receive a webhook callback.
const STALE_MINUTES = 10;

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

    const staleIds = staleJobs.map(j => j.id);

    await prisma.generationQueue.updateMany({
      where: { id: { in: staleIds } },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: `Stale job reset by admin after ${STALE_MINUTES}+ minutes in processing state`,
      },
    });

    // Recalculate from ground truth instead of decrementing (prevents negative counters)
    await syncActiveCounters();

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
