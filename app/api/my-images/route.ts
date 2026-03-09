import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

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

    // Get total count for pagination
    const total = await prisma.generatedImage.count({
      where: {
        userId: user.id,
        isDeleted: false,
        expiresAt: { gt: new Date() },
      }
    })

    // Fetch paginated user's generated images (not expired, not deleted, newest first)
    const images = await prisma.generatedImage.findMany({
      where: {
        userId: user.id,
        isDeleted: false,
        expiresAt: { gt: new Date() },
      },
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
        referenceImageUrls: img.referenceImageUrls || [], // Reference images used for this generation
        createdAt: img.createdAt,
        expiresAt: img.expiresAt,
        videoMetadata: img.videoMetadata || null, // Video metadata for video items
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

    // Only delete images that belong to this user — prevents any cross-user deletion
    const result = await prisma.generatedImage.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
      },
      data: { isDeleted: true },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error: any) {
    console.error('Error deleting images:', error)
    return NextResponse.json({ error: 'Failed to delete images' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
