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

    // Fetch user's generated images (not expired, ordered by newest first)
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
      take: 50 // Limit to 50 most recent
    })

    return NextResponse.json({
      success: true,
      images: images.map(img => ({
        id: img.id,
        prompt: img.prompt,
        imageUrl: img.imageUrl,
        createdAt: img.createdAt,
        expiresAt: img.expiresAt,
      }))
    })

  } catch (error: any) {
    console.error('Error fetching generated images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}
