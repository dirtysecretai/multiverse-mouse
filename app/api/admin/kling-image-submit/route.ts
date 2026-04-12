import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { put } from '@vercel/blob'
import prisma from '@/lib/prisma'
import { FAL_GLOBAL_ID } from '@/lib/fal-queue'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

fal.config({ credentials: process.env.FAL_KEY })

// POST /api/admin/kling-image-submit
// Submits a Kling V3 image generation job to the FAL async queue.
// Chooses text-to-image or image-to-image based on whether image_url is provided.
// Returns immediately with { requestId, falEndpoint } — client polls /api/admin/kling-image-status.
export async function POST(req: Request) {
  try {
    const {
      prompt,
      image_url,
      num_images = 1,
      aspect_ratio = '16:9',
      output_format = 'png',
      resolution = '1K',
    } = await req.json()

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const input: Record<string, unknown> = {
      prompt: prompt.trim(),
      num_images: Math.min(Math.max(1, parseInt(num_images) || 1), 9),
      aspect_ratio,
      output_format,
      resolution,
    }

    const permanentReferenceUrls: string[] = []
    let endpoint: string
    if (image_url) {
      // Upload reference image to FAL storage; also persist to Vercel Blob for DB
      let hostedUrl = image_url
      if (image_url.startsWith('data:')) {
        const [meta, b64] = image_url.split(',')
        const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/jpeg'
        const buffer = Buffer.from(b64, 'base64')
        const falBlob = new Blob([buffer], { type: mimeType })
        hostedUrl = await fal.storage.upload(falBlob)
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
        const vBlob = await put(`reference-kling-v3-${Date.now()}.${ext}`, buffer, {
          access: 'public',
          contentType: mimeType,
        })
        permanentReferenceUrls.push(vBlob.url)
      } else {
        // Already a permanent https:// URL
        permanentReferenceUrls.push(image_url)
      }
      input.image_url = hostedUrl
      endpoint = 'fal-ai/kling-image/v3/image-to-image'
    } else {
      endpoint = 'fal-ai/kling-image/v3/text-to-image'
    }

    console.log(`Kling V3 submit (${endpoint}):`, JSON.stringify({ ...input, image_url: input.image_url ? '[url]' : undefined }))

    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const sessionUser = token ? await getUserFromSession(token) : null
    let targetUserId: number | null = sessionUser?.id ?? null
    if (!targetUserId) {
      const adminUser = await prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
      targetUserId = adminUser?.id ?? null
    }
    if (!targetUserId) return NextResponse.json({ error: 'No user found' }, { status: 500 })

    // Atomically claim a global FAL slot (prevents race conditions when multiple requests arrive simultaneously)
    const globalLimit = await prisma.modelConcurrencyLimit.findUnique({ where: { modelId: FAL_GLOBAL_ID } })
    let isAtCapacity = false
    if (globalLimit) {
      const claimed = await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: FAL_GLOBAL_ID, currentActive: { lt: globalLimit.maxConcurrent } },
        data: { currentActive: { increment: 1 } },
      })
      isAtCapacity = claimed.count === 0
    }

    if (isAtCapacity) {
      // Slot could not be claimed — queue for later (counter was NOT incremented)
      const queueEntry = await prisma.generationQueue.create({
        data: {
          userId:    targetUserId!,
          modelId:   'kling-v3-image',
          modelType: 'image',
          prompt:    (prompt as string).trim(),
          parameters: { falEndpoint: endpoint, falInput: input, usePolling: true, permanentReferenceUrls },
          status:    'queued',
          ticketCost: 0,
        },
      })
      console.log(`Kling V3 queued (at capacity ${globalLimit!.currentActive}/${globalLimit!.maxConcurrent}) → queueId #${queueEntry.id}`)
      return NextResponse.json({ success: true, queued: true, queueId: queueEntry.id, permanentReferenceUrls })
    }

    // Slot claimed (counter already incremented) — submit to FAL
    try {
      const submitted = await fal.queue.submit(endpoint, { input })

      const queueEntry = await prisma.generationQueue.create({
        data: {
          userId:      targetUserId!,
          modelId:     'kling-v3-image',
          modelType:   'image',
          prompt:      (prompt as string).trim(),
          parameters:  { falEndpoint: endpoint, falInput: input, usePolling: true, permanentReferenceUrls },
          status:      'processing',
          ticketCost:  0,
          falRequestId: submitted.request_id,
          startedAt:   new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        requestId: submitted.request_id,
        falEndpoint: endpoint,
        queueId: queueEntry.id,
        permanentReferenceUrls,
      })
    } catch (submitError: any) {
      // FAL submit failed — release the slot we claimed
      if (globalLimit) {
        await prisma.modelConcurrencyLimit.updateMany({
          where: { modelId: FAL_GLOBAL_ID },
          data: { currentActive: { decrement: 1 } },
        }).catch(() => {})
      }
      throw submitError
    }
  } catch (error: any) {
    console.error('Kling image submit error:', error)
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
