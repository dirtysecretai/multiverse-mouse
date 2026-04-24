import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET     = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
const ADMIN_PW   = process.env.ADMIN_PASSWORD || 'admin123'

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mp4',
  'video/avi': 'avi', 'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv',
  'video/mov': 'mp4',
}

// POST /api/admin/dataset/presign
// { files: [{ filename, mimeType }] }
// Returns { results: [{ uploadUrl, publicUrl, normalizedMime }] }
// Bypasses Vercel's 4.5MB body limit — client PUTs files directly to R2.
export async function POST(req: Request) {
  if (req.headers.get('x-admin-password') !== ADMIN_PW) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { files } = await req.json() as { files: { filename: string; mimeType: string }[] }
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'No files' }, { status: 400 })
  }

  const now       = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const results = await Promise.all(files.map(async ({ mimeType }) => {
    const raw  = mimeType || 'image/jpeg'
    const norm = raw === 'video/quicktime' || raw === 'video/mov' ? 'video/mp4' : raw
    const ext  = MIME_EXT[norm] ?? MIME_EXT[raw] ?? 'jpg'
    const key  = `uploads/${yearMonth}/${uuidv4()}.${ext}`

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: norm }),
      { expiresIn: 3600 },
    )
    return { uploadUrl, publicUrl: `${PUBLIC_URL}/${key}`, normalizedMime: norm }
  }))

  return NextResponse.json({ results })
}
