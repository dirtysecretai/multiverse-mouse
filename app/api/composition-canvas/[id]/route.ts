import { NextResponse } from 'next/server';
import prisma, { prismaDirectDb } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch specific canvas
// Uses direct DB connection (prismaDirectDb) to bypass Prisma Accelerate's 5 MB limit,
// since canvas layer data (base64 images) can easily exceed that threshold.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const canvas = await prismaDirectDb.compositionCanvas.findFirst({
      where: {
        id: parseInt(id),
        userId: user.id
      }
    });

    if (!canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, canvas });
  } catch (error) {
    console.error('Failed to fetch canvas:', error);
    return NextResponse.json({ error: 'Failed to fetch canvas' }, { status: 500 });
  }
}

// PUT - Update canvas
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Verify canvas belongs to user
    const existingCanvas = await prisma.compositionCanvas.findFirst({
      where: {
        id: parseInt(id),
        userId: user.id
      }
    });

    if (!existingCanvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, layers, panOffset, zoom, rotation, gridRows, gridCols, thumbnail } = body;

    await prisma.compositionCanvas.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(layers !== undefined && { layers }),
        ...(panOffset !== undefined && { panOffset }),
        ...(zoom !== undefined && { zoom }),
        ...(rotation !== undefined && { rotation }),
        ...(gridRows !== undefined && { gridRows }),
        ...(gridCols !== undefined && { gridCols }),
        ...(thumbnail !== undefined && { thumbnail })
      },
      // Only return lightweight fields — never return layers (can be many MB of base64)
      select: { id: true, name: true, updatedAt: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update canvas:', error);
    return NextResponse.json({ error: 'Failed to update canvas' }, { status: 500 });
  }
}

// DELETE - Delete canvas
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromSession(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Verify canvas belongs to user
    const existingCanvas = await prisma.compositionCanvas.findFirst({
      where: {
        id: parseInt(id),
        userId: user.id
      }
    });

    if (!existingCanvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    await prisma.compositionCanvas.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete canvas:', error);
    return NextResponse.json({ error: 'Failed to delete canvas' }, { status: 500 });
  }
}
