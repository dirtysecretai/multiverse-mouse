// Proxy: /api/admin/upscaler/<anything> → http://localhost:8766/<anything>
import { NextResponse } from 'next/server'

const BASE = 'http://localhost:8766'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

async function proxy(req: Request, segments: string[]) {
  const url  = `${BASE}/${segments.join('/')}`
  const init: RequestInit = { method: req.method }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body    = await req.text()
    init.headers = { 'Content-Type': 'application/json' }
  }
  try {
    const res  = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) })
    const body = await res.text()
    return new Response(body, {
      status:  res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Upscaler server unreachable', detail: msg }, { status: 503 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return proxy(req, (await params).path)
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return proxy(req, (await params).path)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return proxy(req, (await params).path)
}
