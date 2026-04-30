import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromSession } from '@/lib/auth'
import { presignPutUrl } from '@/lib/r2'

const ALLOWED_EXTS = ['.safetensors', '.bin', '.pt', '.ckpt']

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const user = await getUserFromSession(token)
  if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  let filename: string, contentType: string
  try {
    const body = await req.json() as { filename?: string; contentType?: string }
    filename = body.filename?.trim() || 'lora.safetensors'
    contentType = body.contentType || 'application/octet-stream'
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (!ALLOWED_EXTS.includes(ext)) {
    return NextResponse.json({ error: 'File type not allowed. Use .safetensors, .bin, .pt, or .ckpt' }, { status: 400 })
  }

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `user-loras/${user.id}/${Date.now()}-${safe}`
  const { uploadUrl, publicUrl } = await presignPutUrl(key, contentType, 3600)

  return NextResponse.json({ uploadUrl, publicUrl })
}
