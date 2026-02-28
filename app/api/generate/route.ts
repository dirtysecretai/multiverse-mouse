import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { put } from '@vercel/blob'
import { getTicketCost, getModelById } from '@/config/ai-models.config'
import { fal } from "@fal-ai/client"

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
      model = 'gemini-2.5-flash-image',  // Default to Flash Scanner v2.5
      adminMode = false,  // Admin mode - no ticket deduction
      syncMode = false,   // If true: wait for FAL.ai and return imageUrl directly (used by composition canvas)
    } = body

    // Check if admin mode is requested and user is actually admin
    const isAdminUser = user.email === 'dirtysecretai@gmail.com'
    const skipTickets = adminMode && isAdminUser

    if (skipTickets) {
      console.log('🔓 ADMIN MODE: Skipping ticket check/deduction for', user.email)
    }

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

    // Check ticket balance (skip for admin mode)
    const ticketRecord = await prisma.ticket.findUnique({
      where: { userId: user.id }
    })

    // Effective available balance = balance minus any tickets already reserved for
    // in-flight async jobs. This prevents over-committing when multiple jobs fire rapidly.
    const effectiveBalance = (ticketRecord?.balance || 0) - (ticketRecord?.reserved || 0)
    if (!skipTickets && effectiveBalance < ticketCost) {
      return NextResponse.json(
        { error: `Insufficient tickets. Need ${ticketCost} ticket(s), but you have ${effectiveBalance}.` },
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
    let imageBuffers: Buffer[] = []  // For multi-image models (Gemini only now)

    // Route to correct provider based on model
    if (selectedModel.provider === 'fal') {
      // ============================================
      // FAL.AI PROVIDER — ASYNC via fal.queue.submit
      // Images arrive via webhook at /api/webhooks/fal
      // ============================================
      console.log('Using FAL.ai async queue...')

      let reservationMade = false
      try {
        let modelEndpoint = selectedModel.name

        const inputParams: any = {
          prompt: prompt.trim()
        }

        // Only add enable_safety_checker for models that support it (SeeDream)
        if (model === 'seedream-4.5') {
          inputParams.enable_safety_checker = false
        }

        // Check if regular NanoBanana is trying to use reference images (not supported)
        if (model === 'nano-banana' && referenceImages && referenceImages.length > 0) {
          return NextResponse.json({
            error: 'NanoBanana does not support reference images. Please use NanoBanana Pro or SeeDream 4.5 for reference image features.'
          }, { status: 400 })
        }

        // Configure quality/resolution based on model
        if (model === 'seedream-4.5') {
          const qualityMultiplier = quality === '4k' ? 2 : 1
          const baseSizes: Record<string, { width: number, height: number }> = {
            '1:1': { width: 1024, height: 1024 },
            '4:5': { width: 896, height: 1152 },
            '3:4': { width: 896, height: 1152 },
            '2:3': { width: 896, height: 1344 },
            '9:16': { width: 768, height: 1344 },
            '16:9': { width: 1344, height: 768 },
            '3:2': { width: 1344, height: 896 },
            '4:3': { width: 1152, height: 896 },
            '21:9': { width: 1536, height: 640 },
          }
          const dimensions = baseSizes[aspectRatio] || baseSizes['1:1']
          inputParams.image_size = {
            width: dimensions.width * qualityMultiplier,
            height: dimensions.height * qualityMultiplier
          }
          inputParams.max_images = 1
          inputParams.num_images = 1
          console.log(`SeeDream 4.5: ${inputParams.image_size.width}x${inputParams.image_size.height}`)

        } else if (model === 'flux-2') {
          const fluxSizeMap: Record<string, string> = {
            '1:1': 'square_hd',
            '4:3': 'landscape_4_3',
            '3:4': 'portrait_4_3',
            '16:9': 'landscape_16_9',
            '9:16': 'portrait_16_9',
          }
          if (quality === '4k') {
            const baseSizes: Record<string, { width: number, height: number }> = {
              '1:1': { width: 1536, height: 1536 },
              '4:5': { width: 1344, height: 1680 },
              '3:4': { width: 1344, height: 1792 },
              '9:16': { width: 1080, height: 1920 },
              '16:9': { width: 1920, height: 1080 },
              '4:3': { width: 1792, height: 1344 },
              '3:2': { width: 1920, height: 1280 },
            }
            const dimensions = baseSizes[aspectRatio] || baseSizes['1:1']
            inputParams.image_size = { width: dimensions.width, height: dimensions.height }
          } else {
            inputParams.image_size = fluxSizeMap[aspectRatio] || 'square_hd'
          }
          inputParams.num_images = 1
          inputParams.output_format = 'png'
          inputParams.enable_safety_checker = false
          inputParams.guidance_scale = 2.5
          inputParams.num_inference_steps = 28
          console.log(`FLUX 2: ${JSON.stringify(inputParams.image_size)}`)

        } else {
          // NanoBanana / NanoBanana Pro
          inputParams.resolution = quality === '4k' ? '4K' : '2K'
          inputParams.aspect_ratio = aspectRatio
          inputParams.output_format = 'png'
          // NanoBanana generates 2 images in one async job
          inputParams.num_images = model === 'nano-banana' ? 2 : 1
          inputParams.limit_generations = true
          console.log(`NanoBanana: resolution=${inputParams.resolution} aspect=${aspectRatio} num_images=${inputParams.num_images}`)
        }

        // Handle reference images (upload to FAL storage first)
        const permanentReferenceUrls: string[] = []
        if (referenceImages && referenceImages.length > 0) {
          console.log(`Processing ${referenceImages.length} reference images for ${selectedModel.displayName} edit mode`)

          if (model === 'seedream-4.5') {
            modelEndpoint = 'fal-ai/bytedance/seedream/v4.5/edit'
          } else if (model === 'nano-banana-pro') {
            modelEndpoint = 'fal-ai/nano-banana-pro/edit'
          } else if (model === 'flux-2') {
            modelEndpoint = 'fal-ai/flux-2/edit'
          }

          const maxImages = model === 'flux-2' ? 4 : referenceImages.length
          const imagesToUpload = referenceImages.slice(0, maxImages)

          const imageUrls: string[] = []
          for (const imageBase64 of imagesToUpload) {
            try {
              const base64Data = imageBase64.split(',')[1] || imageBase64
              const imageBuffer = Buffer.from(base64Data, 'base64')
              const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
              const uploadedUrl = await fal.storage.upload(blob)
              imageUrls.push(uploadedUrl)

              // Also save to permanent Vercel Blob storage for the DB record
              const refFilename = `reference-${user.id}-${Date.now()}-${imageUrls.length}.jpg`
              const refBlob = await put(refFilename, imageBuffer, {
                access: 'public',
                contentType: 'image/jpeg',
              })
              permanentReferenceUrls.push(refBlob.url)
            } catch (uploadError) {
              console.error('Failed to upload reference image:', uploadError)
            }
          }

          if (imageUrls.length > 0) {
            inputParams.image_urls = imageUrls
            console.log(`Edit mode: ${imageUrls.length} reference images uploaded`)
          }
        }

        if (syncMode) {
          // ─── SYNCHRONOUS PATH (composition canvas) ────────────────────
          // Wait for FAL.ai to finish and return imageUrl immediately.
          console.log(`Calling FAL.ai synchronously: ${modelEndpoint}`)
          const result = await fal.subscribe(modelEndpoint, { input: inputParams, logs: false })
          const falImageUrl = result.data.images?.[0]?.url
          if (!falImageUrl) throw new Error('FAL.ai did not return an image')

          // Download from FAL temporary storage and re-host on Vercel Blob
          const falRes = await fetch(falImageUrl)
          const imageBuffer = Buffer.from(await falRes.arrayBuffer())
          const filename = `universe-scan-${user.id}-${Date.now()}.png`
          const blob = await put(filename, imageBuffer, { access: 'public', contentType: 'image/png' })
          console.log(`Sync image uploaded to Blob: ${blob.url}`)

          // Save to database
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 30)
          await prisma.generatedImage.create({
            data: {
              userId: user.id,
              prompt: prompt.trim(),
              imageUrl: blob.url,
              model,
              ticketCost: skipTickets ? 0 : ticketCost,
              referenceImageUrls: permanentReferenceUrls,
              expiresAt,
            },
          })

          // Deduct tickets
          let syncUpdatedTicket = ticketRecord
          if (!skipTickets) {
            syncUpdatedTicket = await prisma.ticket.update({
              where: { userId: user.id },
              data: { balance: { decrement: ticketCost }, totalUsed: { increment: ticketCost } },
            })
          }

          const newBalance = skipTickets
            ? (ticketRecord?.balance || 0)
            : (syncUpdatedTicket?.balance || 0)

          console.log('=== FAL.AI SYNC GENERATION COMPLETE ===')
          return NextResponse.json({ imageUrl: blob.url, newBalance, modelUsed: selectedModel.displayName })

        } else {
          // ─── ASYNC SUBMIT TO FAL.AI (main portal queue flow) ─────────
          const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`
          const webhookUrl = `${appUrl}/api/webhooks/fal`

          console.log(`Submitting to FAL.ai queue: ${modelEndpoint}`)
          console.log(`Webhook URL: ${webhookUrl}`)

          const { request_id } = await fal.queue.submit(modelEndpoint, {
            input: inputParams,
            webhookUrl,
          })

          console.log(`FAL.ai accepted job, request_id: ${request_id}`)

          // Reserve tickets — do NOT decrement balance yet.
          // The balance is only decremented by the webhook once FAL.ai confirms
          // the image was delivered. On failure the reservation is simply released,
          // so no tickets are ever lost to a failed or missing webhook.
          if (!skipTickets) {
            await prisma.ticket.update({
              where: { userId: user.id },
              data: { reserved: { increment: ticketCost } }
            })
            reservationMade = true
          }

          // Fetch updated ticket record so we can return the current effective balance
          const updatedTicket = await prisma.ticket.findUnique({
            where: { userId: user.id }
          })

          // Create queue entry
          const queueEntry = await prisma.generationQueue.create({
            data: {
              userId: user.id,
              modelId: model,
              modelType: 'image',
              prompt: prompt.trim(),
              parameters: {
                quality,
                aspectRatio,
                model,
                adminMode: skipTickets,
                referenceImageUrls: permanentReferenceUrls,
              },
              status: 'processing',
              ticketCost: skipTickets ? 0 : ticketCost,
              falRequestId: request_id,
              startedAt: new Date(),
            }
          })

          // Increment active count for this model
          await prisma.modelConcurrencyLimit.updateMany({
            where: { modelId: model },
            data: { currentActive: { increment: 1 } }
          })

          console.log(`Queue entry created: #${queueEntry.id}`)
          console.log('=== FAL.AI JOB SUBMITTED — AWAITING WEBHOOK ===')

          // Effective balance = balance minus all reserved tickets (including this new one)
          const newBalance = skipTickets
            ? (ticketRecord?.balance || 0)
            : Math.max(0, (updatedTicket?.balance || 0) - (updatedTicket?.reserved || 0))

          return NextResponse.json({
            queueId: queueEntry.id,
            status: 'processing',
            newBalance,
            message: skipTickets
              ? `Admin scan queued! (FREE) — image will appear shortly.`
              : `Universe scan queued! ${ticketCost} ticket(s) reserved.`,
            modelUsed: selectedModel.displayName,
            ticketsUsed: skipTickets ? 0 : ticketCost,
          })
        }

      } catch (error: any) {
        console.error('FAL.ai queue submit error:', error)
        // If the reservation was made before the error, release it so tickets
        // aren't stuck in "reserved" state from a job that will never complete.
        if (reservationMade) {
          await prisma.ticket.update({
            where: { userId: user.id },
            data: { reserved: { decrement: ticketCost } }
          }).catch(e => console.error('Failed to release reservation on error:', e))
        }
        return NextResponse.json(
          { error: `FAL.ai submission failed: ${error.message}` },
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

      // Use the model's actual name (not ID) for API calls
      const modelName = selectedModel.name
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`

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

      // Check for prompt-level blocks FIRST (blocked before generation even starts)
      if (result.promptFeedback && result.promptFeedback.blockReason) {
        const blockReason = result.promptFeedback.blockReason
        console.error('Prompt blocked:', {
          blockReason,
          promptFeedback: result.promptFeedback,
          prompt: prompt.substring(0, 100)
        })
        
        return NextResponse.json({
          error: 'Sensitive content detected. Ticket not charged. Try another prompt or use SeeDream 4.5 / NanoBanana Pro for less restrictive generation.',
          blocked: true
        }, { status: 400 })
      }

      // Extract image from response
      if (!result.candidates || result.candidates.length === 0) {
        console.error('No candidates in response:', result)
        return NextResponse.json(
          { error: 'No image generated' },
          { status: 500 }
        )
      }

      const candidate = result.candidates[0]
      
      // Check for content filtering BEFORE checking content parts
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        const finishReason = candidate.finishReason
        const finishMessage = candidate.finishMessage || ''
        
        console.error('Generation blocked:', {
          finishReason,
          finishMessage,
          prompt: prompt.substring(0, 100)
        })
        
        // Specific handling for different block reasons
        if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY' || finishReason === 'IMAGE_OTHER') {
          return NextResponse.json({
            error: 'Sensitive content detected. Ticket not charged. Try another prompt or use SeeDream 4.5 / NanoBanana Pro for less restrictive generation.',
            blocked: true
          }, { status: 400 })
        }
        
        // Other finish reasons
        return NextResponse.json({
          error: `Generation blocked: ${finishReason}. Ticket not charged. Try rephrasing your prompt.`,
          blocked: true
        }, { status: 400 })
      }
      
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('No content parts in candidate:', candidate)
        return NextResponse.json(
          { error: 'Invalid response structure' },
          { status: 500 }
        )
      }

      // Loop through ALL parts to find the image
      let imageBytes
      let refusalText = ''
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          imageBytes = part.inlineData.data
          console.log('Found image in inlineData, size:', imageBytes.length)
          break
        } else if (part.text) {
          refusalText = part.text
          console.log('Model included text:', part.text.substring(0, 100))
        }
      }
      
      if (!imageBytes) {
        console.error('No image data found in any part')
        
        // Check if the text is a refusal due to sensitive content
        const sensitiveKeywords = ['explicit', 'nudity', 'nude', 'sexually', "can't create", "cannot create", "inappropriate", "unsafe"]
        const isSensitiveRefusal = sensitiveKeywords.some(keyword => 
          refusalText.toLowerCase().includes(keyword)
        )
        
        if (isSensitiveRefusal) {
          return NextResponse.json(
            { 
              error: 'Sensitive content detected. Ticket not charged. Try another prompt or use SeeDream 4.5 / NanoBanana Pro for less restrictive generation.',
              blocked: true
            },
            { status: 400 }
          )
        }
        
        // Generic error for other text responses
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

    // First, upload reference images to permanent storage (if any)
    const permanentReferenceUrls: string[] = []
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Uploading ${referenceImages.length} reference image(s) to permanent storage...`)
      for (let i = 0; i < referenceImages.length; i++) {
        try {
          const base64Data = referenceImages[i].split(',')[1] || referenceImages[i]
          const refBuffer = Buffer.from(base64Data, 'base64')
          const refFilename = `reference-${user.id}-${Date.now()}-${i}.jpg`

          const refBlob = await put(refFilename, refBuffer, {
            access: 'public',
            contentType: 'image/jpeg',
          })

          permanentReferenceUrls.push(refBlob.url)
          console.log(`Reference image ${i + 1} uploaded: ${refBlob.url}`)
        } catch (refErr) {
          console.error(`Failed to upload reference image ${i + 1}:`, refErr)
        }
      }
    }

    // For NanoBanana (multiple images), upload all
    // For other models (single image), upload one
    const uploadedImages: { url: string, id: string }[] = []

    // Determine if this is a multi-image generation
    const isMultiImage = model === 'nano-banana' && imageBuffers && imageBuffers.length > 1
    const buffersToUpload = isMultiImage ? imageBuffers : [buffer]

    console.log(`Uploading ${buffersToUpload.length} generated image(s)...`)
    
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
          ticketCost: skipTickets ? 0 : (isMultiImage ? 0 : ticketCost), // 0 for admin mode, only charge for first image in multi-gen
          referenceImageUrls: permanentReferenceUrls, // Save reference images used
          expiresAt,
        },
      })

      uploadedImages.push({ url: blob.url, id: String(savedImage.id) })
      console.log(`Image ${i + 1} saved to database: ${savedImage.id}`)
    }

    // Consume tickets (only once, even for multi-image) - skip for admin mode
    let updatedTicket = ticketRecord
    if (!skipTickets) {
      console.log(`Consuming ${ticketCost} ticket(s)...`)
      updatedTicket = await prisma.ticket.update({
        where: { userId: user.id },
        data: {
          balance: { decrement: ticketCost },
          totalUsed: { increment: ticketCost },
        },
      })
      console.log('Tickets consumed. New balance:', updatedTicket?.balance)
    } else {
      console.log('🔓 ADMIN MODE: Skipping ticket deduction')
    }

    console.log('=== UNIVERSE SCAN COMPLETE ===')

    const generateTime = Date.now() - generateStart

    // Return appropriate response based on single or multi-image
    const finalBalance = skipTickets ? (ticketRecord?.balance || 0) : (updatedTicket?.balance || 0)
    const ticketsActuallyUsed = skipTickets ? 0 : ticketCost

    if (isMultiImage) {
      return NextResponse.json({
        success: true,
        images: uploadedImages, // Array of {url, id}
        imageUrl: uploadedImages[0].url, // Backwards compat
        imageId: uploadedImages[0].id, // Backwards compat
        newBalance: finalBalance,
        message: skipTickets ? `Admin scan complete! Generated ${uploadedImages.length} images (FREE).` : `Universe scan complete! Generated ${uploadedImages.length} images.`,
        generationTime: generateTime,
        modelUsed: selectedModel.displayName,
        ticketsUsed: ticketsActuallyUsed,
      })
    } else {
      return NextResponse.json({
        success: true,
        imageUrl: uploadedImages[0].url,
        imageId: uploadedImages[0].id,
        newBalance: finalBalance,
        message: skipTickets ? 'Admin scan complete! (FREE)' : 'Universe scan complete!',
        generationTime: generateTime,
        modelUsed: selectedModel.displayName,
        ticketsUsed: ticketsActuallyUsed,
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
