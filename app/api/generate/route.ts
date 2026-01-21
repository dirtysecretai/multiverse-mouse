import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { put } from '@vercel/blob'
import { getTicketCost, getModelById } from '@/config/ai-models.config'

const prisma = new PrismaClient()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: Request) {
  try {
    console.log('=== UNIVERSE SCAN STARTED ===')

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

    console.log('User:', user.email, 'Balance:', user.tickets?.balance)

    // Check system state
    const systemState = await prisma.systemState.findFirst()
    
    // Check global AI generation maintenance
    if (systemState?.aiGenerationMaintenance) {
      return NextResponse.json(
        { error: 'Multiverse Scanner is offline for maintenance' },
        { status: 503 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { 
      prompt, 
      quality = '2k', 
      aspectRatio = '16:9', 
      referenceImages = [],
      model = 'gemini-3-pro-image'
    } = body

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Universe coordinates required' },
        { status: 400 }
      )
    }

    // Validate model exists and is available
    const selectedModel = getModelById(model)
    if (!selectedModel || !selectedModel.isAvailable) {
      return NextResponse.json({ 
        error: `Model ${model} is not available. Please select a different model.` 
      }, { status: 400 })
    }

    // NEW: Check per-model maintenance status
    if (model === 'gemini-3-pro-image-preview' && systemState?.geminiProMaintenance) {
      return NextResponse.json(
        { error: 'Pro Scanner v3 is currently offline. Please try Flash Scanner v2.5 instead.' },
        { status: 503 }
      )
    }
    
    if (model === 'gemini-2.5-flash-image' && systemState?.geminiFlashMaintenance) {
      return NextResponse.json(
        { error: 'Flash Scanner v2.5 is currently offline. Please try Pro Scanner v3 instead.' },
        { status: 503 }
      )
    }

    // Get ticket cost for selected model
    const ticketCost = getTicketCost(model)
    console.log('Selected model:', selectedModel.displayName, '- Cost:', ticketCost, 'ticket(s)')

    // Check ticket balance
    const ticketRecord = await prisma.ticket.findUnique({
      where: { userId: user.id }
    })

    if (!ticketRecord || ticketRecord.balance < ticketCost) {
      return NextResponse.json(
        { error: `Insufficient tickets. Need ${ticketCost} ticket(s), but you have ${ticketRecord?.balance || 0}.` },
        { status: 402 }
      )
    }

    // Check if Gemini API is configured
    if (!GEMINI_API_KEY) {
      console.error('Gemini API key not configured')
      return NextResponse.json(
        { error: 'Multiverse Scanner not configured. Contact administrator.' },
        { status: 500 }
      )
    }

    console.log('Scanning universe with coordinates:', prompt)
    console.log('Parameters:', { 
      model: selectedModel.displayName,
      quality, 
      aspectRatio, 
      referenceImageCount: referenceImages.length,
      ticketCost
    })

    // Generate image using selected model
    console.log(`Generating image with ${selectedModel.displayName}...`)
    const generateStart = Date.now()

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`

    // Build content parts array
    const contentParts: any[] = []

    // Add reference images first if provided
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Adding ${referenceImages.length} reference images`)
      for (const imageBase64 of referenceImages) {
        const base64Data = imageBase64.split(',')[1] || imageBase64
        contentParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        })
      }
    }

    // Add text prompt with enhanced quality instructions
    const qualityInstructions = quality === '4k' 
      ? 'Generate in ultra-high resolution 4K quality with maximum detail and clarity. ' 
      : ''
    
    const aspectInstructions = `Aspect ratio must be ${aspectRatio}. `
    const fullPrompt = qualityInstructions + aspectInstructions + prompt.trim()
    
    contentParts.push({
      text: fullPrompt
    })

    const imageSize = quality.toUpperCase()
    
    const requestBody: any = {
      contents: [{
        parts: contentParts
      }],
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        topK: 40,
      }
    }

    console.log('Calling Gemini API with', contentParts.length, 'parts...')
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API call failed:', response.status, errorText)
      
      // Check for rate limit error (429)
      if (response.status === 429) {
        const otherModel = model === 'gemini-3-pro-image-preview' 
          ? 'Flash Scanner v2.5 (2000/day available!)' 
          : 'Pro Scanner v3'
        
        return NextResponse.json({ 
          error: `Daily quota exceeded for ${selectedModel.displayName}. This model has reached its ${selectedModel.rateLimit.rpd} requests/day limit. Try switching to ${otherModel} or wait until tomorrow when quotas reset.` 
        }, { status: 429 })
      }
      
      return NextResponse.json(
        { 
          error: `Generation failed: ${response.status}`,
          details: errorText.substring(0, 300)
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    const generateTime = Date.now() - generateStart
    console.log(`Image generated in ${generateTime}ms`)

    // Extract image from response
    if (!result.candidates || result.candidates.length === 0) {
      console.error('No candidates in response:', result)
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      )
    }

    const candidate = result.candidates[0]
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('No content parts in candidate:', candidate)
      return NextResponse.json(
        { error: 'Invalid response structure' },
        { status: 500 }
      )
    }

    // Loop through ALL parts to find the image
    let imageBytes
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        imageBytes = part.inlineData.data
        console.log('Found image in inlineData, size:', imageBytes.length)
        break
      } else if (part.text) {
        console.log('Model included text:', part.text.substring(0, 100))
      }
    }
    
    if (!imageBytes) {
      console.error('No image data found in any part')
      return NextResponse.json(
        { error: 'Model returned text instead of image. Try a different prompt or remove reference images.' },
        { status: 500 }
      )
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(imageBytes, 'base64')
    console.log('Buffer size:', buffer.length, 'bytes')

    // Upload to Vercel Blob
    console.log('Uploading to storage...')
    const filename = `universe-scan-${user.id}-${Date.now()}.png`
    
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    })

    console.log('Image uploaded:', blob.url)

    // Consume tickets
    console.log(`Consuming ${ticketCost} ticket(s)...`)
    const updatedTicket = await prisma.ticket.update({
      where: { userId: user.id },
      data: {
        balance: { decrement: ticketCost },
        totalUsed: { increment: ticketCost },
      },
    })
    console.log('Tickets consumed. New balance:', updatedTicket.balance)

    // Save with model tracking
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const savedImage = await prisma.generatedImage.create({
      data: {
        userId: user.id,
        prompt: prompt.trim(),
        imageUrl: blob.url,
        model,
        ticketCost,
        expiresAt,
      },
    })

    console.log('Image saved to database:', savedImage.id)
    console.log('=== UNIVERSE SCAN COMPLETE ===')

    return NextResponse.json({
      success: true,
      imageUrl: blob.url,
      imageId: savedImage.id,
      newBalance: updatedTicket.balance,
      message: 'Universe scan complete!',
      generationTime: generateTime,
      modelUsed: selectedModel.displayName,
      ticketsUsed: ticketCost,
    })

  } catch (error: any) {
    console.error('=== UNIVERSE SCAN ERROR ===')
    console.error('Error:', error)
    console.error('Stack:', error.stack)

    return NextResponse.json(
      {
        error: 'Universe scan failed. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
