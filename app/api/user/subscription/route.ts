import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromSession(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check for active prompt-studio-dev subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        tier: 'prompt-studio-dev',
        status: 'active',
        OR: [
          { endDate: null }, // Lifetime/indefinite
          { endDate: { gt: new Date() } } // Not expired
        ]
      }
    });

    return NextResponse.json({
      success: true,
      hasPromptStudioDev: !!subscription,
      subscription: subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      } : null
    });

  } catch (error: any) {
    console.error('Error checking subscription:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check subscription' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
