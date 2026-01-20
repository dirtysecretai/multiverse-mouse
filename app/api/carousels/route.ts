import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Get all active carousel images, ordered by position
    const leftImages = await prisma.carouselImage.findMany({
      where: {
        side: 'left',
        isActive: true
      },
      orderBy: {
        position: 'asc'
      }
    })

    const rightImages = await prisma.carouselImage.findMany({
      where: {
        side: 'right',
        isActive: true
      },
      orderBy: {
        position: 'asc'
      }
    })

    return NextResponse.json({
      left: leftImages || [],
      right: rightImages || []
    })
  } catch (error) {
    console.error('Error fetching carousel images:', error)
    // Return empty arrays instead of error to prevent JSON parsing issues
    return NextResponse.json({
      left: [],
      right: []
    })
  }
}


