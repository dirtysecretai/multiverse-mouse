import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

// POST /api/admin/upload-frame-presign
// Returns a presigned R2 PUT URL so the client can upload large files directly,
// bypassing Vercel's 4.5MB request body limit.
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const user = await getUserFromSession(token)
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { filename, mimeType } = await req.json()
    if (!filename || !mimeType) {
      return NextResponse.json({ error: 'Missing filename or mimeType' }, { status: 400 })
    }

    const ext = mimeType.split('/')[1]
      ?.replace('jpeg', 'jpg')
      .replace('mpeg', 'mp3')
      .replace('quicktime', 'mp4')
      .replace('x-m4v', 'mp4')
      .replace('x-matroska', 'webm')
      || 'bin'
    const normalizedMime = mimeType === 'video/quicktime' ? 'video/mp4' : mimeType
    const key = `admin-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: normalizedMime,
    })

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 })
    const publicUrl = `${PUBLIC_URL}/${key}`

    return NextResponse.json({ uploadUrl, publicUrl, key })
  } catch (error: any) {
    console.error('Presign error:', error)
    return NextResponse.json({ error: error.message || 'Presign failed' }, { status: 500 })
  }
}
