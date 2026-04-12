import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { del } from '@vercel/blob'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = await getUserFromSession(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit
    const type = searchParams.get('type') // 'image' | 'video' | null (all)

    const VIDEO_MODELS = ['wan-2.5', 'kling-v3', 'kling-o3', 'kling-v3-motion', 'seedance-1.5', 'seedance-2.0', 'seedance-2.0-fast', 'lipsync-v3']
    const typeFilter = type === 'image'
      ? { model: { notIn: VIDEO_MODELS } }
      : type === 'video'
      ? { model: { in: VIDEO_MODELS } }
      : {}

    const baseWhere = {
      userId: user.id,
      isDeleted: false,
      ...typeFilter,
    }

    const total = await prisma.generatedImage.count({ where: baseWhere })

    // Fetch paginated user's generated images (not expired, not deleted, newest first)
    const images = await prisma.generatedImage.findMany({
      where: baseWhere,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    })

    return NextResponse.json({
      success: true,
      images: images.map(img => ({
        id: img.id,
        prompt: img.prompt,
        imageUrl: img.imageUrl,
        model: img.model,
        referenceImageUrls: img.referenceImageUrls || [],
        createdAt: img.createdAt,
        expiresAt: img.expiresAt,
        quality: img.quality || null,
        aspectRatio: img.aspectRatio || null,
        videoMetadata: img.videoMetadata || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error: any) {
    console.error('Error fetching generated images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// DELETE /api/my-images
// Body: { ids: number[] }
// Soft-deletes the specified images after verifying they belong to the user.
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const user = await getUserFromSession(token)
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const body = await request.json()
    const ids: number[] = body.ids

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No image IDs provided' }, { status: 400 })
    }

    // Fetch blob URLs before soft-deleting so we can remove them from Vercel Blob
    const images = await prisma.generatedImage.findMany({
      where: { id: { in: ids }, userId: user.id, isDeleted: false },
      select: { id: true, imageUrl: true },
    })

    // Only delete images that belong to this user — prevents any cross-user deletion
    const result = await prisma.generatedImage.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { isDeleted: true },
    })

    // Hard-delete the actual files from Vercel Blob storage (non-fatal if it fails)
    if (images.length > 0) {
      try {
        await del(images.map(img => img.imageUrl))
      } catch (blobErr) {
        console.error('Blob deletion failed (non-fatal):', blobErr)
      }
    }

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error: any) {
    console.error('Error deleting images:', error)
    return NextResponse.json({ error: 'Failed to delete images' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
