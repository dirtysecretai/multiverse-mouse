import { prisma } from '@/lib/prisma'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

// GET — poll job status + recent results
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const job = await prisma.autoFillJob.findUnique({
    where:  { id },
    select: {
      id: true, status: true, mode: true, modelKey: true, advanced: true,
      totalCount: true, nextIndex: true,
      processedCount: true, skippedCount: true, failedCount: true,
      results: true, createdAt: true, updatedAt: true,
    },
  })

  if (!job) return new Response('Not found', { status: 404 })
  return Response.json(job)
}

// DELETE — cancel a running job
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const job = await prisma.autoFillJob.findUnique({ where: { id }, select: { status: true } })
  if (!job) return new Response('Not found', { status: 404 })
  if (job.status !== 'running') return Response.json({ ok: true })

  await prisma.autoFillJob.update({ where: { id }, data: { status: 'cancelled' } })
  return Response.json({ ok: true })
}
