// app/api/rating/route.ts
// API route for saving image ratings

import { NextRequest, NextResponse } from 'next/server';
import { saveImageRating } from '@/lib/prompt-intelligence';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { generatedImageId, userId, score, wasBlocked, wasAccurate, feedbackText, tags } = body;

    if (!generatedImageId || !userId || !score) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await saveImageRating(generatedImageId, userId, {
      score,
      wasBlocked: wasBlocked || false,
      wasAccurate,
      feedbackText,
      tags,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save rating:', error);
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    );
  }
}
