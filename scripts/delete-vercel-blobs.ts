/**
 * Delete all remaining blobs from Vercel Blob storage.
 * Run with: npx tsx scripts/delete-vercel-blobs.ts
 *
 * Follows the official Vercel recommended pattern:
 * - 100-blob batches (conservative)
 * - 1s delay between batches
 * - Exponential backoff on rate limit (honours Retry-After header)
 * - Cursor-based pagination so progress survives restarts if you modify to save cursor
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!
const BLOB_API   = 'https://blob.vercel-storage.com'
const BATCH_SIZE = 100
const DELAY_MS   = 1000
const MAX_RETRIES = 3

const HEADERS = {
  authorization: `Bearer ${BLOB_TOKEN}`,
  'x-api-version': '7',
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function listBlobs(cursor?: string): Promise<{ blobs: { url: string }[]; cursor?: string; hasMore: boolean }> {
  const params = new URLSearchParams({ limit: String(BATCH_SIZE) })
  if (cursor) params.set('cursor', cursor)
  const res = await fetch(`${BLOB_API}?${params}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`List failed: ${res.status} — ${await res.text()}`)
  return res.json()
}

async function deleteBatch(urls: string[]): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${BLOB_API}/delete`, {
      method:  'POST',
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body:    JSON.stringify({ urls }),
    })

    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) throw new Error('Rate limited after max retries')
      const retryAfter = res.headers.get('retry-after')
      const backoff = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000
      console.warn(`  429 rate limited — waiting ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await sleep(backoff)
      continue
    }

    if (!res.ok) throw new Error(`Delete failed: ${res.status} — ${await res.text()}`)
    return
  }
}

async function main() {
  if (!BLOB_TOKEN) { console.error('ERROR: BLOB_READ_WRITE_TOKEN not set in .env.local'); process.exit(1) }

  console.log('═══════════════════════════════════════════')
  console.log(' Vercel Blob — Bulk Delete Script')
  console.log(`  Batch size: ${BATCH_SIZE}  |  Delay: ${DELAY_MS}ms  |  Max retries: ${MAX_RETRIES}`)
  console.log('═══════════════════════════════════════════\n')

  let totalDeleted = 0
  let batchNum     = 0
  let cursor: string | undefined

  do {
    const data = await listBlobs(cursor)
    if (data.blobs.length === 0) break

    batchNum++
    const urls = data.blobs.map(b => b.url)
    await deleteBatch(urls)
    totalDeleted += urls.length
    process.stdout.write(`\r  Batch ${batchNum}: deleted ${urls.length}  |  total: ${totalDeleted.toLocaleString()}`)

    cursor = data.cursor
    if (data.hasMore) await sleep(DELAY_MS)
  } while (cursor)

  console.log(`\n\n${'═'.repeat(43)}`)
  console.log(` Done. ${totalDeleted.toLocaleString()} blobs deleted.`)
  console.log('═'.repeat(43))
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1) })
