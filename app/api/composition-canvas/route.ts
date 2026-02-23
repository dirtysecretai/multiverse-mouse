import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch all user's canvases
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const canvases = await prisma.compositionCanvas.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        aspectRatio: true,
        canvasWidth: true,
        canvasHeight: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    return NextResponse.json({ success: true, canvases });
  } catch (error) {
    console.error('Failed to fetch canvases:', error);
    return NextResponse.json({ error: 'Failed to fetch canvases' }, { status: 500 });
  }
}

// POST - Create new canvas
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { name, aspectRatio, canvasWidth, canvasHeight } = body;

    console.log('Creating canvas with data:', { name, aspectRatio, canvasWidth, canvasHeight, userId: user.id });

    if (!aspectRatio || !canvasWidth || !canvasHeight) {
      return NextResponse.json({
        success: false,
        error: 'aspectRatio, canvasWidth, and canvasHeight are required'
      }, { status: 400 });
    }

    // Create canvas with initial empty layer
    const canvasData = {
      userId: user.id,
      name: name || `Canvas ${new Date().toLocaleDateString()}`,
      aspectRatio,
      canvasWidth,
      canvasHeight,
      layers: [
        {
          id: `layer-${Date.now()}`,
          name: 'Layer 1',
          images: [],
          selected: true,
          visible: true
        }
      ],
      panOffset: { x: 0, y: 0 },
      zoom: 1,
      rotation: 0,
      gridRows: 3,
      gridCols: 3
    };

    console.log('Attempting to create canvas with:', canvasData);

    const canvas = await prisma.compositionCanvas.create({
      data: canvasData
    });

    console.log('Canvas created successfully:', canvas.id);

    return NextResponse.json({ success: true, canvas });
  } catch (error) {
    console.error('Failed to create canvas - Full error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create canvas',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
