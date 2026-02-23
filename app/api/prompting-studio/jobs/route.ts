// GET /api/prompting-studio/jobs
// Returns all in-flight (and recently settled) GenerationQueue records for the
// current user so the canvas can restore loading placeholders after a page refresh
// and enforce per-account concurrency limits.

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = await getUserFromSession(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Auto-fail any processing jobs that have been stuck for more than 10 minutes.
    // This cleans up jobs where the server errored mid-generation (e.g. ReferenceError
    // in catch block) and left the DB record in 'processing' forever.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    await prisma.generationQueue.updateMany({
      where: {
        userId: user.id,
        status: { in: ['processing', 'queued'] },
        startedAt: { lt: tenMinutesAgo },
      },
      data: {
        status: 'failed',
        errorMessage: 'Generation timed out — please try again',
        completedAt: new Date(),
      },
    })

    // Fetch jobs that are still in-flight OR settled within the last 2 hours.
    // The 2-hour window lets the client resolve placeholders that completed
    // while the page was reloading, without returning stale old data.
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const jobs = await prisma.generationQueue.findMany({
      where: {
        userId: user.id,
        modelType: 'image',
        OR: [
          { status: { in: ['processing', 'queued'] } },
          {
            status: { in: ['completed', 'failed'] },
            updatedAt: { gte: since },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    const activeCount = jobs.filter(
      j => j.status === 'processing' || j.status === 'queued'
    ).length

    return NextResponse.json({ jobs, activeCount })
  } catch (error: any) {
    console.error('Jobs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
