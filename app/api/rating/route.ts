import { NextRequest, NextResponse } from 'next/server'
import { saveImageRating } from '@/lib/prompt-intelligence'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getUserFromSession(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { generatedImageId, score } = body

    if (!generatedImageId || !score) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await saveImageRating(generatedImageId, user.id, {
      score,
      wasBlocked: false,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // P2002 = unique constraint — already rated, treat as success
    if (error?.code === 'P2002') return NextResponse.json({ success: true })
    console.error('Failed to save rating:', error)
    return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 })
  }
}
