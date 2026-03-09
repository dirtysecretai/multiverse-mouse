import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { fal } from "@fal-ai/client";

const prisma = new PrismaClient();

fal.config({
  credentials: process.env.FAL_KEY!
});

// FAL endpoint IDs by model
const FAL_ENDPOINTS: Record<string, string> = {
  'wan-2.5':  'fal-ai/wan-25-preview/image-to-video',
  'kling-v3': 'fal-ai/kling-video/v3/pro/image-to-video',
  'kling-o3': 'fal-ai/kling-video/o3/standard/image-to-video',
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
    } = await request.json();

    if (!prompt || !imageUrl) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!adminMode && !userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // Calculate ticket cost based on model
    let ticketCost: number;
    if (model === 'kling-o3') {
      const pricing: Record<string, number> = {
        '3': 15, '4': 18, '5': 20, '6': 24, '7': 28,
        '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
        '13': 52, '14': 56, '15': 60,
      };
      ticketCost = pricing[duration] || 20;
    } else if (model === 'kling-v3') {
      ticketCost = parseInt(duration) * (generateAudio ? 8 : 6);
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
    const falEndpoint = FAL_ENDPOINTS[model] || FAL_ENDPOINTS['wan-2.5'];
    let falInput: Record<string, any>;

    if (model === 'kling-v3') {
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
