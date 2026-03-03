import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { put } from '@vercel/blob'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      prompt,
      images_base64 = [],        // Array of base64 data URIs from client
      image_size = 'auto_2K',    // Preset enum OR 'custom'
      custom_width,
      custom_height,
      num_images = 1,
      max_images = 1,
      enable_safety_checker = true,
    } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Upload reference images to FAL temporary storage
    const imageUrls: string[] = []
    for (let i = 0; i < Math.min(images_base64.length, 10); i++) {
      const base64 = images_base64[i]
      try {
        const base64Data = base64.split(',')[1] || base64
        const buffer = Buffer.from(base64Data, 'base64')
        const blob = new Blob([buffer], { type: 'image/jpeg' })
        const url = await fal.storage.upload(blob)
        imageUrls.push(url)
      } catch (uploadErr) {
        console.error(`Failed to upload image ${i + 1}:`, uploadErr)
      }
    }

    // Build input params
    const input: Record<string, unknown> = {
      prompt: prompt.trim(),
      num_images: Math.min(Math.max(1, parseInt(String(num_images)) || 1), 8),
      max_images: Math.min(Math.max(1, parseInt(String(max_images)) || 1), 8),
      enable_safety_checker,
    }

    // Image size — custom or preset enum
    if (image_size === 'custom' && custom_width && custom_height) {
      input.image_size = {
        width: parseInt(String(custom_width)),
        height: parseInt(String(custom_height)),
      }
    } else {
      input.image_size = image_size
    }

    // Add image URLs if provided
    if (imageUrls.length > 0) {
      input.image_urls = imageUrls
    }

    console.log('SeedDream 5 Lite Edit request:', JSON.stringify({
      ...input,
      image_urls: `[${imageUrls.length} URLs]`,
    }))

    const start = Date.now()
    const result = await fal.subscribe('fal-ai/bytedance/seedream/v5/lite/edit', {
      input,
      logs: false,
    })
    const elapsed = Date.now() - start

    const falImages: { url: string; width?: number; height?: number }[] =
      (result.data as any).images || []
    const seed: number | undefined = (result.data as any).seed

    if (falImages.length === 0) {
      return NextResponse.json({ error: 'No images returned from model' }, { status: 500 })
    }

    // Download from FAL temporary storage and re-host on Vercel Blob
    const hostedImages: { url: string; width?: number; height?: number }[] = []
    for (let i = 0; i < falImages.length; i++) {
      const falImg = falImages[i]
      try {
        const res = await fetch(falImg.url)
        if (!res.ok) {
          console.error(`Failed to download image ${i + 1}: ${res.status}`)
          continue
        }
        const buffer = Buffer.from(await res.arrayBuffer())
        const filename = `sd5-lite-edit-${Date.now()}-${i}.png`
        const blob = await put(filename, buffer, {
          access: 'public',
          contentType: 'image/png',
        })
        hostedImages.push({ url: blob.url, width: falImg.width, height: falImg.height })
      } catch (downloadErr) {
        console.error(`Failed to re-host image ${i + 1}:`, downloadErr)
      }
    }

    if (hostedImages.length === 0) {
      return NextResponse.json({ error: 'Failed to host generated images' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      images: hostedImages,
      seed,
      elapsed,
      requestId: result.requestId,
    })
  } catch (error: any) {
    console.error('SeedDream 5 Lite Edit error:', error)
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    )
  }
}
