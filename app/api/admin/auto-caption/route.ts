import { prisma } from '@/lib/prisma'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

const MODELS = {
  pro:   'gemini-3.1-pro-preview',
  flash: 'gemini-3.1-flash-lite-preview',
}

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

type ImagePart = { inlineData: { data: string; mimeType: string } }
type TextPart  = { text: string }
type GeminiPart = ImagePart | TextPart

async function fetchImageAsBase64(url: string, timeoutMs = 20_000): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  return { data: Buffer.from(buffer).toString('base64'), mimeType }
}

async function fetchImageAsBase64Safe(url: string, timeoutMs = 20_000): Promise<{ data: string; mimeType: string } | null> {
  try { return await fetchImageAsBase64(url, timeoutMs) } catch { return null }
}

async function callGeminiParts(parts: GeminiPart[], modelId: string, maxTokens = 400, timeoutMs = 60_000): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`)
  }
  const json = await res.json()
  if (json.promptFeedback?.blockReason) throw new Error(`Blocked: ${json.promptFeedback.blockReason}`)
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No text in Gemini response')
  return text.trim()
}

function cleanTags(raw: string): string[] {
  return raw
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(t => t.length > 0 && t.length <= 40)
}

// Build the instruction for BASIC mode (image + prompt only)
function buildBasicInstruction(mode: 'caption' | 'tags', promptSnippet: string, curatorContext: string | null): string {
  const contextLine = curatorContext ? `\nCURATOR CONTEXT (must be included): ${curatorContext}` : ''
  if (mode === 'caption') {
    return `You are an AI training data curator. Analyze this AI-generated image and write a concise training caption (1–3 sentences) that accurately describes the visual content.\n\nFocus on: main subject, style, key visual elements, mood, and composition.\n\nOriginal generation prompt: "${promptSnippet}"${contextLine}\n\nRespond with ONLY the caption text. No preamble, no quotes.`
  }
  return `You are an AI training data curator. Analyze this AI-generated image and generate 5–15 descriptive tags for a training dataset.\n\nTags must be lowercase. Use hyphens for multi-word terms. Cover: subject, style, color palette, mood, composition, visual elements.\n\nOriginal generation prompt: "${promptSnippet}"${contextLine}\n\nRespond with ONLY a comma-separated list. Example: portrait, dark-lighting, fantasy-style, blue-tones, dramatic-pose`
}

// Build the instruction for ADVANCED mode (all 4 signals)
function buildAdvancedInstruction(
  mode:           'caption' | 'tags',
  promptSnippet:  string,
  refCount:       number,
  rating:         { score: number; wasAccurate: boolean | null; tags: string[]; feedbackText: string | null } | null,
  curatorContext: string | null,
): string {
  const contextLine = curatorContext ? `\n- CURATOR CONTEXT (must be included): ${curatorContext}` : ''
  const ratingLine = rating
    ? [
        `Rating: ${rating.score}/5 stars`,
        rating.wasAccurate !== null ? `Prompt accuracy: ${rating.wasAccurate ? 'accurate' : 'inaccurate'}` : null,
        rating.tags.length ? `Feedback tags: ${rating.tags.join(', ')}` : null,
        rating.feedbackText ? `User feedback: "${rating.feedbackText}"` : null,
      ].filter(Boolean).join(' · ')
    : 'No user rating'

  const refLine = refCount > 0
    ? `${refCount} reference image(s) provided below (images 2+) — used for face/subject identity consistency`
    : 'No reference images used'

  const qualityHint = !rating ? '' :
    rating.score === 5 ? '\nQUALITY NOTE: 5-star rating — emphasize high quality, correct anatomy, precise details, and accurate prompt adherence.' :
    rating.score === 4 ? '\nQUALITY NOTE: 4-star rating — this is a good quality generation, highlight its strong aspects.' :
    rating.score <= 2  ? '\nQUALITY NOTE: Low rating — note any visible quality issues, inaccuracies, or anatomical problems.' : ''

  const refHint = refCount > 0
    ? '\nIDENTITY NOTE: Reference images were used for face/subject consistency. If the identity appears consistent across images, note this explicitly.'
    : ''

  if (mode === 'caption') {
    return `You are an expert AI training data curator analyzing an AI-generated image with full context.

IMAGE ORDER: Image 1 = the generated result (caption this one). ${refCount > 0 ? `Images 2–${refCount + 1} = reference images used for subject identity.` : ''}

CONTEXT:
- Original prompt: "${promptSnippet}"
- ${refLine}
- ${ratingLine}${contextLine}
${qualityHint}${refHint}

TASK: Write a training caption (2–4 sentences) for the FIRST IMAGE only.
Focus on: subject, visual style, lighting, composition, quality markers, and identity consistency (if references provided).${curatorContext ? '\nIMPORTANT: The curator context above MUST be reflected in your caption.' : ''}

Respond with ONLY the caption. No preamble, no quotes.`
  }

  // tags mode
  const qualityTags = !rating ? '' :
    rating.score === 5 ? '\nMUST INCLUDE quality tags: high-quality, correct-anatomy' :
    rating.score === 4 ? '\nINCLUDE: good-quality' :
    rating.score <= 2  ? '\nINCLUDE: low-quality' : ''

  const refTags = refCount > 0
    ? '\nIf face/identity is consistent with references, INCLUDE: face-consistent, identity-preserved'
    : ''

  const contextTags2 = curatorContext
    ? `\nCURATOR CONTEXT tags (must include as tags): ${curatorContext.toLowerCase().replace(/[^a-z0-9\s,-]/g, '').split(/[\s,]+/).filter(Boolean).join(', ')}`
    : ''

  return `You are an expert AI training data curator generating tags for an AI-generated image with full context.

IMAGE ORDER: Image 1 = the generated result (tag this one). ${refCount > 0 ? `Images 2–${refCount + 1} = reference images for context.` : ''}

CONTEXT:
- Original prompt: "${promptSnippet}"
- ${refLine}
- ${ratingLine}${contextLine}
${qualityHint}${refHint}

TASK: Generate 8–20 descriptive tags for the FIRST IMAGE.
Rules: lowercase, hyphens for multi-word terms.
Cover: subject, style, lighting, colors, composition, mood, quality.
${qualityTags}${refTags}${contextTags2}

Respond with ONLY a comma-separated list.`
}

// POST — stream SSE progress while auto-filling captions or tags
// Body: { ids: number[], mode: 'caption'|'tags', model: 'pro'|'flash', overwrite: boolean, advanced: boolean }
export async function POST(req: Request) {
  if (!checkAuth(req)) return new Response('Unauthorized', { status: 401 })

  const { ids, mode, model: modelKey, overwrite = false, advanced = false, preview = false, context, contextTags } = await req.json() as {
    ids:         number[]
    mode:        'caption' | 'tags'
    model:       'pro' | 'flash'
    overwrite:   boolean
    advanced:    boolean
    preview:     boolean
    context?:    string
    contextTags?: string[]
  }

  const curatorContext = [
    ...(contextTags?.length ? [`Subjects/names: ${contextTags.join(', ')}`] : []),
    ...(context ? [context] : []),
  ].join(' — ') || null

  if (!Array.isArray(ids) || ids.length === 0) return new Response('ids required', { status: 400 })
  if (mode !== 'caption' && mode !== 'tags')   return new Response('invalid mode', { status: 400 })

  const modelId = MODELS[modelKey] ?? MODELS.flash

  const records = await prisma.generatedImage.findMany({
    where:   { id: { in: ids }, isDeleted: false },
    select:  {
      id: true, prompt: true, imageUrl: true, videoMetadata: true,
      adminTags: true, adminCaption: true,
      referenceImageUrls: true,
      imageRating: { select: { score: true, wasAccurate: true, tags: true, feedbackText: true } },
    },
    orderBy: { id: 'asc' },
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }

      let processed = 0
      let skipped   = 0
      let failed    = 0

      send({ type: 'start', total: records.length, modelId, advanced })

      for (let i = 0; i < records.length; i++) {
        const record = records[i]

        // Skip if not overwriting and content already exists
        if (!overwrite) {
          if (mode === 'caption' && record.adminCaption) {
            skipped++; send({ type: 'skip', id: record.id, current: i + 1, total: records.length, reason: 'already captioned' }); continue
          }
          if (mode === 'tags' && record.adminTags.length > 0) {
            skipped++; send({ type: 'skip', id: record.id, current: i + 1, total: records.length, reason: 'already tagged' }); continue
          }
        }

        // Skip videos entirely (image-only feature)
        const isVideo = /\.(mp4|webm|mov)$/i.test(record.imageUrl)
        if (isVideo) {
          skipped++; send({ type: 'skip', id: record.id, current: i + 1, total: records.length, reason: 'video — images only' }); continue
        }

        send({ type: 'processing', id: record.id, current: i + 1, total: records.length })

        try {
          const promptSnippet = record.prompt.slice(0, 400)
          const rating        = record.imageRating ?? null

          let result: string

          // Fetch main image — skip gracefully if URL is unreachable/expired
          const mainImage = await fetchImageAsBase64(record.imageUrl, 20_000).catch(err => {
            throw new Error(`Image unreachable: ${err.message}`)
          })

          if (!advanced) {
            // ── Basic mode ──────────────────────────────────────────────────────
            const instruction = buildBasicInstruction(mode, promptSnippet, curatorContext)
            result = await callGeminiParts(
              [{ inlineData: mainImage }, { text: instruction }],
              modelId,
            ).catch(err => { throw new Error(`Gemini error: ${err.message}`) })
          } else {
            // ── Advanced mode ───────────────────────────────────────────────────
            // Fetch up to 3 reference images in parallel (silently skip failures)
            const refUrls   = (record.referenceImageUrls ?? []).slice(0, 3)
            const refImages = (await Promise.all(refUrls.map(url => fetchImageAsBase64Safe(url, 20_000)))).filter(Boolean) as { data: string; mimeType: string }[]

            const instruction = buildAdvancedInstruction(mode, promptSnippet, refImages.length, rating, curatorContext)

            const parts: GeminiPart[] = [
              { inlineData: mainImage },
              ...refImages.map(img => ({ inlineData: img })),
              { text: instruction },
            ]

            result = await callGeminiParts(parts, modelId, 600, 90_000).catch(err => { throw new Error(`Gemini error: ${err.message}`) })
          }

          if (mode === 'caption') {
            const caption = result.replace(/^["']|["']$/g, '').trim()
            if (!preview) await prisma.generatedImage.update({ where: { id: record.id }, data: { adminCaption: caption } })
            send({ type: 'result', id: record.id, current: i + 1, total: records.length, value: caption })
          } else {
            const tags = cleanTags(result)
            if (!preview) await prisma.generatedImage.update({ where: { id: record.id }, data: { adminTags: tags } })
            send({ type: 'result', id: record.id, current: i + 1, total: records.length, value: tags.join(', '), tags })
          }

          processed++
        } catch (err: any) {
          failed++
          send({ type: 'error', id: record.id, current: i + 1, total: records.length, error: err.message })
        }
      }

      send({ type: 'done', processed, skipped, failed })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
