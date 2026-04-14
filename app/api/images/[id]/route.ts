import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import sharp from 'sharp'

const prisma = new PrismaClient()

// Authenticated image proxy — serves a user's image by DB ID.
// The direct Vercel Blob URL is never exposed to the browser.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return new NextResponse('Unauthorized', { status: 401 })

    const user = await getUserFromSession(token)
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return new NextResponse('Invalid ID', { status: 400 })

    // Only serve images that belong to this user and are not deleted
    const image = await prisma.generatedImage.findFirst({
      where: { id, userId: user.id, isDeleted: false },
      select: { imageUrl: true },
    })

    if (!image) return new NextResponse('Not found', { status: 404 })

    const blobRes = await fetch(image.imageUrl)
    if (!blobRes.ok) return new NextResponse('Image unavailable', { status: 404 })

    const searchParams = new URL(request.url).searchParams
    const isDownload = searchParams.get('download') === '1'
    const isThumb = searchParams.get('thumb') === '1'
    const contentType = blobRes.headers.get('content-type') || 'image/png'
    const ext = contentType.includes('jpeg') ? 'jpg'
              : contentType.includes('webp') ? 'webp'
              : 'png'

    if (isThumb) {
      const buffer = Buffer.from(await blobRes.arrayBuffer())
      const thumb = await sharp(buffer)
        .resize({ width: 600, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer()
      return new NextResponse(new Uint8Array(thumb), {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, max-age=86400',
        },
      })
    }

    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    }

    if (isDownload) {
      headers['Content-Disposition'] = `attachment; filename="image-${id}.${ext}"`
    }

    return new NextResponse(blobRes.body, { status: 200, headers })
  } catch (error) {
    console.error('Image proxy error:', error)
    return new NextResponse('Server error', { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
