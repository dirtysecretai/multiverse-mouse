import { NextRequest, NextResponse } from 'next/server'
import { presignPutUrl } from '@/lib/r2'

function authOk(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let filename: string, contentType: string
  try {
    const body = await req.json() as { filename?: string; contentType?: string }
    filename = body.filename?.trim() || 'source.jpg'
    contentType = body.contentType || 'image/jpeg'
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const key = `upscale-sources/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { uploadUrl, publicUrl } = await presignPutUrl(key, contentType, 3600)

  return NextResponse.json({ uploadUrl, publicUrl })
}
