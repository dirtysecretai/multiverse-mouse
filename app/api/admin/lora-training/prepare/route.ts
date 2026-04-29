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

async function setProgress(jobId: number, msg: string) {
  console.log(`[lora/prepare] job ${jobId}: ${msg}`)
  await prisma.loraTrainingJob.update({
    where: { id: jobId },
    data: { errorMsg: msg },
  }).catch(e => console.error('[lora/prepare] progress update failed:', e))
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

    await setProgress(jobId, 'Fetching image list...')

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

    await setProgress(jobId, `Found ${images.length} images — downloading...`)

    fal.config({ credentials: process.env.FAL_KEY! })
    const zip = new JSZip()
    let downloaded = 0

    // Sequential downloads — 5s timeout per image so bad URLs don't eat the budget
    let skipped = 0
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      try {
        const res = await fetch(img.imageUrl, { signal: AbortSignal.timeout(5_000) })
        if (res.ok) {
          const buf = await res.arrayBuffer()
          zip.file(`${img.id}.${getExtFromUrl(img.imageUrl)}`, Buffer.from(buf))
          const caption = img.adminCaption?.trim() || defaultCaption
          if (caption) zip.file(`${img.id}.txt`, caption)
          downloaded++
        } else {
          skipped++
        }
      } catch {
        skipped++
      }

      // Update progress every 50 images — fire-and-forget so DB slowness never blocks loop
      if (i > 0 && i % 50 === 0) {
        void setProgress(jobId, `Downloading: ${downloaded} ok, ${skipped} skipped (${i}/${images.length})`)
      }
    }

    void setProgress(jobId, `Building ZIP (${downloaded} images, ${skipped} skipped)...`)
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

    const zipMB = (zipBuffer.length / 1024 / 1024).toFixed(1)
    void setProgress(jobId, `Uploading ${zipMB}MB to FAL storage...`)

    const zipFile = new File([zipBuffer.buffer as ArrayBuffer], 'training.zip', { type: 'application/zip' })
    const zipUrl = await fal.storage.upload(zipFile)

    void setProgress(jobId, 'Submitting to FAL training queue...')

    const falInput = buildFalInput(job.modelId, config)
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prompt-protocol.vercel.app'}/api/webhooks/fal`
    const submission = await fal.queue.submit(job.modelId, {
      input: { image_data_url: zipUrl, ...falInput },
      webhookUrl,
    })

    await prisma.loraTrainingJob.update({
      where: { id: jobId },
      data: { requestId: submission.request_id, status: 'queued', errorMsg: null },
    })

    return NextResponse.json({ ok: true, requestId: submission.request_id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[lora/prepare] job ${jobId} failed:`, msg)
    await prisma.loraTrainingJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMsg: msg },
    }).catch(e => console.error('[lora/prepare] failed to mark job failed:', e))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
