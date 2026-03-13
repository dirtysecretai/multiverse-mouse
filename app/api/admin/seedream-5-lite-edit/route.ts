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

    if (!images_base64?.length) {
      return NextResponse.json({ error: 'At least one reference image is required (image_urls is required by this model)' }, { status: 400 })
    }

    // Build input — pass base64 data URIs directly to image_urls.
    // The FAL API explicitly supports data URIs as file inputs, so no
    // intermediate upload step is needed (and avoids upload failures).
    const input: Record<string, unknown> = {
      prompt: prompt.trim(),
      num_images: Math.min(Math.max(1, parseInt(String(num_images)) || 1), 8),
      max_images: Math.min(Math.max(1, parseInt(String(max_images)) || 1), 8),
      enable_safety_checker,
    }

    // Image size — custom object or preset enum string.
    // auto_2K / auto_3K use a capital letter which may fail FAL's string pattern
    // validator. Map them to explicit custom sizes instead.
    const AUTO_SIZE_MAP: Record<string, { width: number; height: number }> = {
      'auto_2K': { width: 2048, height: 2048 },
      'auto_3K': { width: 3072, height: 3072 },
    }
    if (image_size === 'custom' && custom_width && custom_height) {
      input.image_size = {
        width: parseInt(String(custom_width)),
        height: parseInt(String(custom_height)),
      }
    } else if (AUTO_SIZE_MAP[image_size]) {
      input.image_size = AUTO_SIZE_MAP[image_size]
    } else {
      input.image_size = image_size
    }

    // Upload reference images to Vercel Blob and pass HTTPS URLs.
    // FAL's image_urls field is validated as a URL string — data URIs fail
    // the pattern check, so we must supply real HTTPS URLs.
    const validUris: string[] = (images_base64 as any[])
      .slice(0, 10)
      .filter((uri: any) => typeof uri === 'string' && uri.length > 0)
      .map((uri: string) => uri.startsWith('data:') ? uri : `data:image/jpeg;base64,${uri}`)

    const imageUrls: string[] = []
    for (let i = 0; i < validUris.length; i++) {
      const uri = validUris[i]
      const mimeType = uri.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
      const base64Data = uri.replace(/^data:[^;]+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const blobResult = await put(`sd5-ref-${Date.now()}-${i}.${ext}`, buffer, {
        access: 'public',
        contentType: mimeType,
      })
      imageUrls.push(blobResult.url)
    }

    if (imageUrls.length > 0) {
      input.image_urls = imageUrls
    }

    console.log('SeedDream 5 Lite Edit request:', JSON.stringify({
      ...input,
      image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    }))

    let result: any
    try {
      const start = Date.now()
      result = await fal.subscribe('fal-ai/bytedance/seedream/v5/lite/edit', {
        input,
        logs: false,
      })
      const elapsed = Date.now() - start
      result._elapsed = elapsed
    } catch (falError: any) {
      // Surface the full FAL validation detail so it's visible in logs
      console.error('FAL API error:', {
        message: falError.message,
        status: falError.status,
        body: JSON.stringify(falError.body),
      })
      const detail = falError.body?.detail
      let detailMsg: string | null = null
      if (Array.isArray(detail)) {
        detailMsg = detail.map((d: any) => `${d.loc?.join('.')} — ${d.msg}`).join('; ')
      } else if (typeof detail === 'string') {
        detailMsg = detail
      } else if (detail) {
        detailMsg = JSON.stringify(detail)
      }
      const rawBody = JSON.stringify(falError.body)
      const errorMsg = detailMsg || falError.message || 'Generation failed'
      return NextResponse.json(
        { error: `${errorMsg} | FAL body: ${rawBody}` },
        { status: 500 }
      )
    }

    const elapsed: number = result._elapsed ?? 0
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
