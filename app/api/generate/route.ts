import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { put } from '@vercel/blob'

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
    if (systemState?.aiGenerationMaintenance) {
      return NextResponse.json(
        { error: 'Multiverse Scanner is offline for maintenance' },
        { status: 503 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { prompt, quality = '2k', aspectRatio = '16:9', referenceImages = [] } = body

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Universe coordinates required' },
        { status: 400 }
      )
    }

    // Check ticket balance
    const ticketRecord = await prisma.ticket.findUnique({
      where: { userId: user.id }
    })

    if (!ticketRecord || ticketRecord.balance < 1) {
      return NextResponse.json(
        { error: 'Insufficient tickets. Purchase more to continue scanning.' },
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
    console.log('Parameters:', { quality, aspectRatio, referenceImageCount: referenceImages.length })

    // Generate image using Gemini API (Nano Banana Pro)
    console.log('Generating image with Nano Banana Pro...')
    const generateStart = Date.now()

    // Use the correct Gemini API endpoint
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`

    // Build content parts array
    const contentParts: any[] = []

    // Add reference images first if provided
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Adding ${referenceImages.length} reference images`)
      for (const imageBase64 of referenceImages) {
        // Extract base64 data (remove data:image/...;base64, prefix)
        const base64Data = imageBase64.split(',')[1] || imageBase64
        contentParts.push({
          inlineData: {
            mimeType: 'image/jpeg', // or detect from base64
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

    const requestBody = {
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

    const part = candidate.content.parts[0]
    
    // Image should be in inlineData
    let imageBytes
    if (part.inlineData && part.inlineData.data) {
      imageBytes = part.inlineData.data
      console.log('Found image in inlineData, size:', imageBytes.length)
    } else if (part.text) {
      // Model returned text instead of image
      console.error('Model returned text instead of image:', part.text.substring(0, 200))
      return NextResponse.json(
        { error: 'Model returned text instead of image. Try a different prompt or remove reference images.' },
        { status: 500 }
      )
    } else {
      console.error('Could not find image data in part:', JSON.stringify(part, null, 2))
      return NextResponse.json(
        { error: 'No image data in response' },
        { status: 500 }
      )
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(imageBytes, 'base64')
    console.log('Buffer size:', buffer.length, 'bytes')

    // Upload to Vercel Blob with proper content type for 4K
    console.log('Uploading to storage...')
    const filename = `universe-scan-${user.id}-${Date.now()}.png`
    
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png', // Always PNG for best quality
    })

    console.log('Image uploaded:', blob.url)

    // Consume 1 ticket
    console.log('Consuming ticket...')
    const updatedTicket = await prisma.ticket.update({
      where: { userId: user.id },
      data: {
        balance: { decrement: 1 },
        totalUsed: { increment: 1 },
      },
    })
    console.log('Ticket consumed. New balance:', updatedTicket.balance)

    // Save generated image to database
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    const savedImage = await prisma.generatedImage.create({
      data: {
        userId: user.id,
        prompt: prompt.trim(),
        imageUrl: blob.url,
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





