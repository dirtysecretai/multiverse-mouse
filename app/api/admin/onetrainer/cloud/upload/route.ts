import { NextResponse } from 'next/server'
import { presignPutUrl } from '@/lib/r2'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, filename, contentType } = await req.json() as {
    type: 'checkpoint' | 'dataset' | 'model'
    filename: string
    contentType?: string
  }

  if (!type || !filename) {
    return NextResponse.json({ error: 'Missing type or filename' }, { status: 400 })
  }

  const prefixMap = {
    checkpoint: 'training/checkpoints',
    dataset:    'training/datasets',
    model:      'training/models',
  }
  const key = `${prefixMap[type]}/${filename}`

  const { uploadUrl, publicUrl } = await presignPutUrl(
    key,
    contentType ?? 'application/octet-stream',
    3600,
  )
  return NextResponse.json({ uploadUrl, publicUrl, key })
}
