import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const folders = await prisma.datasetBucketFolder.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(folders, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, parentId } = await req.json() as { name: string; parentId?: number | null }
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const folder = await prisma.datasetBucketFolder.create({ data: { name: name.trim(), parentId: parentId ?? null } })
  return NextResponse.json(folder, { status: 201 })
}
