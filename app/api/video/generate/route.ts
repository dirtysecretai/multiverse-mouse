import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { fal } from "@fal-ai/client";
import { FAL_GLOBAL_ID } from '@/lib/fal-queue';

const prisma = new PrismaClient();

fal.config({
  credentials: process.env.FAL_KEY!
});

// FAL endpoint IDs by model
const FAL_ENDPOINTS: Record<string, string> = {
  'wan-2.5':               'fal-ai/wan-25-preview/image-to-video',
  'kling-v3':              'fal-ai/kling-video/v3/pro/image-to-video',
  'kling-o3':              'fal-ai/kling-video/o3/standard/image-to-video',
  'kling-v3-motion':       'fal-ai/kling-video/v3/pro/motion-control',
  'seedance-1.5':          'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
  'seedance-1.5-text':     'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
  'seedance-2.0-t2v':           'fal-ai/bytedance/seedance-2.0/text-to-video',
  'seedance-2.0-i2v':           'fal-ai/bytedance/seedance-2.0/image-to-video',
  'seedance-2.0-r2v':           'fal-ai/bytedance/seedance-2.0/reference-to-video',
  'seedance-2.0-fast-t2v':      'fal-ai/bytedance/seedance-2.0/fast/text-to-video',
  'seedance-2.0-fast-i2v':      'fal-ai/bytedance/seedance-2.0/fast/image-to-video',
  'seedance-2.0-fast-r2v':      'fal-ai/bytedance/seedance-2.0/fast/reference-to-video',
  'lipsync-v3':                 'fal-ai/sync-lipsync/v3',
};

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      prompt,
      imageUrl,
      duration = '5',
      resolution = '1080p',
      audioUrl,
      adminMode = false,
      model = 'wan-2.5',
      generateAudio = false,
      klingAspectRatio = '16:9',
      endImageUrl,
      hasDevTier = false,
      // Motion Control
      motionVideoUrl,
      motionVideoDurationSec,
      characterOrientation = 'image',
      keepOriginalSound = true,
      // SeeDance 2.0 reference-to-video
      sd20Mode = 't2v',
      referenceImageUrls,
      referenceVideoUrls,
      referenceAudioUrls,
      referenceVideoDurationSec = 0,
      // Lipsync v3
      lipsyncVideoUrl,
      lipsyncAudioUrl,
      lipsyncSyncMode = 'cut_off',
      lipsyncVideoDurationSec = 0,
    } = await request.json();

    const isSD20Family = model === 'seedance-2.0' || model === 'seedance-2.0-fast'
    const isLipsync = model === 'lipsync-v3'
    const isTextToVideo = model === 'seedance-1.5' || (isSD20Family && sd20Mode !== 'i2v')
    if (!imageUrl && !isTextToVideo && !isLipsync) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (model !== 'kling-v3-motion' && !isLipsync && !prompt) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (model === 'kling-v3-motion' && !motionVideoUrl) {
      return NextResponse.json({ success: false, error: 'Missing motion reference video URL' }, { status: 400 });
    }
    if (isLipsync && (!lipsyncVideoUrl || !lipsyncAudioUrl)) {
      return NextResponse.json({ success: false, error: 'Lipsync requires both video and audio URLs' }, { status: 400 });
    }

    if (!adminMode && !userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Calculate ticket cost based on model
    let ticketCost: number;
    if (isLipsync) {
      ticketCost = Math.max(10, Math.ceil((lipsyncVideoDurationSec || 0) * 6));
    } else if (model === 'kling-v3-motion') {
      // 6 tickets/sec × actual video duration (or max if unknown)
      const fallbackSec = characterOrientation === 'video' ? 30 : 10;
      const sec = motionVideoDurationSec ? Math.ceil(motionVideoDurationSec) : fallbackSec;
      ticketCost = sec * 6;
    } else if (model === 'kling-o3') {
      const pricing: Record<string, number> = {
        '3': 15, '4': 18, '5': 20, '6': 24, '7': 28,
        '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
        '13': 52, '14': 56, '15': 60,
      };
      ticketCost = pricing[duration] || 20;
    } else if (model === 'kling-v3') {
      ticketCost = parseInt(duration) * (generateAudio ? 8 : 6);
    } else if (model === 'seedance-1.5') {
      const resMultiplier = resolution === '1080p' ? 2.25 : resolution === '480p' ? 0.5 : 1.0
      const audioMultiplier = generateAudio ? 1.0 : 0.5
      ticketCost = Math.ceil(parseInt(duration) * 2.0 * resMultiplier * audioMultiplier) + 1
    } else if (model === 'seedance-2.0') {
      const resMultiplier = resolution === '1080p' ? 2.25 : resolution === '480p' ? 0.5 : 1.0
      const hasVideoRefs = sd20Mode === 'r2v' && Array.isArray(referenceVideoUrls) && referenceVideoUrls.length > 0
      const videoInputMultiplier = hasVideoRefs ? 0.6 : 1.0
      const outputDurSec = duration === 'auto' ? 5 : parseInt(duration)
      const effectiveDur = outputDurSec + (hasVideoRefs ? (referenceVideoDurationSec || 0) : 0)
      ticketCost = Math.ceil(effectiveDur * 15 * resMultiplier * videoInputMultiplier)
    } else if (model === 'seedance-2.0-fast') {
      // 12 tickets/sec at 720p; 480p = 0.5x
      const resMultiplier = resolution === '480p' ? 0.5 : 1.0
      const hasVideoRefs = sd20Mode === 'r2v' && Array.isArray(referenceVideoUrls) && referenceVideoUrls.length > 0
      const videoInputMultiplier = hasVideoRefs ? 0.6 : 1.0
      const outputDurSec = duration === 'auto' ? 5 : parseInt(duration)
      const effectiveDur = outputDurSec + (hasVideoRefs ? (referenceVideoDurationSec || 0) : 0)
      ticketCost = Math.ceil(effectiveDur * 12 * resMultiplier * videoInputMultiplier)
    } else {
      const pricing: Record<string, Record<string, number>> = {
        '480p':  { '5': 7,  '10': 14 },
        '720p':  { '5': 13, '10': 26 },
        '1080p': { '5': 20, '10': 40 },
      };
      ticketCost = pricing[resolution]?.[duration] || 20;
    }

    // For non-admin: verify and deduct tickets before queuing
    if (!adminMode) {
      const userTickets = await prisma.ticket.findUnique({
        where: { userId },
        select: { balance: true },
      });

      if (!userTickets) {
        return NextResponse.json({ success: false, error: 'User tickets not found' }, { status: 404 });
      }

      if (userTickets.balance < ticketCost) {
        return NextResponse.json(
          { success: false, error: `Insufficient tickets. Need ${ticketCost} tickets.` },
          { status: 400 }
        );
      }

      // Deduct tickets before submitting to FAL queue
      await prisma.ticket.update({
        where: { userId },
        data: {
          balance:   { decrement: ticketCost },
          totalUsed: { increment: ticketCost },
        },
      });
    }

    // Build FAL input based on model
    const falEndpoint = model === 'seedance-1.5' && !imageUrl
      ? FAL_ENDPOINTS['seedance-1.5-text']
      : isSD20Family
      ? FAL_ENDPOINTS[`${model}-${sd20Mode}`] || FAL_ENDPOINTS[`${model}-t2v`]
      : FAL_ENDPOINTS[model] || FAL_ENDPOINTS['wan-2.5'];
    let falInput: Record<string, any>;

    if (isLipsync) {
      falInput = {
        video_url:  lipsyncVideoUrl,
        audio_url:  lipsyncAudioUrl,
        sync_mode:  lipsyncSyncMode || 'cut_off',
      };
    } else if (model === 'kling-v3-motion') {
      falInput = {
        image_url:             imageUrl,
        video_url:             motionVideoUrl,
        character_orientation: characterOrientation,
        keep_original_sound:   keepOriginalSound,
      };
      if (prompt?.trim()) falInput.prompt = prompt.trim();
    } else if (model === 'kling-v3') {
      falInput = {
        prompt,
        start_image_url: imageUrl,
        duration: String(duration),
        aspect_ratio: klingAspectRatio,
        generate_audio: generateAudio,
      };
      if (endImageUrl) falInput.end_image_url = endImageUrl;
    } else if (model === 'kling-o3') {
      falInput = {
        prompt,
        image_url: imageUrl,
        duration: String(duration),
        generate_audio: generateAudio,
      };
    } else if (model === 'seedance-1.5') {
      falInput = {
        prompt,
        aspect_ratio: klingAspectRatio,
        resolution,
        duration: String(duration),
        generate_audio: generateAudio,
        enable_safety_checker: false,
      };
      if (imageUrl) falInput.image_url = imageUrl;
      if (endImageUrl) falInput.end_image_url = endImageUrl;
    } else if (isSD20Family) {
      if (sd20Mode === 'i2v') {
        falInput = { prompt, image_url: imageUrl, resolution, duration: String(duration), generate_audio: generateAudio };
        if (klingAspectRatio && klingAspectRatio !== 'auto') falInput.aspect_ratio = klingAspectRatio;
        if (endImageUrl) falInput.end_image_url = endImageUrl;
      } else if (sd20Mode === 'r2v') {
        falInput = { prompt, resolution, duration: String(duration), generate_audio: generateAudio };
        if (klingAspectRatio && klingAspectRatio !== 'auto') falInput.aspect_ratio = klingAspectRatio;
        if (Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0) falInput.image_urls = referenceImageUrls;
        if (Array.isArray(referenceVideoUrls) && referenceVideoUrls.length > 0) falInput.video_urls = referenceVideoUrls;
        if (Array.isArray(referenceAudioUrls) && referenceAudioUrls.length > 0) falInput.audio_urls = referenceAudioUrls;
      } else {
        // t2v (default)
        falInput = { prompt, resolution, duration: String(duration), generate_audio: generateAudio };
        if (klingAspectRatio && klingAspectRatio !== 'auto') falInput.aspect_ratio = klingAspectRatio;
      }
    } else {
      // WAN 2.5
      falInput = {
        prompt,
        image_url: imageUrl,
        resolution,
        duration,
        enable_prompt_expansion: true,
        enable_safety_checker: false,
      };
      if (audioUrl) falInput.audio_url = audioUrl;
    }

    console.log(`Submitting ${model} job to FAL queue:`, JSON.stringify({ falEndpoint, ...falInput }, null, 2));

    // Admin mode: atomically claim a global FAL slot or queue for later
    let adminGlobalLimit: { maxConcurrent: number; currentActive: number } | null = null
    if (adminMode) {
      adminGlobalLimit = await prisma.modelConcurrencyLimit.findUnique({ where: { modelId: FAL_GLOBAL_ID } })
      if (adminGlobalLimit) {
        const claimed = await prisma.modelConcurrencyLimit.updateMany({
          where: { modelId: FAL_GLOBAL_ID, currentActive: { lt: adminGlobalLimit.maxConcurrent } },
          data: { currentActive: { increment: 1 } },
        })
        if (claimed.count === 0) {
          // At capacity — queue for later (counter was NOT incremented)
          const adminUser = await prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
          if (adminUser) {
            const queueEntry = await prisma.generationQueue.create({
              data: {
                userId:     adminUser.id,
                modelId:    model,
                modelType:  'video',
                prompt:     (prompt || '').trim(),
                parameters: { falEndpoint, falInput, usePolling: true },
                status:     'queued',
                ticketCost: 0,
              },
            })
            console.log(`Video queued (at capacity ${adminGlobalLimit.currentActive}/${adminGlobalLimit.maxConcurrent}) model=${model} queueId=#${queueEntry.id}`)
            return NextResponse.json({ success: true, queued: true, queueId: queueEntry.id, ticketCost, model, resolution, duration, falEndpoint })
          }
        }
        // Slot claimed (counter already incremented)
      }
    }

    // Submit to FAL async queue (returns immediately with a requestId)
    let requestId: string;
    try {
      const submitted = await fal.queue.submit(falEndpoint, { input: falInput });
      requestId = submitted.request_id;
    } catch (falError: any) {
      // Refund tickets if FAL submit fails
      if (!adminMode) {
        await prisma.ticket.update({
          where: { userId },
          data: {
            balance:   { increment: ticketCost },
            totalUsed: { decrement: ticketCost },
          },
        }).catch(() => {}); // best-effort refund
      }

      // Release the admin slot we claimed (if any)
      if (adminMode && adminGlobalLimit) {
        await prisma.modelConcurrencyLimit.updateMany({
          where: { modelId: FAL_GLOBAL_ID },
          data: { currentActive: { decrement: 1 } },
        }).catch(() => {})
      }

      console.error('FAL queue submit error:', falError);
      const isContentViolation = falError.body?.detail?.[0]?.type === 'content_policy_violation';
      return NextResponse.json(
        {
          success: false,
          error: isContentViolation
            ? 'Content policy violation: Your prompt or image was flagged. Please use different content.'
            : `Failed to queue video generation: ${falError.message || 'Unknown error'}`,
          isContentViolation,
        },
        { status: 400 }
      );
    }

    // Admin mode: track as processing in GenerationQueue (counter already incremented above)
    if (adminMode) {
      const adminUser = await prisma.user.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
      if (adminUser) {
        await prisma.generationQueue.create({
          data: {
            userId:      adminUser.id,
            modelId:     model,
            modelType:   'video',
            prompt:      (prompt || '').trim(),
            parameters:  { falEndpoint, falInput, usePolling: true },
            status:      'processing',
            ticketCost:  0,
            falRequestId: requestId,
            startedAt:   new Date(),
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      requestId,
      falEndpoint,
      ticketCost,
      model,
      resolution,
      duration,
    });

  } catch (error: any) {
    console.error('Video generation error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to submit video generation' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
