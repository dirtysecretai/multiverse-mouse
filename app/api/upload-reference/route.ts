// app/api/upload-reference/route.ts
// Upload reference images to Vercel Blob storage

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
    
    // Upload to Vercel Blob
    const blob = await put(`reference-${Date.now()}-${file.name}`, file, {
      access: 'public',
    });
    
    return NextResponse.json({
      success: true,
      url: blob.url
    });
  } catch (error) {
    console.error('Failed to upload reference image:', error);
    return NextResponse.json(
      { error: 'Failed to upload reference image' },
      { status: 500 }
    );
  }
}
