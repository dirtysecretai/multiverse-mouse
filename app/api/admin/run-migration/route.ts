import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

// ONE-TIME migration route — delete this file after running it once.
export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "AuditAccount"`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "AuditAccount" (
        "id"            SERIAL PRIMARY KEY,
        "username"      TEXT NOT NULL UNIQUE,
        "internalEmail" TEXT NOT NULL UNIQUE,
        "plainPassword" TEXT NOT NULL,
        "userId"        INTEGER NOT NULL UNIQUE,
        "notes"         TEXT,
        "addedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditAccount_internalEmail_idx" ON "AuditAccount"("internalEmail")
    `)
    return NextResponse.json({ ok: true, message: 'AuditAccount table recreated successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
