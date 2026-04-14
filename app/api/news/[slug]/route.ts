import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const article = await prisma.newsArticle.findFirst({
      where: { slug, isActive: true },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    return NextResponse.json(article)
  } catch (err) {
    console.error('GET /api/news/[slug] error:', err)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}
