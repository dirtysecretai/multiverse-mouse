import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const systemState = await prisma.systemState.findFirst()

    if (!systemState) {
      // Create default state if none exists
      const newState = await prisma.systemState.create({
        data: {
          isShopOpen: true,
          isMaintenanceMode: false,
          runesMaintenance: false,
          echoChamberMaintenance: false,
          galleriesMaintenance: false,
          promptPacksMaintenance: false,
          aiGenerationMaintenance: false,
        },
      })
      return NextResponse.json(newState)
    }

    return NextResponse.json(systemState)
  } catch (error: any) {
    console.error('Error fetching system state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system state' },
      { status: 500 }
    )
  }
}
