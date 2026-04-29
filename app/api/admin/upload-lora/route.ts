import { NextRequest, NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

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
  if (!await authOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowed = ['.safetensors', '.bin', '.pt', '.ckpt']
    const name = file.name.toLowerCase()
    if (!allowed.some(ext => name.endsWith(ext))) {
      return NextResponse.json({ error: 'Only .safetensors, .bin, .pt, .ckpt files are allowed' }, { status: 400 })
    }

    const url = await fal.storage.upload(file)
    return NextResponse.json({ url })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[upload-lora] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
