import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Fetch current admin configuration
export async function GET() {
  try {
    const config = await prisma.systemState.findFirst()
    
    if (!config) {
      // Create default config if none exists
      const newConfig = await prisma.systemState.create({
        data: {
          isShopOpen: false,
          isMaintenanceMode: false,
          runesMaintenance: false,
          echoChamberMaintenance: false,
          galleriesMaintenance: false,
          promptPacksMaintenance: false,
          aiGenerationMaintenance: false,
          geminiProMaintenance: false,
          geminiFlashMaintenance: false,
        }
      })
      return NextResponse.json(newConfig)
    }
    
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error fetching config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    )
  }
}

// POST - Update admin configuration
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Find or create the system state
    let config = await prisma.systemState.findFirst()
    
    if (!config) {
      // Create if doesn't exist
      config = await prisma.systemState.create({
        data: {
          isShopOpen: body.isShopOpen ?? false,
          isMaintenanceMode: body.isMaintenanceMode ?? false,
          runesMaintenance: body.runesMaintenance ?? false,
          echoChamberMaintenance: body.echoChamberMaintenance ?? false,
          galleriesMaintenance: body.galleriesMaintenance ?? false,
          promptPacksMaintenance: body.promptPacksMaintenance ?? false,
          aiGenerationMaintenance: body.aiGenerationMaintenance ?? false,
          geminiProMaintenance: body.geminiProMaintenance ?? false,
          geminiFlashMaintenance: body.geminiFlashMaintenance ?? false,
        }
      })
    } else {
      // Update existing
      config = await prisma.systemState.update({
        where: { id: config.id },
        data: {
          isShopOpen: body.isShopOpen ?? config.isShopOpen,
          isMaintenanceMode: body.isMaintenanceMode ?? config.isMaintenanceMode,
          runesMaintenance: body.runesMaintenance ?? config.runesMaintenance,
          echoChamberMaintenance: body.echoChamberMaintenance ?? config.echoChamberMaintenance,
          galleriesMaintenance: body.galleriesMaintenance ?? config.galleriesMaintenance,
          promptPacksMaintenance: body.promptPacksMaintenance ?? config.promptPacksMaintenance,
          aiGenerationMaintenance: body.aiGenerationMaintenance ?? config.aiGenerationMaintenance,
          geminiProMaintenance: body.geminiProMaintenance ?? config.geminiProMaintenance,
          geminiFlashMaintenance: body.geminiFlashMaintenance ?? config.geminiFlashMaintenance,
        }
      })
    }
    
    console.log('Config updated:', config)
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    )
  }
}
