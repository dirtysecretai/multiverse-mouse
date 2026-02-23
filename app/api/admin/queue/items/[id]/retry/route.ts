import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST - Retry a failed queue item
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    const item = await prisma.generationQueue.findUnique({
      where: { id }
    });

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.status !== 'failed' && item.status !== 'cancelled') {
      return NextResponse.json({ error: 'Can only retry failed or cancelled items' }, { status: 400 });
    }

    // Reset item to queued state
    await prisma.generationQueue.update({
      where: { id },
      data: {
        status: 'queued',
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        resultUrl: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to retry queue item:', error);
    return NextResponse.json({ error: 'Failed to retry queue item' }, { status: 500 });
  }
}
