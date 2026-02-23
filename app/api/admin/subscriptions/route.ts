import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// GET - List all subscriptions (filtered by Dev Tier)
export async function GET(req: NextRequest) {
  try {
    const password = req.headers.get('x-admin-password');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        tier: 'prompt-studio-dev' // Filter for Dev Tier only
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
          }
        },
        transactions: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // Active subscriptions first
        { createdAt: 'desc' } // Then newest first
      ]
    });

    return NextResponse.json({
      success: true,
      subscriptions,
      count: subscriptions.length
    });

  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

// POST - Create/Grant subscription
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, userEmail, tier, endDate } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!userEmail || !tier) {
      return NextResponse.json(
        { error: 'userEmail and tier are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json(
        { error: `User not found: ${userEmail}` },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription for this tier
    const existingSub = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        tier: tier,
        status: 'active'
      }
    });

    if (existingSub) {
      return NextResponse.json(
        { error: `User already has an active ${tier} subscription` },
        { status: 400 }
      );
    }

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        tier: tier,
        status: 'active',
        startDate: new Date(),
        endDate: endDate ? new Date(endDate) : null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ Subscription granted: ${tier} to ${userEmail}`);

    return NextResponse.json({
      success: true,
      subscription
    });

  } catch (error: any) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

// PUT - Update subscription status
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, id, status, endDate } = body;

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Subscription id is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const subscription = await prisma.subscription.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ Subscription updated: ID ${id} -> status: ${status}`);

    return NextResponse.json({
      success: true,
      subscription
    });

  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Remove subscription
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const password = searchParams.get('password');
    const id = searchParams.get('id');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Subscription id is required' },
        { status: 400 }
      );
    }

    await prisma.subscription.delete({
      where: { id: parseInt(id) }
    });

    console.log(`✅ Subscription deleted: ID ${id}`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
