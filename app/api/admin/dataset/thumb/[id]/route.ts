import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

// GET /api/admin/dataset/thumb/[id]
// Serves a 400px webp thumbnail for a dataset image.
// Public (no auth) — dataset images are on a public R2 bucket anyway.
// 7-day immutable browser cache so grid loads are instant on repeat visits.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const imageId = parseInt(id)
  if (isNaN(imageId)) return new NextResponse('Invalid id', { status: 400 })

  const image = await prisma.generatedImage.findFirst({
    where: { id: imageId, isDeleted: false },
    select: { imageUrl: true },
  })

  if (!image) return new NextResponse('Not found', { status: 404 })

  // Skip videos — return 404 so the caller can fall back
  if (/\.(mp4|webm|mov|avi|mkv)$/i.test(image.imageUrl)) {
    return new NextResponse('Not an image', { status: 404 })
  }

  try {
    const res = await fetch(image.imageUrl, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return new NextResponse('Image unavailable', { status: 502 })

    const buffer = Buffer.from(await res.arrayBuffer())
    const thumb = await sharp(buffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()

    return new NextResponse(new Uint8Array(thumb), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        // 7-day immutable cache — thumbnails never change for a given image ID
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    })
  } catch (err: any) {
    console.error('Dataset thumb error:', err.message)
    return new NextResponse('Server error', { status: 500 })
  }
}
