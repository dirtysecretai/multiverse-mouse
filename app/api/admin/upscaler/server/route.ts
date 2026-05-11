import { NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import http from 'http'

const PORT = 8766
let serverProcess: ChildProcess | null = null

function checkAuth(req: Request) {
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) return true
  return req.headers.get('x-admin-password') === pass
}

function ping(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${PORT}/health`, res => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
  })
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const running = await ping()
  return NextResponse.json({ running, pid: serverProcess?.pid ?? null })
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await ping()) return NextResponse.json({ started: false, message: 'Already running' })

  const candidates = [
    path.join(process.cwd(), 'AI', 'Real-ESRGAN', 'venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), 'AI', 'upscaler-venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), 'AI', 'upscaler-venv', 'bin', 'python'),
    path.join(process.cwd(), 'AI', 'OneTrainer', 'OneTrainer', 'venv', 'Scripts', 'python.exe'),
    'C:\\Users\\Owner\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
    'python',
    'python3',
  ]

  let pythonExe = 'python'
  for (const c of candidates) {
    if (c === 'python' || c === 'python3' || fs.existsSync(c)) {
      pythonExe = c
      break
    }
  }

  const serverScript = path.join(process.cwd(), 'AI', 'upscaler-server.py')

  serverProcess = spawn(pythonExe, [serverScript], {
    stdio: 'pipe',
    cwd: path.join(process.cwd(), 'AI'),
  })

  serverProcess.on('exit', () => { serverProcess = null })
  serverProcess.stderr?.on('data', () => {})

  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500))
    if (await ping()) return NextResponse.json({ started: true, pid: serverProcess?.pid ?? null })
  }

  return NextResponse.json({ started: false, message: 'Server did not respond in time' }, { status: 500 })
}

export async function DELETE(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill()
    serverProcess = null
    return NextResponse.json({ stopped: true })
  }
  return NextResponse.json({ stopped: false, message: 'No managed process found' })
}
