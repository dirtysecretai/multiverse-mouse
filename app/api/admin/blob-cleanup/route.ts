import { NextResponse } from "next/server"

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!
const BLOB_API   = 'https://blob.vercel-storage.com'
const HEADERS    = { authorization: `Bearer ${BLOB_TOKEN}`, 'x-api-version': '7' }

async function listBlobs(limit: number, cursor?: string) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`${BLOB_API}?${params}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`Blob list failed: ${res.status}`)
  return res.json() as Promise<{ blobs: { url: string }[]; cursor?: string; hasMore: boolean }>
}

// GET — paginate through all blobs to get exact total count
export async function GET() {
  try {
    let total = 0
    let cursor: string | undefined

    while (true) {
      const data = await listBlobs(1000, cursor)
      total += data.blobs.length
      if (!data.hasMore) break
      cursor = data.cursor
    }

    return NextResponse.json(
      { total },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// POST — delete one batch of up to 250 blobs (smaller to avoid 429)
export async function POST() {
  try {
    const data = await listBlobs(250)
    if (data.blobs.length === 0) {
      return NextResponse.json({ deleted: 0, hasMore: false })
    }
    const urls = data.blobs.map((b) => b.url)

    // Retry up to 4 times on 429 with exponential backoff
    for (let attempt = 1; attempt <= 4; attempt++) {
      const deleteRes = await fetch(`${BLOB_API}/delete`, {
        method: 'POST',
        headers: { ...HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      if (deleteRes.status === 429) {
        if (attempt < 4) { await sleep(1500 * attempt); continue }
        return NextResponse.json({ error: 'Rate limited — try again in a moment' }, { status: 429 })
      }
      if (!deleteRes.ok) throw new Error(`Blob delete failed: ${deleteRes.status}`)
      return NextResponse.json({ deleted: urls.length, hasMore: true })
    }

    throw new Error('Max retries exceeded')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
