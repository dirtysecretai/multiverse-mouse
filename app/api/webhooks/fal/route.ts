import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import prisma from '@/lib/prisma'

// FAL.ai calls this endpoint when an async job completes or fails.
// We must return 200 quickly — FAL.ai will retry on non-200 responses.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('=== FAL.AI WEBHOOK RECEIVED ===')
    console.log('request_id:', body.request_id)
    console.log('status:', body.status)

    const { request_id, status, payload, error } = body

    if (!request_id) {
      console.error('Webhook missing request_id')
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 })
    }

    // Look up the queue entry by falRequestId
    const queueItem = await prisma.generationQueue.findFirst({
      where: { falRequestId: request_id }
    })

    if (!queueItem) {
      console.error(`No queue item found for request_id: ${request_id}`)
      // Return 200 anyway — if we return non-200 FAL.ai retries indefinitely
      return NextResponse.json({ received: true })
    }

    // Idempotency: if already settled, acknowledge and skip
    if (queueItem.status === 'completed' || queueItem.status === 'failed') {
      console.log(`Queue item #${queueItem.id} already settled (${queueItem.status}), skipping duplicate webhook`)
      return NextResponse.json({ received: true })
    }

    console.log(`Found queue item #${queueItem.id} for user ${queueItem.userId}`)

    const params = queueItem.parameters as any

    // ─── FAILURE PATH ───────────────────────────────────────────────
    if (status === 'ERROR' || status === 'FAILED' || error) {
      const errorMsg = error?.message || error || 'FAL.ai generation failed'
      console.error(`FAL.ai job failed for queue #${queueItem.id}:`, errorMsg)

      await Promise.all([
        // Release the reservation — balance was never decremented so no refund needed.
        prisma.ticket.update({
          where: { userId: queueItem.userId },
          data: {
            reserved: { decrement: queueItem.ticketCost }
          }
        }),
        // Mark queue item failed
        prisma.generationQueue.update({
          where: { id: queueItem.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: errorMsg
          }
        })
      ])

      // Decrement active count
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: queueItem.modelId },
        data: { currentActive: { decrement: 1 } }
      })

      console.log(`Queue item #${queueItem.id} marked as failed, tickets refunded`)
      return NextResponse.json({ received: true })
    }

    // ─── SUCCESS PATH ────────────────────────────────────────────────
    if (status === 'OK' || status === 'COMPLETED') {
      console.log(`FAL.ai job completed for queue #${queueItem.id}`)

      // Extract images from FAL.ai payload
      // FAL.ai wraps the model output in payload.images[] for image models
      const images: { url: string }[] = payload?.images || []

      if (images.length === 0) {
        console.error('Webhook payload has no images:', JSON.stringify(payload).substring(0, 300))
        await Promise.all([
          prisma.ticket.update({
            where: { userId: queueItem.userId },
            data: { reserved: { decrement: queueItem.ticketCost } }
          }),
          prisma.generationQueue.update({
            where: { id: queueItem.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              errorMessage: 'No images in FAL.ai response'
            }
          })
        ])
        await prisma.modelConcurrencyLimit.updateMany({
          where: { modelId: queueItem.modelId },
          data: { currentActive: { decrement: 1 } }
        })
        return NextResponse.json({ received: true })
      }

      // Upload each image to Vercel Blob and create DB records
      const uploadedImages: { url: string; id: number }[] = []
      const isAdminMode = params?.adminMode === true

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      for (let i = 0; i < images.length; i++) {
        const falImageUrl = images[i].url
        console.log(`Downloading image ${i + 1}/${images.length} from FAL.ai: ${falImageUrl}`)

        try {
          const imageResponse = await fetch(falImageUrl)
          if (!imageResponse.ok) {
            console.error(`Failed to download image ${i + 1}: ${imageResponse.status}`)
            continue
          }

          const imgBuffer = Buffer.from(await imageResponse.arrayBuffer())
          console.log(`Downloaded image ${i + 1}: ${(imgBuffer.length / 1024 / 1024).toFixed(2)} MB`)

          // Upload to Vercel Blob
          const filename = `universe-scan-${queueItem.userId}-${Date.now()}-${i}.png`
          const blob = await put(filename, imgBuffer, {
            access: 'public',
            contentType: 'image/png',
          })
          console.log(`Uploaded image ${i + 1} to blob: ${blob.url}`)

          // Save to GeneratedImage table
          const ticketCostForThisImage = i === 0 && !isAdminMode ? queueItem.ticketCost : 0

          const savedImage = await prisma.generatedImage.create({
            data: {
              userId: queueItem.userId,
              prompt: params?.savePrompt || queueItem.prompt,
              imageUrl: blob.url,
              model: queueItem.modelId,
              ticketCost: isAdminMode ? 0 : ticketCostForThisImage,
              referenceImageUrls: (params?.referenceImageUrls as string[]) || [],
              expiresAt,
            }
          })

          uploadedImages.push({ url: blob.url, id: savedImage.id })
          console.log(`Saved GeneratedImage #${savedImage.id}`)
        } catch (imgError) {
          console.error(`Error processing image ${i + 1}:`, imgError)
        }
      }

      if (uploadedImages.length === 0) {
        // All image downloads/uploads failed
        await Promise.all([
          prisma.ticket.update({
            where: { userId: queueItem.userId },
            data: { reserved: { decrement: queueItem.ticketCost } }
          }),
          prisma.generationQueue.update({
            where: { id: queueItem.id },
            data: {
              status: 'failed',
              completedAt: new Date(),
              errorMessage: 'Failed to process all images from FAL.ai'
            }
          })
        ])
        await prisma.modelConcurrencyLimit.updateMany({
          where: { modelId: queueItem.modelId },
          data: { currentActive: { decrement: 1 } }
        })
        return NextResponse.json({ received: true })
      }

      // Finalize tickets — this is the FIRST and ONLY balance deduction.
      // The generate route only reserved tickets; the actual spend happens here
      // once FAL.ai confirms the image was successfully delivered.
      if (!isAdminMode) {
        await prisma.ticket.update({
          where: { userId: queueItem.userId },
          data: {
            balance: { decrement: queueItem.ticketCost },   // First (and only) deduction
            reserved: { decrement: queueItem.ticketCost },  // Release reservation
            totalUsed: { increment: queueItem.ticketCost }  // Record lifetime usage
          }
        })
      } else {
        // Admin mode — just clear the reservation without charging
        await prisma.ticket.update({
          where: { userId: queueItem.userId },
          data: { reserved: { decrement: queueItem.ticketCost } }
        })
      }

      // Mark queue item completed with the primary result URL and image ID
      await prisma.generationQueue.update({
        where: { id: queueItem.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          resultUrl: uploadedImages[0].url,
          resultImageId: uploadedImages[0].id,
          // Store all image URLs in parameters for multi-image models (NanoBanana)
          parameters: {
            ...(params || {}),
            completedImageUrls: uploadedImages.map(img => img.url),
            completedImageIds: uploadedImages.map(img => img.id),
          }
        }
      })

      // Decrement active count
      await prisma.modelConcurrencyLimit.updateMany({
        where: { modelId: queueItem.modelId },
        data: { currentActive: { decrement: 1 } }
      })

      console.log(`=== WEBHOOK COMPLETE: Queue #${queueItem.id} done, ${uploadedImages.length} image(s) saved ===`)
      return NextResponse.json({ received: true })
    }

    // Unknown status — just acknowledge
    console.warn(`Unknown FAL.ai webhook status: ${status}`)
    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('FAL.ai webhook error:', err)
    // Return 200 to prevent FAL.ai from retrying endlessly on our internal errors
    return NextResponse.json({ received: true })
  }
}
