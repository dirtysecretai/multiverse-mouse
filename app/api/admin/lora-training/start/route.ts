import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fal } from '@fal-ai/client'
import JSZip from 'jszip'

export const maxDuration = 300

function authOk(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext
    }
  } catch { /* ignore */ }
  return 'jpg'
}

function buildFalInput(modelId: string, config: Record<string, unknown>): Record<string, unknown> {
  if (modelId === 'fal-ai/flux-2-trainer') {
    const input: Record<string, unknown> = {}
    if (config.steps           !== undefined) input.steps             = Number(config.steps)
    if (config.learning_rate   !== undefined) input.learning_rate     = Number(config.learning_rate)
    if (config.default_caption !== undefined && config.default_caption !== '') {
      input.default_caption = String(config.default_caption)
    }
    if (config.output_lora_format !== undefined) input.output_lora_format = String(config.output_lora_format)
    return input
  }

  if (modelId === 'fal-ai/flux-lora-fast-training') {
    const input: Record<string, unknown> = {}
    if (config.steps          !== undefined) input.steps         = Number(config.steps)
    if (config.learning_rate  !== undefined) input.learning_rate = Number(config.learning_rate)
    if (config.trigger_word   !== undefined && config.trigger_word !== '') {
      input.trigger_word = String(config.trigger_word)
    }
    return input
  }

  if (modelId === 'fal-ai/z-image-turbo-trainer-v2') {
    const input: Record<string, unknown> = {}
    if (config.steps           !== undefined) input.steps           = Number(config.steps)
    if (config.learning_rate   !== undefined) input.learning_rate   = Number(config.learning_rate)
    if (config.default_caption !== undefined && config.default_caption !== '') {
      input.default_caption = String(config.default_caption)
    }
    return input
  }

  return { ...config }
}

// Download images in parallel batches to avoid overwhelming connections
async function downloadImages(
  images: { id: number; imageUrl: string; adminCaption: string | null }[],
  defaultCaption: string,
  zip: JSZip,
  batchSize = 30,
) {
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (img) => {
        try {
          const res = await fetch(img.imageUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buf = await res.arrayBuffer()
          const ext = getExtFromUrl(img.imageUrl)
          zip.file(`${img.id}.${ext}`, Buffer.from(buf))
          const caption = img.adminCaption?.trim() || defaultCaption
          if (caption) zip.file(`${img.id}.txt`, caption)
        } catch (err) {
          console.error(`[lora/start] Failed to fetch image ${img.id}:`, err)
        }
      })
    )
  }
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

  // Create job immediately — returns to client right away
  const job = await prisma.loraTrainingJob.create({
    data: {
      name: name.trim(),
      modelId,
      status: 'preparing',
      config: config as object,
      imageCount: images.length,
    },
  })

  // All the heavy work happens after the response is sent
  after(async () => {
    try {
      fal.config({ credentials: process.env.FAL_KEY! })

      const zip = new JSZip()
      const defaultCaption = config.default_caption ? String(config.default_caption) : ''

      await downloadImages(images, defaultCaption, zip)

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      const zipFile = new File([zipBuffer.buffer as ArrayBuffer], 'training.zip', { type: 'application/zip' })
      const zipUrl = await fal.storage.upload(zipFile)

      const falInput = buildFalInput(modelId, config)
      const submission = await fal.queue.submit(modelId, {
        input: { image_data_url: zipUrl, ...falInput },
      })

      await prisma.loraTrainingJob.update({
        where: { id: job.id },
        data: { requestId: submission.request_id, status: 'queued' },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[lora/start] Background processing failed for job ${job.id}:`, msg)
      await prisma.loraTrainingJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorMsg: msg },
      }).catch(() => {})
    }
  })

  return NextResponse.json({ jobId: job.id })
}
