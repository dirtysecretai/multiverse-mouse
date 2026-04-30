import { NextRequest, NextResponse } from 'next/server'
import { presignPutUrl } from '@/lib/r2'
import { getUserFromSession } from '@/lib/auth'

const ADMIN_EMAILS = new Set(['dirtysecretai@gmail.com', 'promptandprotocol@gmail.com'])

async function authOk(req: NextRequest): Promise<boolean> {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  if (req.headers.get('x-admin-password') === pass) return true
  const token = req.cookies.get('session')?.value
  if (token) {
    const user = await getUserFromSession(token)
    if (user && ADMIN_EMAILS.has(user.email.toLowerCase())) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  if (!await authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
