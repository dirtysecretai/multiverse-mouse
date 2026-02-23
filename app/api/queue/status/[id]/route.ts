import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Check status of a queued generation (polled by the frontend)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const queueId = parseInt(id);

    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queue ID' }, { status: 400 });
    }

    const item = await prisma.generationQueue.findUnique({
      where: { id: queueId }
    });

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    const completedParams = item.parameters as any;

    switch (item.status) {
      case 'queued': {
        // Calculate real-time queue position
        const position = await prisma.generationQueue.count({
          where: {
            modelId: item.modelId,
            status: 'queued',
            queuedAt: { lte: item.queuedAt }
          }
        });
        return NextResponse.json({
          status: 'queued',
          position,
          estimatedWait: position * 30,
        });
      }

      case 'processing':
        return NextResponse.json({
          status: 'processing',
        });

      case 'completed':
        return NextResponse.json({
          status: 'completed',
          resultUrl: item.resultUrl,
          imageId: item.resultImageId,
          // Multi-image support (NanoBanana returns 2 images)
          allImages: completedParams?.completedImageUrls?.length > 1
            ? completedParams.completedImageUrls.map((url: string, i: number) => ({
                url,
                id: completedParams.completedImageIds?.[i],
              }))
            : undefined,
        });

      case 'failed':
        return NextResponse.json({
          status: 'failed',
          errorMessage: item.errorMessage || 'Generation failed',
        });

      case 'cancelled':
        return NextResponse.json({
          status: 'cancelled',
          errorMessage: 'Generation was cancelled',
        });

      default:
        return NextResponse.json({ status: item.status });
    }
  } catch (error) {
    console.error('Failed to get queue status:', error);
    return NextResponse.json({ error: 'Failed to get queue status' }, { status: 500 });
  }
}
