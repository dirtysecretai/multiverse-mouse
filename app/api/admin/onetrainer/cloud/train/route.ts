import { NextResponse } from 'next/server'

const RUNPOD_API = 'https://api.runpod.ai/v2'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const endpointId = process.env.RUNPOD_ENDPOINT_ID
  const apiKey = process.env.RUNPOD_API_KEY
  if (!endpointId || !apiKey) {
    return NextResponse.json({ error: 'RunPod not configured — set RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const res = await fetch(`${RUNPOD_API}/${endpointId}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: body }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `RunPod error: ${err}` }, { status: res.status })
  }

  const data = await res.json() as { id: string }
  return NextResponse.json({ job_id: data.id, started: true })
}
