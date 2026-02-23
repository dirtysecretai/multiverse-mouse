import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Fetch queue statistics
export async function GET(request: Request) {
  try {
    const [totalQueued, totalProcessing, totalCompleted, totalFailed] = await Promise.all([
      prisma.generationQueue.count({ where: { status: 'queued' } }),
      prisma.generationQueue.count({ where: { status: 'processing' } }),
      prisma.generationQueue.count({ where: { status: 'completed' } }),
      prisma.generationQueue.count({ where: { status: 'failed' } })
    ]);

    const stats = {
      totalQueued,
      totalProcessing,
      totalCompleted,
      totalFailed
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to fetch queue stats:', error);
    return NextResponse.json({ error: 'Failed to fetch queue stats' }, { status: 500 });
  }
}
