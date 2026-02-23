// app/api/upload-audio/route.ts
// Upload audio files to Vercel Blob storage

import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (WAV or MP3)
    if (!file.type.includes('audio/wav') && !file.type.includes('audio/mp3') && !file.type.includes('audio/mpeg')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only WAV and MP3 files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 15MB)
    const maxSize = 15 * 1024 * 1024; // 15MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 15MB.' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const blob = await put(`audio-${Date.now()}-${file.name}`, file, {
      access: 'public',
    });

    return NextResponse.json({
      success: true,
      url: blob.url
    });
  } catch (error) {
    console.error('Failed to upload audio file:', error);
    return NextResponse.json(
      { error: 'Failed to upload audio file' },
      { status: 500 }
    );
  }
}
