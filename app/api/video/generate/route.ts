import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { fal } from "@fal-ai/client";

const prisma = new PrismaClient();

// Configure FAL client
fal.config({
  credentials: process.env.FAL_KEY!
});

export async function POST(request: NextRequest) {
  try {
    const { userId, prompt, imageUrl, duration = '5', resolution = '1080p', audioUrl, adminMode = false, model = 'wan-2.5', generateAudio = false, klingAspectRatio = '16:9', endImageUrl, hasDevTier = false } = await request.json();

    if (!prompt || !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!adminMode && !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Calculate ticket cost based on model
    let ticketCost: number;
    if (model === 'kling-o3') {
      const klingO3Pricing: Record<string, number> = {
        '3': 15, '4': 18, '5': 20, '6': 24, '7': 28,
        '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
        '13': 52, '14': 56, '15': 60,
      };
      ticketCost = klingO3Pricing[duration] || 20;
    } else if (model === 'kling-v3') {
      // 6 tickets/sec (audio off) · 8 tickets/sec (audio on) — same for all users
      ticketCost = parseInt(duration) * (generateAudio ? 8 : 6);
    } else {
      // WAN 2.5 pricing
      const pricing: Record<string, Record<string, number>> = {
        '480p': { '5': 7, '10': 14 },
        '720p': { '5': 13, '10': 26 },
        '1080p': { '5': 20, '10': 40 },
      };
      ticketCost = pricing[resolution]?.[duration] || 20;
    }

    // Skip ticket checks for admin mode
    if (!adminMode) {
      // Check user's ticket balance
      const userTickets = await prisma.ticket.findUnique({
        where: { userId: userId },
        select: { balance: true }
      });

      if (!userTickets) {
        return NextResponse.json(
          { success: false, error: 'User tickets not found' },
          { status: 404 }
        );
      }

      if (userTickets.balance < ticketCost) {
        return NextResponse.json(
          { success: false, error: `Insufficient tickets. Need ${ticketCost} tickets.` },
          { status: 400 }
        );
      }
    }

    let result;
    try {
      if (model === 'kling-o3') {
        // Kling Video O3 Standard — image-to-video
        const klingInput: any = {
          prompt: prompt,
          image_url: imageUrl,
          duration: String(duration),
          generate_audio: generateAudio,
        };
        console.log('Calling FAL.ai Kling O3 API with input:', JSON.stringify(klingInput, null, 2));
        result = await fal.subscribe("fal-ai/kling-video/o3/standard/image-to-video", {
          input: klingInput,
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          },
        });
      } else if (model === 'kling-v3') {
        // Kling Video V3 Pro — image-to-video
        const klingV3Input: any = {
          prompt: prompt,
          start_image_url: imageUrl,
          duration: String(duration),
          aspect_ratio: klingAspectRatio,
          generate_audio: generateAudio,
        };
        if (endImageUrl) {
          klingV3Input.end_image_url = endImageUrl;
        }
        console.log('Calling FAL.ai Kling V3 Pro API with input:', JSON.stringify(klingV3Input, null, 2));
        result = await fal.subscribe("fal-ai/kling-video/v3/pro/image-to-video", {
          input: klingV3Input,
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          },
        });
      } else {
        // WAN 2.5 — image-to-video
        const falInput: any = {
          prompt: prompt,
          image_url: imageUrl,
          resolution: resolution,
          duration: duration,
          enable_prompt_expansion: true,
          enable_safety_checker: false,
        };
        if (audioUrl) {
          falInput.audio_url = audioUrl;
        }
        console.log('Calling FAL.ai WAN 2.5 API with input:', JSON.stringify(falInput, null, 2));
        result = await fal.subscribe("fal-ai/wan-25-preview/image-to-video", {
          input: falInput,
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          },
        });
      }
    } catch (falError: any) {
      console.error('FAL.ai API Error:', falError);
      console.error('FAL.ai Error Body:', JSON.stringify(falError.body, null, 2));

      // Check for content policy violation
      if (falError.body?.detail?.[0]?.type === 'content_policy_violation') {
        return NextResponse.json(
          {
            success: false,
            error: 'Content policy violation: Your prompt or image was flagged by the safety checker. Please use different content.',
            isContentViolation: true
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: `Video generation failed: ${falError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    if (!result.data || !result.data.video || !result.data.video.url) {
      console.error('Invalid FAL.ai response:', result);
      return NextResponse.json(
        { success: false, error: 'Video generation failed - invalid response' },
        { status: 500 }
      );
    }

    const videoUrl = result.data.video.url;
    const actualPrompt = result.data.actual_prompt || prompt;

    // Skip ticket deduction and DB save for admin mode
    if (adminMode) {
      return NextResponse.json({
        success: true,
        videoUrl: videoUrl,
        thumbnailUrl: imageUrl,
        actualPrompt: actualPrompt,
      });
    }

    // Deduct tickets and update usage stats
    await prisma.ticket.update({
      where: { userId: userId },
      data: {
        balance: {
          decrement: ticketCost
        },
        totalUsed: {
          increment: ticketCost
        }
      }
    });

    // Save video to database (extending the existing GeneratedImage table to support videos)
    const savedVideo = await prisma.generatedImage.create({
      data: {
        userId: userId,
        prompt: actualPrompt,
        imageUrl: videoUrl, // Using imageUrl field for video URL
        model: model,
        quality: resolution,
        aspectRatio: resolution === '480p' ? '16:9' : resolution === '720p' ? '16:9' : '16:9',
        ticketCost: ticketCost,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        // Store video-specific metadata in a JSON field
        videoMetadata: {
          duration: duration,
          resolution: resolution,
          isVideo: true,
          thumbnailUrl: imageUrl, // Use input image as thumbnail
        } as any,
      }
    });

    // Get updated balance
    const updatedTickets = await prisma.ticket.findUnique({
      where: { userId: userId },
      select: { balance: true }
    });

    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
      thumbnailUrl: imageUrl,
      videoId: savedVideo.id,
      newBalance: updatedTickets?.balance || 0,
      actualPrompt: actualPrompt,
    });

  } catch (error: any) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate video' },
      { status: 500 }
    );
  }
}
