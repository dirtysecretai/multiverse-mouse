import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Fetch active notifications (for homepage)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === 'true' // Admin can see all

    const notifications = await prisma.notification.findMany({
      where: showAll ? undefined : { isActive: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST - Create new notification (admin only)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { message, type = 'info', isActive = true } = body

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    const notification = await prisma.notification.create({
      data: {
        message: message.trim(),
        type,
        isActive
      }
    })

    console.log('Notification created:', notification)
    return NextResponse.json(notification)
  } catch (error) {
    console.error('Error creating notification:', error)
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

// PUT - Update notification (admin only)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, message, type, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      )
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        ...(message && { message: message.trim() }),
        ...(type && { type }),
        ...(isActive !== undefined && { isActive })
      }
    })

    console.log('Notification updated:', notification)
    return NextResponse.json(notification)
  } catch (error) {
    console.error('Error updating notification:', error)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}

// DELETE - Delete notification (admin only)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      )
    }

    await prisma.notification.delete({
      where: { id: parseInt(id) }
    })

    console.log('Notification deleted:', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
