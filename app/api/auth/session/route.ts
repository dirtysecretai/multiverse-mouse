import { NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const user = await getUserFromSession(token)

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Ensure user has a Ticket record (for legacy users)
    if (!user.tickets) {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      try {
        await prisma.ticket.create({
          data: {
            userId: user.id,
            balance: 10, // Give legacy users 10 free tickets
            totalBought: 0,
            totalUsed: 0,
          },
        })
        console.log(`Created Ticket record for user ${user.id} with 10 free tickets`)
      } catch (err) {
        console.error('Failed to create Ticket record:', err)
      } finally {
        await prisma.$disconnect()
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ticketBalance: user.tickets?.balance || 10, // Default to 10 if just created
      },
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (error: any) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { authenticated: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
