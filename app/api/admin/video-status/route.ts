import { NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import prisma from '@/lib/prisma'
import { releaseQueueSlot } from '@/lib/admin-queue-helpers'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

fal.config({ credentials: process.env.FAL_KEY! })

// POST /api/admin/video-status
// Polls a FAL queue video job and saves to DB on completion.
// Admin-only — no session auth required (portal-v2 video scanner).
export async function POST(req: Request) {
  let requestId: string | undefined
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    const sessionUser = token ? await getUserFromSession(token) : null

    const body = await req.json()
    requestId = body.requestId
    const { falEndpoint, prompt, model, duration, resolution, ticketCost, aspectRatio, audioEnabled, startFrameUrl, endFrameUrl, motionVideoUrl, keepOriginalSound, characterOrientation } = body
    if (!requestId || !falEndpoint) {
      return NextResponse.json({ error: 'Missing requestId or falEndpoint' }, { status: 400 })
    }

    const status = await fal.queue.status(falEndpoint, { requestId, logs: false })

    if (status.status === 'COMPLETED') {
      // Idempotency guard: if the GenerationQueue entry is already 'completed', a previous poll
      // already saved this video to DB. Return the result without creating a duplicate row.
      const existingJob = await prisma.generationQueue.findFirst({
        where: { falRequestId: requestId, status: 'completed' },
        select: { id: true },
      })

      const result = await fal.queue.result<any>(falEndpoint, { requestId })
      const videoUrl = result.data?.video?.url
      if (!videoUrl) {
        return NextResponse.json({ status: 'failed', error: 'No video URL in FAL result' })
      }

      if (existingJob) {
        // Already processed — skip DB save to prevent duplicate.
        // Look up the saved DB record so the client can use videoId for dedup.
        console.log(`⚡ Video already saved [${requestId}] — returning cached result`)
        let cachedVideoId: number | null = null
        try {
          const saved = await prisma.generatedImage.findFirst({
            where: { imageUrl: videoUrl },
            select: { id: true },
            orderBy: { id: 'desc' },
          })
          cachedVideoId = saved?.id ?? null
        } catch {}
        return NextResponse.json({ status: 'completed', videoUrl, videoId: cachedVideoId })
      }

      console.log(`✓ Video generation completed [${requestId}] model=${model} duration=${duration} url=${videoUrl}`)

      // Save to DB under the first (admin) user
      let savedVideoId: number | null = null
      try {
        let targetUserId: number | null = sessionUser?.id ?? null
        if (!targetUserId) {
          const adminUser = await prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
          targetUserId = adminUser?.id ?? null
        }
        if (targetUserId) {
          const created = await prisma.generatedImage.create({
            data: {
              userId:      targetUserId!,
              prompt:      prompt || '',
              imageUrl:    videoUrl,
              model:       model || 'wan-2.5',
              quality:     resolution || '1080p',
              aspectRatio: aspectRatio || '16:9',
              ticketCost:  ticketCost || 0,
              expiresAt:   new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
              videoMetadata: {
                duration:             duration || '5',
                resolution:           resolution || '1080p',
                aspectRatio:          aspectRatio || '16:9',
                isVideo:              true,
                audioEnabled:         audioEnabled ?? false,
                startFrameUrl:        startFrameUrl || null,
                endFrameUrl:          endFrameUrl || null,
                motionVideoUrl:       motionVideoUrl || null,
                keepOriginalSound:    keepOriginalSound ?? true,
                characterOrientation: characterOrientation || null,
              } as any,
            },
            select: { id: true },
          })
          savedVideoId = created.id
        }
      } catch (dbErr) {
        console.error('Admin video-status: failed to save to DB (non-fatal):', dbErr)
      }

      await releaseQueueSlot(requestId, false)
      return NextResponse.json({ status: 'completed', videoUrl, videoId: savedVideoId })

    } else if ((status as any).status === 'ERROR' || (status as any).status === 'FAILED') {
      await releaseQueueSlot(requestId, true, 'Video generation failed on FAL servers')
      return NextResponse.json({ status: 'failed', error: 'Video generation failed on FAL servers' })
    } else {
      // IN_QUEUE or IN_PROGRESS — keep polling
      return NextResponse.json({ status: 'in_progress', falStatus: status.status })
    }

  } catch (error: any) {
    console.error('Admin video status error:', error, 'body:', JSON.stringify(error.body))
    // 422 ValidationError = FAL rejected the job (bad input, unsupported format, content policy)
    // Treat these as permanent failures so the UI stops polling and shows the error.
    if (error.status === 422 || error.constructor?.name === 'ValidationError') {
      const detail = Array.isArray(error.body?.detail)
        ? error.body.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join('; ')
        : error.body?.message || error.message || 'Unprocessable content'
      if (requestId) await releaseQueueSlot(requestId, true, `Generation failed: ${detail}`)
      return NextResponse.json({ status: 'failed', error: `Generation failed: ${detail}` })
    }
    // Return in_progress on transient network/server errors so the client keeps polling
    return NextResponse.json({ status: 'in_progress', error: error.message })
  } finally {
    await prisma.$disconnect()
  }
}
