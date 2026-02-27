// app/api/upload-reference/route.ts
// Handles Vercel Blob client-side upload token requests.
// The browser calls this route to get a signed token, then uploads the file
// DIRECTLY to Vercel Blob without the file body passing through this function.
// This bypasses Vercel's 4.5MB serverless body limit for large reference images.

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname) => {
        // Allow all common image types, no practical size ceiling
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/bmp',
            'image/tiff',
          ],
          // 200 MB ceiling — well above any upscaled 4K image
          maximumSizeInBytes: 200 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // Nothing extra to do — the URL is returned directly to the client
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Upload token error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
