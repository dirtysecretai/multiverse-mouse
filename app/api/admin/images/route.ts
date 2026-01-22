import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Fetch all generated images with user info (admin only)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Get total count for pagination
    const total = await prisma.generatedImage.count({
      where: { isDeleted: false }
    })

    // Fetch images with user information
    const images = await prisma.generatedImage.findMany({
      where: { isDeleted: false },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    return NextResponse.json({
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching admin images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}
