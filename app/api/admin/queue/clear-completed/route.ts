import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST - Clear completed queue items (optionally for a specific model)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { modelId } = body;

    const whereClause: any = {
      OR: [
        { status: 'completed' },
        { status: 'cancelled' }
      ]
    };

    // If modelId is provided, only clear for that model
    if (modelId) {
      whereClause.modelId = modelId;
    }

    const result = await prisma.generationQueue.deleteMany({
      where: whereClause
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Failed to clear completed items:', error);
    return NextResponse.json({ error: 'Failed to clear completed items' }, { status: 500 });
  }
}
