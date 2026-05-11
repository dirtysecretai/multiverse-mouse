import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const TEMPLATES_PATH = path.join(process.cwd(), 'AI', 'export-templates.json')

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

function readTemplates(): unknown[] {
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function writeTemplates(templates: unknown[]) {
  fs.mkdirSync(path.dirname(TEMPLATES_PATH), { recursive: true })
  fs.writeFileSync(TEMPLATES_PATH, JSON.stringify(templates, null, 2))
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(readTemplates())
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const templates = readTemplates() as Record<string, unknown>[]
  const newTemplate = {
    ...body,
    id: `tpl_${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  templates.push(newTemplate)
  writeTemplates(templates)
  return NextResponse.json(newTemplate, { status: 201 })
}
