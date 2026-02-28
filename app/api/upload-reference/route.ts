// app/api/upload-reference/route.ts
// Accepts a single compressed JPEG as FormData and stores it in Vercel Blob.
// The client compresses to ≤1920px before sending, keeping the body well
// under Vercel's 4.5MB serverless limit without any client-SDK complexity.

import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `reference-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Reference upload error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
