// app/api/upload-reference/route.ts
// Accepts a single compressed JPEG as FormData and stores it in Vercel Blob.
// The client compresses to ≤1920px before sending, keeping the body well
// under Vercel's 4.5MB serverless limit without any client-SDK complexity.

import { uploadToR2 } from '@/lib/r2';
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

    const url = await uploadToR2(filename, buffer, 'image/jpeg');

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Reference upload error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
