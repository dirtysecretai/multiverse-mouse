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
        expiresAt: {
          gt: new Date()
        }
      }
    })

    // Fetch paginated user's generated images (not expired, ordered by newest first)
    const images = await prisma.generatedImage.findMany({
      where: {
        userId: user.id,
        expiresAt: {
          gt: new Date() // Only get images that haven't expired
        }
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
  }
}
