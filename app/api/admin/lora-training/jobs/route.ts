import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function authOk(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const jobs = await prisma.loraTrainingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ jobs })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[lora-training/jobs] DB error:', msg)
    return NextResponse.json({ jobs: [], error: msg })
  }
}
