import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const userIdNum = parseInt(userId);

    const ticket = await prisma.ticket.findUnique({
      where: { userId: userIdNum }
    });

    if (!ticket) {
      return NextResponse.json({
        success: true,
        balance: 0
      });
    }

    // Effective balance = total balance minus any tickets reserved for in-flight jobs.
    // This is what users see — tickets are only "spent" when a generation succeeds.
    const effectiveBalance = Math.max(0, ticket.balance - (ticket.reserved || 0));
    return NextResponse.json({
      success: true,
      balance: effectiveBalance,
      reserved: ticket.reserved || 0,
    });

  } catch (error: any) {
    console.error('Error fetching ticket balance:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch tickets' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
