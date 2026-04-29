import { NextRequest, NextResponse } from 'next/server'
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
    if (config.steps               !== undefined) input.steps               = Number(config.steps)
    if (config.learning_rate       !== undefined) input.learning_rate       = Number(config.learning_rate)
    if (config.default_caption     !== undefined && config.default_caption !== '') input.default_caption     = String(config.default_caption)
    if (config.output_lora_format  !== undefined) input.output_lora_format  = String(config.output_lora_format)
    return input
  }
  if (modelId === 'fal-ai/flux-lora-fast-training') {
    const input: Record<string, unknown> = {}
    if (config.steps         !== undefined) input.steps         = Number(config.steps)
    if (config.learning_rate !== undefined) input.learning_rate = Number(config.learning_rate)
    if (config.trigger_word  !== undefined && config.trigger_word !== '') input.trigger_word = String(config.trigger_word)
    return input
  }
  if (modelId === 'fal-ai/z-image-turbo-trainer-v2') {
    const input: Record<string, unknown> = {}
    if (config.steps           !== undefined) input.steps           = Number(config.steps)
    if (config.learning_rate   !== undefined) input.learning_rate   = Number(config.learning_rate)
    if (config.default_caption !== undefined && config.default_caption !== '') input.default_caption = String(config.default_caption)
    return input
  }
  return { ...config }
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let jobId: number
  try {
    const body = await req.json() as { jobId: number }
    jobId = body.jobId
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const job = await prisma.loraTrainingJob.findUnique({ where: { id: jobId } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'preparing') return NextResponse.json({ ok: true, skipped: true })

  try {
    const config = job.config as Record<string, unknown>
    const defaultCaption = config.default_caption ? String(config.default_caption) : ''
    const imageIds = Array.isArray(config._imageIds) ? (config._imageIds as number[]) : []

    // Fallback for jobs created before _imageIds was stored: use all marked-for-training images
    const images = imageIds.length > 0
      ? await prisma.generatedImage.findMany({
          where: { id: { in: imageIds } },
          select: { id: true, imageUrl: true, adminCaption: true },
        })
      : await prisma.generatedImage.findMany({
          where: { isDeleted: false, markedForTraining: true },
          orderBy: { createdAt: 'desc' },
          select: { id: true, imageUrl: true, adminCaption: true },
        })

    if (images.length === 0) {
      throw new Error('No images found — mark images for training or re-submit with a bucket')
    }

    fal.config({ credentials: process.env.FAL_KEY! })
    const zip = new JSZip()

    // Download in batches of 30 to avoid flooding connections
    for (let i = 0; i < images.length; i += 30) {
      const batch = images.slice(i, i + 30)
      await Promise.all(batch.map(async (img) => {
        try {
          const res = await fetch(img.imageUrl)
          if (!res.ok) return
          const buf = await res.arrayBuffer()
          zip.file(`${img.id}.${getExtFromUrl(img.imageUrl)}`, Buffer.from(buf))
          const caption = img.adminCaption?.trim() || defaultCaption
          if (caption) zip.file(`${img.id}.txt`, caption)
        } catch { /* skip failed image */ }
      }))
    }

    // STORE = no compression (images are already compressed), much faster
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
    const zipFile = new File([zipBuffer.buffer as ArrayBuffer], 'training.zip', { type: 'application/zip' })
    const zipUrl = await fal.storage.upload(zipFile)

    const falInput = buildFalInput(job.modelId, config)
    const submission = await fal.queue.submit(job.modelId, {
      input: { image_data_url: zipUrl, ...falInput },
    })

    await prisma.loraTrainingJob.update({
      where: { id: jobId },
      data: { requestId: submission.request_id, status: 'queued' },
    })

    return NextResponse.json({ ok: true, requestId: submission.request_id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[lora/prepare] job ${jobId} failed:`, msg)
    await prisma.loraTrainingJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMsg: msg },
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
