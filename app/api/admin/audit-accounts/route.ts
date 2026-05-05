import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accounts = await prisma.auditAccount.findMany({ orderBy: { addedAt: 'desc' } })
  return NextResponse.json(accounts)
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { email, notes } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  try {
    const account = await prisma.auditAccount.create({
      data: { email: email.toLowerCase().trim(), notes: notes || null },
    })
    return NextResponse.json(account)
  } catch {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
  }
}

export async function PUT(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, notes } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const account = await prisma.auditAccount.update({
    where: { id },
    data: { notes: notes || null },
  })
  return NextResponse.json(account)
}

export async function DELETE(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = parseInt(new URL(req.url).searchParams.get('id') || '')
  if (isNaN(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.auditAccount.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
