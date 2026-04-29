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
  } catch {
    // ignore
  }
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

  // Generic fallback — pass everything
  return { ...config }
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    imageIds: number[]
    modelId: string
    config: Record<string, unknown>
    name: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { imageIds, modelId, config, name } = body

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return NextResponse.json({ error: 'imageIds must be a non-empty array' }, { status: 400 })
  }
  if (!modelId?.trim()) {
    return NextResponse.json({ error: 'modelId is required' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // Fetch image records
  const images = await prisma.generatedImage.findMany({
    where: { id: { in: imageIds } },
    select: { id: true, imageUrl: true, adminCaption: true, adminTags: true },
  })

  if (images.length === 0) {
    return NextResponse.json({ error: 'No images found for given imageIds' }, { status: 400 })
  }

  // Configure FAL
  fal.config({ credentials: process.env.FAL_KEY! })

  // Build ZIP
  const zip = new JSZip()

  const defaultCaption = config.default_caption ? String(config.default_caption) : ''

  await Promise.all(
    images.map(async (img) => {
      try {
        const response = await fetch(img.imageUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = await response.arrayBuffer()
        const ext = getExtFromUrl(img.imageUrl)
        const filename = `${img.id}.${ext}`
        zip.file(filename, Buffer.from(buffer))

        // Add caption file
        const caption = img.adminCaption?.trim() || defaultCaption
        if (caption) {
          zip.file(`${img.id}.txt`, caption)
        }
      } catch (err) {
        console.error(`[lora-training/start] Failed to fetch image ${img.id}:`, err)
        // Skip failed images silently — training continues with fetched ones
      }
    })
  )

  // Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  // Upload to FAL storage
  let zipUrl: string
  try {
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' })
    zipUrl = await fal.storage.upload(zipBlob)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `FAL storage upload failed: ${msg}` }, { status: 502 })
  }

  // Build FAL input
  const falInput = buildFalInput(modelId, config)

  // Submit training job to FAL queue
  let requestId: string
  try {
    const submission = await fal.queue.submit(modelId, {
      input: {
        image_data_url: zipUrl,
        ...falInput,
      },
    })
    requestId = submission.request_id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `FAL queue submit failed: ${msg}` }, { status: 502 })
  }

  // Save to DB
  const job = await prisma.loraTrainingJob.create({
    data: {
      requestId,
      name: name.trim(),
      modelId,
      status: 'queued',
      config: config as object,
      imageCount: images.length,
    },
  })

  return NextResponse.json({ jobId: job.id, requestId })
}
