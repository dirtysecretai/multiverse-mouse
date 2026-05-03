import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

// GET — list all buckets with image counts
export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const buckets = await prisma.datasetBucket.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { images: true } } },
  })

  return NextResponse.json(
    buckets.map(b => ({ id: b.id, name: b.name, description: b.description, color: b.color, folderId: b.folderId ?? null, count: b._count.images, createdAt: b.createdAt })),
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST — create a new bucket
// Body: { name, description?, color?, folderId? }
export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, color, folderId } = await req.json() as { name: string; description?: string; color?: string; folderId?: number }
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const bucket = await prisma.datasetBucket.create({ data: { name: name.trim(), description, color, folderId: folderId ?? null } })
  return NextResponse.json(bucket, { status: 201 })
}
