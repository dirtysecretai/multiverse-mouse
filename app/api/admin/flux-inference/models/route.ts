import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const COMFYUI_URL = 'http://localhost:8188'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function listR2Files(prefix: string) {
  try {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      Prefix: prefix,
    }))
    return (res.Contents ?? [])
      .filter(o => o.Key && /\.(safetensors|ckpt|pt)$/i.test(o.Key))
      .map(o => ({
        key:  o.Key!,
        name: o.Key!.split('/').pop()!,
        size_gb: Math.round((o.Size ?? 0) / 1e9 * 10) / 10,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch { return [] }
}

async function listComfyModels(nodeType: string): Promise<string[]> {
  try {
    const res = await fetch(`${COMFYUI_URL}/object_info/${nodeType}`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const data = await res.json() as Record<string, { input?: { required?: Record<string, unknown[][]> } }>
    const node = data[nodeType]
    // ComfyUI returns the file list as the first item in the input tuple
    // e.g. { CheckpointLoaderSimple: { input: { required: { ckpt_name: [["file1.safetensors", ...], {}] } } } }
    const required = node?.input?.required ?? {}
    const inputKey = nodeType === 'CheckpointLoaderSimple' ? 'ckpt_name' : 'lora_name'
    const tuple = required[inputKey]
    if (Array.isArray(tuple) && Array.isArray(tuple[0])) return tuple[0] as string[]
    return []
  } catch { return [] }
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    },
  })
}
