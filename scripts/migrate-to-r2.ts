/**
 * Migration script: Vercel Blob → Cloudflare R2
 *
 * Run with:
 *   npx tsx scripts/migrate-to-r2.ts
 *
 * Resumes automatically — skips URLs already on R2.
 * 403/404 generated images → marked isDeleted=true in DB.
 * 403/404 training data   → hard-deleted from DB (file is gone, record is useless).
 * Carousel images          → skipped (not public, not worth migrating).
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const UPLOAD_CONCURRENCY = 6    // parallel uploads
const DB_CONCURRENCY     = 4    // parallel DB updates
const DB_BATCH           = 100  // records per DB query
const RETRY_ATTEMPTS     = 3    // retries for transient errors
const DELAY_BETWEEN_MS   = 0    // no delay
const ERROR_LOG = path.join(process.cwd(), 'scripts', 'migrate-errors.log')

const BUCKET     = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

// ─── Clients ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.PRISMA_DATABASE_URL } },
}).$extends(withAccelerate())

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVercelUrl(url: string): boolean {
  return url.includes('vercel-storage.com') || url.includes('blob.vercel.com')
}

function extractKey(url: string): string {
  return new URL(url).pathname.replace(/^\//, '')
}

function logError(msg: string) {
  fs.appendFileSync(ERROR_LOG, msg + '\n')
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isTransient = err?.code === 'P5010' || err?.code === 'P1001' || err?.code === 'ETIMEDOUT'
      if (isTransient && attempt < RETRY_ATTEMPTS) {
        await sleep(1000 * 2 ** attempt)
        continue
      }
      throw err
    }
  }
  throw new Error('unreachable')
}

async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0
  async function worker() {
    while (true) {
      const i = index++
      if (i >= tasks.length) break
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

function progress(label: string, done: number, total: number) {
  const pct = total > 0 ? ((done / total) * 100).toFixed(1) : '0'
  console.log(`  ${label}: ${done}/${total} (${pct}%)`)
}

// ─── Fetch from Vercel Blob ───────────────────────────────────────────────────

type FetchResult =
  | { status: 'ok';   buf: Buffer; contentType: string }
  | { status: 'dead' }   // 403 or 404 — file is gone
  | { status: 'error'; message: string }

async function fetchBlob(url: string): Promise<FetchResult> {
  try {
    await sleep(DELAY_BETWEEN_MS)
    const res = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: BLOB_TOKEN ? { Authorization: `Bearer ${BLOB_TOKEN}` } : {},
    })
    if (res.status === 403 || res.status === 404) return { status: 'dead' }
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` }
    return {
      status: 'ok',
      buf: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') || 'image/png',
    }
  } catch (err: any) {
    return { status: 'error', message: err.message }
  }
}

// ─── Counters ─────────────────────────────────────────────────────────────────

let totalMigrated = 0
let totalDead     = 0   // 403/404 — marked deleted or removed from DB
let totalSkipped  = 0   // already on R2
let totalErrors   = 0

// ─── Generated Images ─────────────────────────────────────────────────────────

async function migrateGeneratedImages() {
  const total = await withRetry(
    () => (prisma as any).generatedImage.count({
      where: { imageUrl: { contains: 'vercel-storage' }, isDeleted: false },
    }),
    'count GeneratedImage'
  ) as number

  if (total === 0) { console.log('  GeneratedImage — nothing to migrate'); return }
  console.log(`\n  GeneratedImage — ${total} records`)

  let done = 0
  let cursor: number | undefined

  while (true) {
    const rows: { id: number; imageUrl: string }[] = await withRetry(
      () => (prisma as any).generatedImage.findMany({
        where: { imageUrl: { contains: 'vercel-storage' }, isDeleted: false },
        select: { id: true, imageUrl: true },
        take: DB_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      }),
      'fetch GeneratedImage batch'
    )
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id

    const tasks = rows.map(row => async () => {
      if (!isVercelUrl(row.imageUrl)) { totalSkipped++; done++; progress('GeneratedImage', done, total); return }

      const key = extractKey(row.imageUrl)
      const fetched = await fetchBlob(row.imageUrl)

      if (fetched.status === 'dead') {
        // Mark deleted so it drops out of the remaining count
        await withRetry(
          () => (prisma as any).generatedImage.update({
            where: { id: row.id },
            data: { isDeleted: true },
          }),
          `mark deleted ${row.id}`
        )
        totalDead++
      } else if (fetched.status === 'ok') {
        await withRetry(
          () => r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fetched.buf, ContentType: fetched.contentType })),
          `r2 upload ${key}`
        )
        await withRetry(
          () => (prisma as any).generatedImage.update({ where: { id: row.id }, data: { imageUrl: `${PUBLIC_URL}/${key}` } }),
          `db update ${row.id}`
        )
        totalMigrated++
      } else {
        totalErrors++
        logError(`FAILED id=${row.id} url=${row.imageUrl} error=${fetched.message}`)
      }

      done++
      progress('GeneratedImage', done, total)
    })

    await pool(tasks, UPLOAD_CONCURRENCY)
  }
  console.log()
}

// ─── Training Data ────────────────────────────────────────────────────────────

async function migrateTrainingData() {
  const total = await withRetry(
    () => (prisma as any).generationTrainingData.count({
      where: { imageUrl: { contains: 'vercel-storage' } },
    }),
    'count TrainingData'
  ) as number

  if (total === 0) { console.log('  GenerationTrainingData — nothing to migrate'); return }
  console.log(`\n  GenerationTrainingData — ${total} records`)

  let done = 0
  let cursor: number | undefined

  while (true) {
    const rows: { id: number; imageUrl: string }[] = await withRetry(
      () => (prisma as any).generationTrainingData.findMany({
        where: { imageUrl: { contains: 'vercel-storage' } },
        select: { id: true, imageUrl: true },
        take: DB_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      }),
      'fetch TrainingData batch'
    )
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id

    const tasks = rows.map(row => async () => {
      if (!isVercelUrl(row.imageUrl)) { totalSkipped++; done++; progress('TrainingData', done, total); return }

      const key = extractKey(row.imageUrl)
      const fetched = await fetchBlob(row.imageUrl)

      if (fetched.status === 'dead') {
        // No isDeleted field — hard delete the row since the file is gone
        await withRetry(
          () => (prisma as any).generationTrainingData.delete({ where: { id: row.id } }),
          `delete training ${row.id}`
        )
        totalDead++
      } else if (fetched.status === 'ok') {
        await withRetry(
          () => r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: fetched.buf, ContentType: fetched.contentType })),
          `r2 upload ${key}`
        )
        await withRetry(
          () => (prisma as any).generationTrainingData.update({ where: { id: row.id }, data: { imageUrl: `${PUBLIC_URL}/${key}` } }),
          `db update ${row.id}`
        )
        totalMigrated++
      } else {
        totalErrors++
        logError(`FAILED id=${row.id} url=${row.imageUrl} error=${fetched.message}`)
      }

      done++
      progress('TrainingData', done, total)
    })

    await pool(tasks, UPLOAD_CONCURRENCY)
  }
  console.log()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log(' Vercel Blob → Cloudflare R2 Migration')
  console.log('═══════════════════════════════════════════')
  console.log(`Bucket:     ${BUCKET}`)
  console.log(`Public URL: ${PUBLIC_URL}`)
  console.log(`Errors log: ${ERROR_LOG}`)
  console.log()

  if (!BUCKET || !PUBLIC_URL || !process.env.R2_ACCESS_KEY_ID) {
    console.error('ERROR: Missing R2 env vars. Check .env.local')
    process.exit(1)
  }

  const start = Date.now()

  await migrateGeneratedImages()
  await migrateTrainingData()
  // Carousel images skipped — no longer public

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1)

  console.log()
  console.log('═══════════════════════════════════════════')
  console.log(` Done in ${elapsed} min`)
  console.log(` Migrated to R2:  ${totalMigrated}`)
  console.log(` Dead (deleted):  ${totalDead}`)
  console.log(` Skipped (R2):    ${totalSkipped}`)
  console.log(` Errors:          ${totalErrors}`)
  if (totalErrors > 0) console.log(` See ${ERROR_LOG}`)
  console.log('═══════════════════════════════════════════')
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => (prisma as any).$disconnect?.())
