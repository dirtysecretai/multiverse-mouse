import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

// POST — find users with multiple subscription records and delete the stale ones.
// "Winner" = active first, then most recent startDate. Stale = everything else for that user.
export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get('x-admin-password')
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const all = await prisma.subscription.findMany({
      where: { tier: 'prompt-studio-dev' },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      select: {
        id: true,
        userId: true,
        status: true,
        startDate: true,
        lsSubscriptionId: true,
        endDate: true,
        lsCurrentPeriodEnd: true,
        user: { select: { email: true } },
      },
    })

    // Group by userId
    const byUser: Record<number, typeof all> = {}
    for (const s of all) {
      if (!byUser[s.userId]) byUser[s.userId] = []
      byUser[s.userId].push(s)
    }

    const deleted: { id: number; email: string; reason: string }[] = []
    const now = new Date()

    for (const [, subs] of Object.entries(byUser)) {
      if (subs.length <= 1) continue

      // Pick winner: prefer active status, then latest startDate
      const winner = subs.find(s => s.status === 'active') ?? subs[0]
      const stale  = subs.filter(s => s.id !== winner.id)

      for (const s of stale) {
        // Only auto-delete if it's clearly expired/cancelled with no remaining access
        const periodEnd = s.lsCurrentPeriodEnd ? new Date(s.lsCurrentPeriodEnd) : null
        const endDate   = s.endDate ? new Date(s.endDate) : null
        const hasAccess = (periodEnd && periodEnd > now) || (endDate && endDate > now)

        if (s.status === 'active' || hasAccess) {
          // Don't auto-delete if it still has active access — leave it for manual review
          continue
        }

        await prisma.subscription.delete({ where: { id: s.id } })
        deleted.push({ id: s.id, email: s.user.email, reason: `${s.status} · no remaining access` })
      }
    }

    return NextResponse.json({ success: true, deleted, count: deleted.length })
  } catch (error: any) {
    console.error('[resolve-duplicates] error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// GET — just count duplicates without deleting anything
export async function GET(req: NextRequest) {
  try {
    const password = req.headers.get('x-admin-password')
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const counts = await prisma.subscription.groupBy({
      by: ['userId'],
      where: { tier: 'prompt-studio-dev' },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    })

    return NextResponse.json({ success: true, duplicateUserCount: counts.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
