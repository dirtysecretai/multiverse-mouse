import { NextResponse } from 'next/server'
import { uploadToR2 } from '@/lib/r2'

// POST /api/admin/upload-frame
// Accepts a base64-encoded file, uploads it to Vercel Blob, returns the public URL.
// Used by the portal-v2 video scanner for start/end frame and audio uploads.
export async function POST(req: Request) {
  try {
    const { base64, mimeType, filename } = await req.json()
    if (!base64 || !mimeType) {
      return NextResponse.json({ error: 'Missing base64 or mimeType' }, { status: 400 })
    }
    const buffer = Buffer.from(base64, 'base64')
    const ext = mimeType.split('/')[1]
      ?.replace('jpeg', 'jpg')
      .replace('mpeg', 'mp3')
      .replace('quicktime', 'mp4')   // iOS MOV → mp4
      .replace('x-m4v', 'mp4')
      .replace('x-matroska', 'webm')
      || 'bin'
    // Normalize QuickTime MIME type so downstream APIs (FAL, etc.) recognise the file
    const normalizedMime = mimeType === 'video/quicktime' ? 'video/mp4' : mimeType
    const safeName = `admin-upload-${Date.now()}.${ext}`
    const url = await uploadToR2(safeName, buffer, normalizedMime)
    return NextResponse.json({ url })
  } catch (error: any) {
    console.error('Frame upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
