import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Default model configurations
const DEFAULT_MODELS = [
  // Image models
  { modelId: 'nano-banana', modelType: 'image', maxConcurrent: 999 },
  { modelId: 'nano-banana-pro', modelType: 'image', maxConcurrent: 999 },
  { modelId: 'seedream-4.5', modelType: 'image', maxConcurrent: 999 },
  { modelId: 'flux-2', modelType: 'image', maxConcurrent: 999 },
  { modelId: 'gemini-3-pro-image', modelType: 'image', maxConcurrent: 999 },
  { modelId: 'gemini-2.5-flash-image', modelType: 'image', maxConcurrent: 999 },

  // Video models
  { modelId: 'wan-2.5', modelType: 'video', maxConcurrent: 999 },
];

// GET - Fetch all model limits
export async function GET(request: Request) {
  try {
    // Initialize models if they don't exist
    for (const model of DEFAULT_MODELS) {
      await prisma.modelConcurrencyLimit.upsert({
        where: { modelId: model.modelId },
        update: {},
        create: model
      });
    }

    const limits = await prisma.modelConcurrencyLimit.findMany({
      orderBy: [
        { modelType: 'asc' },
        { modelId: 'asc' }
      ]
    });

    return NextResponse.json({ success: true, limits });
  } catch (error) {
    console.error('Failed to fetch model limits:', error);
    return NextResponse.json({ error: 'Failed to fetch model limits' }, { status: 500 });
  }
}

// POST - Add new model limit
export async function POST(request: Request) {
  try {
    const { modelId, modelType, maxConcurrent } = await request.json();

    if (!modelId || !modelType || maxConcurrent === undefined) {
      return NextResponse.json({ error: 'modelId, modelType, and maxConcurrent required' }, { status: 400 });
    }

    if (maxConcurrent < 1 || maxConcurrent > 999) {
      return NextResponse.json({ error: 'maxConcurrent must be between 1 and 999' }, { status: 400 });
    }

    if (!['image', 'video'].includes(modelType)) {
      return NextResponse.json({ error: 'modelType must be image or video' }, { status: 400 });
    }

    // Check if model already exists
    const existing = await prisma.modelConcurrencyLimit.findUnique({
      where: { modelId }
    });

    if (existing) {
      return NextResponse.json({ error: 'Model limit already exists' }, { status: 400 });
    }

    const limit = await prisma.modelConcurrencyLimit.create({
      data: {
        modelId,
        modelType: modelType as 'image' | 'video',
        maxConcurrent,
        currentActive: 0
      }
    });

    return NextResponse.json({ success: true, limit });
  } catch (error) {
    console.error('Failed to create model limit:', error);
    return NextResponse.json({ error: 'Failed to create model limit' }, { status: 500 });
  }
}

// PUT - Update model limit
export async function PUT(request: Request) {
  try {
    const { modelId, maxConcurrent } = await request.json();

    if (!modelId || maxConcurrent === undefined) {
      return NextResponse.json({ error: 'modelId and maxConcurrent required' }, { status: 400 });
    }

    if (maxConcurrent < 1 || maxConcurrent > 999) {
      return NextResponse.json({ error: 'maxConcurrent must be between 1 and 999' }, { status: 400 });
    }

    const limit = await prisma.modelConcurrencyLimit.update({
      where: { modelId },
      data: { maxConcurrent }
    });

    return NextResponse.json({ success: true, limit });
  } catch (error) {
    console.error('Failed to update model limit:', error);
    return NextResponse.json({ error: 'Failed to update model limit' }, { status: 500 });
  }
}

// DELETE - Remove model limit
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: 'modelId required' }, { status: 400 });
    }

    await prisma.modelConcurrencyLimit.delete({
      where: { modelId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete model limit:', error);
    return NextResponse.json({ error: 'Failed to delete model limit' }, { status: 500 });
  }
}
