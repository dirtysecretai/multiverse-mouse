import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { uploadToR2 } from '@/lib/r2'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

fal.config({ credentials: process.env.FAL_KEY })
const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const sessionUser = token ? await getUserFromSession(token) : null

    const body = await req.json()
    const {
      prompt,
      num_images = 1,
      aspect_ratio = 'auto',
      output_format = 'png',
      safety_tolerance = '4',
      resolution = '1K',
      limit_generations = true,
      enable_web_search = false,
      seed,
    } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const input: Record<string, unknown> = {
      prompt: prompt.trim(),
      num_images: Math.min(Math.max(1, parseInt(num_images) || 1), 4),
      aspect_ratio,
      output_format,
      safety_tolerance: String(safety_tolerance),
      resolution,
      limit_generations,
      enable_web_search,
    }

    // Only include seed if provided
    if (seed !== undefined && seed !== null && seed !== '') {
      input.seed = parseInt(seed)
    }

    console.log('NanoBanana 2 prototype request:', JSON.stringify(input))
    const start = Date.now()

    const result = await fal.subscribe('fal-ai/nano-banana-2', {
      input,
      logs: false,
    })

    const elapsed = Date.now() - start
    const falImages: { url: string; width?: number; height?: number; file_size?: number }[] =
      (result.data as any).images || []

    if (falImages.length === 0) {
      return NextResponse.json({ error: 'No images returned from model' }, { status: 500 })
    }

    // Download from FAL temporary storage and re-host on Vercel Blob
    const hostedImages: { url: string; width?: number; height?: number }[] = []
    for (let i = 0; i < falImages.length; i++) {
      const falImg = falImages[i]
      const res = await fetch(falImg.url)
      if (!res.ok) {
        console.error(`Failed to download image ${i + 1}: ${res.status}`)
        continue
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const ext = output_format === 'jpeg' ? 'jpg' : output_format
      const filename = `nb2-proto-${Date.now()}-${i}.${ext}`
      const url = await uploadToR2(filename, buffer, `image/${output_format === 'jpeg' ? 'jpeg' : output_format}`)
      hostedImages.push({ url, width: falImg.width, height: falImg.height })
    }

    // Save to DB under the first user (admin/site owner).
    try {
      const targetUserId: number | null = sessionUser?.id ?? null
      if (!targetUserId) {
        console.error('nano-banana-2: no session user — skipping DB save')
      }
      if (targetUserId) {
        await Promise.all(hostedImages.map(img =>
          prisma.generatedImage.create({
            data: {
              userId:            targetUserId!,
              prompt:            prompt.trim(),
              imageUrl:          img.url,
              model:             'nano-banana-2',
              ticketCost:        0,
              referenceImageUrls: [],
              quality:           resolution,
              aspectRatio:       aspect_ratio,
              expiresAt:         new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 90 days
            },
          })
        ))
      }
    } catch (dbErr) {
      // Non-fatal — log but still return the images
      console.error('NanaBanana2: failed to save to DB:', dbErr)
    }

    return NextResponse.json({
      success: true,
      images: hostedImages,
      description: (result.data as any).description || '',
      elapsed,
      requestId: result.requestId,
    })
  } catch (error: any) {
    console.error('NanoBanana 2 prototype error:', error)
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
