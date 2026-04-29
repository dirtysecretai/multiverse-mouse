import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

function authOk(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}


export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { imageIds: number[]; modelId: string; config: Record<string, unknown>; name: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { imageIds, modelId, config, name } = body

  if (!Array.isArray(imageIds) || imageIds.length === 0)
    return NextResponse.json({ error: 'imageIds must be a non-empty array' }, { status: 400 })
  if (!modelId?.trim())
    return NextResponse.json({ error: 'modelId is required' }, { status: 400 })
  if (!name?.trim())
    return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Fetch image records from DB
  const images = await prisma.generatedImage.findMany({
    where: { id: { in: imageIds } },
    select: { id: true, imageUrl: true, adminCaption: true },
  })

  if (images.length === 0)
    return NextResponse.json({ error: 'No images found for given imageIds' }, { status: 400 })

  // Store imageIds in config so the prepare worker can find them
  const jobConfig = { ...config, _imageIds: images.map(i => i.id) }

  // Create job immediately — returns to client right away
  const job = await prisma.loraTrainingJob.create({
    data: {
      name: name.trim(),
      modelId,
      status: 'preparing',
      config: jobConfig as object,
      imageCount: images.length,
    },
  })

  // Kick off the prepare endpoint as an independent HTTP request
  // after() just launches it — the prepare endpoint has its own lifecycle
  after(async () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prompt-protocol.vercel.app'
    try {
      await fetch(`${base}/api/admin/lora-training/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': process.env.ADMIN_PASSWORD ?? '',
        },
        body: JSON.stringify({ jobId: job.id }),
        signal: AbortSignal.timeout(5_000), // just wait long enough to confirm it started
      })
    } catch {
      // Timeout or network error launching prepare — that's fine, prepare runs independently
    }
  })

  return NextResponse.json({ jobId: job.id })
}
