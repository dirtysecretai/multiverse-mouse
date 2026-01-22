import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { put } from '@vercel/blob'
import { getTicketCost, getModelById } from '@/config/ai-models.config'
import { fal } from "@fal-ai/client"  // NEW: FAL.ai import

const prisma = new PrismaClient()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// NEW: Configure FAL.ai
fal.config({
  credentials: process.env.FAL_KEY
})

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

    // Check per-model maintenance status
    if (model === 'nano-banana' && systemState?.nanoBananaMaintenance) {
      return NextResponse.json(
        { error: 'NanoBanana is currently offline. Please try NanoBanana Pro or SeeDream 4.5 instead.' },
        { status: 503 }
      )
    }
    
    if (model === 'nano-banana-pro' && systemState?.nanoBananaProMaintenance) {
      return NextResponse.json(
        { error: 'NanoBanana Pro is currently offline. Please try NanoBanana or SeeDream 4.5 instead.' },
        { status: 503 }
      )
    }

    if (model === 'seedream-4.5' && systemState?.seedreamMaintenance) {
      return NextResponse.json(
        { error: 'SeeDream 4.5 is currently offline. Please try NanoBanana or NanoBanana Pro instead.' },
        { status: 503 }
      )
    }

    // Get ticket cost for selected model (quality-dependent for NanoBanana Pro)
    const ticketCost = getTicketCost(model, quality)
    console.log('Selected model:', selectedModel.displayName, '- Quality:', quality, '- Cost:', ticketCost, 'ticket(s)')

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

    let buffer: Buffer
    let imageBuffers: Buffer[] = []  // For multi-image models like NanoBanana

    // NEW: Route to correct provider based on model
    if (selectedModel.provider === 'fal') {
      // ============================================
      // FAL.AI PROVIDER (SeeDream, NanoBanana, etc.)
      // ============================================
      console.log('Using FAL.ai provider...')

      try {
        let modelEndpoint = selectedModel.name
        const inputParams: any = {
          prompt: prompt.trim(),
          enable_safety_checker: false  // DISABLED - Allows NSFW content
        }

        // Check if regular NanoBanana is trying to use reference images (not supported)
        if (model === 'nano-banana' && referenceImages && referenceImages.length > 0) {
          return NextResponse.json({
            error: 'NanoBanana does not support reference images. Please use NanoBanana Pro or SeeDream 4.5 for reference image features.'
          }, { status: 400 })
        }

        // Configure quality/resolution based on model
        if (model === 'seedream-4.5') {
          // SeeDream uses image_size object
          inputParams.image_size = quality === '4k' 
            ? { width: 2048, height: 2048 }  // 4MP max
            : { width: 1024, height: 1024 }  // 2K
          inputParams.max_images = 1
          inputParams.num_images = 1
        } else {
          // NanoBanana models use resolution string
          inputParams.resolution = quality === '4k' ? '4K' : '2K'
          inputParams.num_images = 1
        }

        // Handle reference images for models that support editing
        // Only SeeDream 4.5 and NanoBanana Pro support up to 10 reference images
        if (referenceImages && referenceImages.length > 0) {
          console.log(`Processing ${referenceImages.length} reference images for ${selectedModel.displayName} edit mode`)
          
          // Switch to edit endpoint based on model
          if (model === 'seedream-4.5') {
            modelEndpoint = 'fal-ai/bytedance/seedream/v4.5/edit'
            // SeeDream edit keeps image_size (already set above)
          } else if (model === 'nano-banana-pro') {
            modelEndpoint = 'fal-ai/nano-banana-pro/edit'
            // NanoBanana Pro edit keeps resolution (already set above)
          }
          
          // Upload reference images to FAL storage
          const imageUrls: string[] = []
          for (const imageBase64 of referenceImages) {
            try {
              // Convert base64 to buffer
              const base64Data = imageBase64.split(',')[1] || imageBase64
              const imageBuffer = Buffer.from(base64Data, 'base64')
              
              // Upload to FAL storage
              const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
              const file = new File([blob], `ref-${Date.now()}.jpg`, { type: 'image/jpeg' })
              const uploadedUrl = await fal.storage.upload(file)
              
              imageUrls.push(uploadedUrl)
              console.log(`Uploaded reference image: ${uploadedUrl}`)
            } catch (uploadError) {
              console.error('Failed to upload reference image:', uploadError)
            }
          }
          
          if (imageUrls.length > 0) {
            inputParams.image_urls = imageUrls
            console.log(`Using ${selectedModel.displayName} edit mode with ${imageUrls.length} reference images at ${inputParams.resolution || 'custom'} resolution`)
          } else {
            console.warn('No reference images uploaded successfully, falling back to text-to-image')
          }
        }

        // Special handling for NanoBanana: Generate 2 images with 2 separate API calls
        const imagesToGenerate = model === 'nano-banana' ? 2 : 1
        const allResults: any[] = []
        
        for (let i = 0; i < imagesToGenerate; i++) {
          console.log(`Generating image ${i + 1}/${imagesToGenerate}...`)
          
          const result = await fal.subscribe(modelEndpoint, {
            input: inputParams,
            logs: false
          })
          
          allResults.push(result)
          console.log(`Image ${i + 1}/${imagesToGenerate} generated successfully`)
        }

        // Combine all results
        const combinedImages: any[] = []
        for (const result of allResults) {
          if (result.data && result.data.images && result.data.images.length > 0) {
            combinedImages.push(...result.data.images)
          }
        }

        if (combinedImages.length === 0) {
          throw new Error('No images returned from FAL.ai')
        }

        console.log(`FAL.ai returned ${combinedImages.length} total image(s)`)

        // Process all images - use the outer imageBuffers array
        for (let i = 0; i < combinedImages.length; i++) {
          const imageUrl = combinedImages[i].url
          console.log(`Processing image ${i + 1}/${combinedImages.length}: ${imageUrl}`)

          // Download image from FAL.ai
          const imageResponse = await fetch(imageUrl)
          if (!imageResponse.ok) {
            console.error(`Failed to download image ${i + 1}`)
            continue
          }

          const imgBuffer = Buffer.from(await imageResponse.arrayBuffer())
          imageBuffers.push(imgBuffer)
          console.log(`Downloaded image ${i + 1}, size: ${imgBuffer.length} bytes`)
        }

        if (imageBuffers.length === 0) {
          throw new Error('Failed to download any images from FAL.ai')
        }

        // For single image models, use the first buffer
        // For multi-image models (NanoBanana), we'll handle all buffers below
        buffer = imageBuffers[0]

      } catch (error: any) {
        console.error('FAL.ai generation error:', error)
        console.error('FAL.ai error body:', error.body)
        console.error('FAL.ai error status:', error.status)
        console.error('FAL.ai request ID:', error.requestId)
        
        return NextResponse.json(
          { error: `FAL.ai generation failed: ${error.message}` },
          { status: 500 }
        )
      }

    } else {
      // ============================================
      // GEMINI PROVIDER (Existing code)
      // ============================================
      
      // Check if Gemini API is configured
      if (!GEMINI_API_KEY) {
        console.error('Gemini API key not configured')
        return NextResponse.json(
          { error: 'Multiverse Scanner not configured. Contact administrator.' },
          { status: 500 }
        )
      }

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
            ? 'Flash Scanner v2.5 (2000/day available!) or SeeDream 4.5' 
            : 'Pro Scanner v3 or SeeDream 4.5'
          
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
      buffer = Buffer.from(imageBytes, 'base64')
      console.log('Buffer size:', buffer.length, 'bytes')
    }

    // Upload to Vercel Blob
    console.log('Uploading to storage...')
    
    // For NanoBanana (multiple images), upload all
    // For other models (single image), upload one
    const uploadedImages: { url: string, id: string }[] = []
    
    // Determine if this is a multi-image generation
    const isMultiImage = model === 'nano-banana' && imageBuffers && imageBuffers.length > 1
    const buffersToUpload = isMultiImage ? imageBuffers : [buffer]
    
    console.log(`Uploading ${buffersToUpload.length} image(s)...`)
    
    for (let i = 0; i < buffersToUpload.length; i++) {
      const filename = `universe-scan-${user.id}-${Date.now()}-${i}.png`
      
      const blob = await put(filename, buffersToUpload[i], {
        access: 'public',
        contentType: 'image/png',
      })

      console.log(`Image ${i + 1} uploaded: ${blob.url}`)
      
      // Save each image to database
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const savedImage = await prisma.generatedImage.create({
        data: {
          userId: user.id,
          prompt: prompt.trim(),
          imageUrl: blob.url,
          model,
          ticketCost: isMultiImage ? 0 : ticketCost, // Only charge for first image in multi-gen
          expiresAt,
        },
      })

      uploadedImages.push({ url: blob.url, id: String(savedImage.id) })
      console.log(`Image ${i + 1} saved to database: ${savedImage.id}`)
    }

    // Consume tickets (only once, even for multi-image)
    console.log(`Consuming ${ticketCost} ticket(s)...`)
    const updatedTicket = await prisma.ticket.update({
      where: { userId: user.id },
      data: {
        balance: { decrement: ticketCost },
        totalUsed: { increment: ticketCost },
      },
    })
    console.log('Tickets consumed. New balance:', updatedTicket.balance)

    console.log('=== UNIVERSE SCAN COMPLETE ===')

    const generateTime = Date.now() - generateStart

    // Return appropriate response based on single or multi-image
    if (isMultiImage) {
      return NextResponse.json({
        success: true,
        images: uploadedImages, // Array of {url, id}
        imageUrl: uploadedImages[0].url, // Backwards compat
        imageId: uploadedImages[0].id, // Backwards compat
        newBalance: updatedTicket.balance,
        message: `Universe scan complete! Generated ${uploadedImages.length} images.`,
        generationTime: generateTime,
        modelUsed: selectedModel.displayName,
        ticketsUsed: ticketCost,
      })
    } else {
      return NextResponse.json({
        success: true,
        imageUrl: uploadedImages[0].url,
        imageId: uploadedImages[0].id,
        newBalance: updatedTicket.balance,
        message: 'Universe scan complete!',
        generationTime: generateTime,
        modelUsed: selectedModel.displayName,
        ticketsUsed: ticketCost,
      })
    }

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
