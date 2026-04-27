import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAILS = new Set(['dirtysecretai@gmail.com', 'promptandprotocol@gmail.com'])

// Cache the flag for 15 seconds so every request doesn't hit the DB.
let cachedValue: boolean | null = null
let cacheExpiry = 0

export async function isGenerationBlocked(userEmail?: string | null): Promise<boolean> {
  if (userEmail && ADMIN_EMAILS.has(userEmail.toLowerCase())) return false

  const now = Date.now()
  if (cachedValue !== null && now < cacheExpiry) return cachedValue

  try {
    const state = await prisma.systemState.findFirst({
      select: { aiGenerationMaintenance: true },
    })
    cachedValue = state?.aiGenerationMaintenance ?? false
    cacheExpiry = now + 15_000
    return cachedValue
  } catch {
    return false
  }
}

// Call this to immediately invalidate the cache (e.g. after toggling the flag).
export function invalidateGenerationGuardCache() {
  cachedValue = null
  cacheExpiry = 0
}
