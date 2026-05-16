import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const COMFYUI_URL = 'http://localhost:8188'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

function makeR2() {
  return new S3Client({
    region:   'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
    // Prevent the SDK credential-provider chain from hanging on Vercel
    // when env vars are missing.
    maxAttempts: 1,
  })
}

async function listR2Files(prefix: string): Promise<{ key: string; name: string; size_gb: number }[]> {
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    return []
  }
  try {
    const r2 = makeR2()
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('R2 timeout')), 8000)
    )
    const res = await Promise.race([
      r2.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: prefix })),
      timeout,
    ])
    return (res.Contents ?? [])
      .filter(o => o.Key && /\.(safetensors|ckpt|pt)$/i.test(o.Key))
      .map(o => ({
        key:     o.Key!,
        name:    o.Key!.split('/').pop()!,
        size_gb: Math.round((o.Size ?? 0) / 1e9 * 10) / 10,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

async function listComfyModels(nodeType: string): Promise<string[]> {
  try {
    const res = await fetch(`${COMFYUI_URL}/object_info/${nodeType}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const data = await res.json() as Record<string, { input?: { required?: Record<string, unknown[][]> } }>
    const node = data[nodeType]
    const required = node?.input?.required ?? {}
    const inputKey = nodeType === 'CheckpointLoaderSimple' ? 'ckpt_name' : 'lora_name'
    const tuple = required[inputKey]
    if (Array.isArray(tuple) && Array.isArray(tuple[0])) return tuple[0] as string[]
    return []
  } catch { return [] }
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const missingEnv = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
    .filter(k => !process.env[k])

  const [comfyCheckpoints, comfyLoras, r2Checkpoints, r2Loras] = await Promise.all([
    listComfyModels('CheckpointLoaderSimple'),
    listComfyModels('LoraLoader'),
    listR2Files('training/checkpoints/'),
    listR2Files('training/loras/'),
  ])

  return NextResponse.json({
    comfy: {
      checkpoints: comfyCheckpoints,
      loras:       comfyLoras,
      available:   comfyCheckpoints.length > 0 || comfyLoras.length > 0,
    },
    r2: {
      checkpoints: r2Checkpoints,
      loras:       r2Loras,
      missingEnv:  missingEnv.length > 0 ? missingEnv : undefined,
    },
  })
}
