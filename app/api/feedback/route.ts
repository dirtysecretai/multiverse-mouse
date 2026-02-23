import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST - Create new feedback
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userEmail, type, subject, message } = body;

    if (!userEmail || !type || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: userId || null,
        userEmail,
        type,
        subject,
        message,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Feedback POST error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}

// GET - Get all feedback (admin only)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    // Verify admin password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feedbacks = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error('Feedback GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// PUT - Update feedback status (admin only)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { password, id, status, adminNotes } = body;

    // Verify admin password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        status,
        adminNotes,
      },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Feedback PUT error:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

// DELETE - Delete feedback (admin only)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');
    const id = searchParams.get('id');

    // Verify admin password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing feedback ID' }, { status: 400 });
    }

    await prisma.feedback.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
