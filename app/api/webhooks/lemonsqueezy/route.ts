// POST /api/webhooks/lemonsqueezy
// Handles LemonSqueezy webhook events to credit tickets and manage subscriptions.
// Subscribed events: order_created, subscription_created, subscription_updated,
//                    subscription_cancelled, subscription_expired

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// ── Variant → ticket count maps ─────────────────────────────────────────────

// One-time ticket bundle variants
const TICKET_VARIANT_MAP: Record<number, number> = {
  1377265: 25,
  1377291: 50,
  1377293: 100,
  1377294: 250,
  1377296: 500,
  1377297: 1000,
}

// Subscription variants — tickets delivered per billing event
// Yearly plan delivers 500 × 12 = 6000 upfront (paid once/year, counted as monthly benefit)
const SUBSCRIPTION_VARIANT_MAP: Record<number, { tickets: number; billingCycle: string; price: number }> = {
  1377310: { tickets: 250,  billingCycle: 'biweekly', price: 20  },
  1377319: { tickets: 500,  billingCycle: 'monthly',  price: 40  },
  1377321: { tickets: 6000, billingCycle: 'yearly',   price: 480 },
}

// ── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

// ── Ticket delivery helper ───────────────────────────────────────────────────

async function deliverTickets(
  userId: number,
  subscriptionId: number,
  ticketCount: number,
  description: string,
) {
  const ticketRecord = await prisma.ticket.findUnique({ where: { userId } })
  const previousBalance = ticketRecord?.balance ?? 0
  const newBalance      = previousBalance + ticketCount

  await prisma.$transaction([
    prisma.ticket.upsert({
      where: { userId },
      update: {
        balance:     { increment: ticketCount },
        totalBought: { increment: ticketCount },
      },
      create: {
        userId,
        balance:     ticketCount,
        totalBought: ticketCount,
      },
    }),
    prisma.subscriptionTransaction.create({
      data: {
        subscriptionId,
        userId,
        type:            'ticket_distribution',
        ticketsAdded:    ticketCount,
        previousBalance,
        newBalance,
        description,
      },
    }),
  ])
}

// ── Event handlers ───────────────────────────────────────────────────────────

async function handleOrderCreated(payload: any, customData: any) {
  const data = payload.data.attributes

  // Only process paid orders
  if (data.status !== 'paid') return

  const userId = parseInt(customData?.user_id)
  if (!userId || isNaN(userId)) {
    console.error('[LS webhook] order_created: missing user_id in custom_data')
    return
  }

  const lsOrderId   = String(payload.data.id)
  const variantId   = data.first_order_item?.variant_id as number | undefined
  const ticketCount = variantId ? TICKET_VARIANT_MAP[variantId] : undefined

  if (!ticketCount) {
    console.error('[LS webhook] order_created: unknown variant', variantId)
    return
  }

  // Idempotency — skip if already processed
  const existing = await prisma.ticketPurchase.findUnique({ where: { lsOrderId } })
  if (existing) {
    console.log('[LS webhook] order_created: already processed', lsOrderId)
    return
  }

  const amountInCents = data.total as number // LS sends in cents
  const amountDollars = amountInCents / 100

  await prisma.$transaction([
    prisma.ticketPurchase.create({
      data: {
        userId,
        ticketsCount:  ticketCount,
        amount:        amountDollars,
        lsOrderId,
        payerEmail:    data.user_email  ?? undefined,
        payerName:     data.user_name   ?? undefined,
        paymentStatus: 'completed',
        currency:      data.currency    ?? 'USD',
        description:   `${ticketCount} ticket purchase via LemonSqueezy`,
      },
    }),
    prisma.ticket.upsert({
      where: { userId },
      update: {
        balance:     { increment: ticketCount },
        totalBought: { increment: ticketCount },
      },
      create: {
        userId,
        balance:     ticketCount,
        totalBought: ticketCount,
      },
    }),
  ])

  console.log(`[LS webhook] order_created: credited ${ticketCount} tickets to user ${userId}`)
}

async function handleSubscriptionCreated(payload: any, customData: any) {
  const data = payload.data.attributes

  const userId = parseInt(customData?.user_id)
  if (!userId || isNaN(userId)) {
    console.error('[LS webhook] subscription_created: missing user_id in custom_data')
    return
  }

  const lsSubscriptionId = String(payload.data.id)
  const variantId        = data.variant_id as number
  const planInfo         = SUBSCRIPTION_VARIANT_MAP[variantId]

  if (!planInfo) {
    console.error('[LS webhook] subscription_created: unknown variant', variantId)
    return
  }

  // Idempotency
  const existing = await prisma.subscription.findUnique({ where: { lsSubscriptionId } })
  if (existing) {
    console.log('[LS webhook] subscription_created: already exists', lsSubscriptionId)
    return
  }

  const renewsAt = data.renews_at ? new Date(data.renews_at) : null

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      tier:               'prompt-studio-dev',
      status:             'active',
      startDate:          new Date(data.created_at),
      endDate:            renewsAt,
      nextBillingDate:    renewsAt,
      billingAmount:      planInfo.price,
      billingCycle:       planInfo.billingCycle,
      autoRenew:          true,
      lsSubscriptionId,
      lsVariantId:        variantId,
      lsCurrentPeriodEnd: renewsAt,
      metadata: {
        ticketsPerCycle: planInfo.tickets,
        planId:          planInfo.billingCycle,
      },
    },
  })

  // Deliver initial tickets
  await deliverTickets(
    userId,
    subscription.id,
    planInfo.tickets,
    `Dev Tier subscription activation — ${planInfo.billingCycle}`,
  )

  console.log(`[LS webhook] subscription_created: activated ${planInfo.billingCycle} for user ${userId}, delivered ${planInfo.tickets} tickets`)
}

async function handleSubscriptionUpdated(payload: any) {
  const data             = payload.data.attributes
  const lsSubscriptionId = String(payload.data.id)

  const subscription = await prisma.subscription.findUnique({ where: { lsSubscriptionId } })
  if (!subscription) {
    console.error('[LS webhook] subscription_updated: not found', lsSubscriptionId)
    return
  }

  const newRenewsAt      = data.renews_at ? new Date(data.renews_at) : null
  const storedPeriodEnd  = subscription.lsCurrentPeriodEnd
  const isRenewal        = !!(newRenewsAt && storedPeriodEnd && newRenewsAt > storedPeriodEnd)

  // Determine new status
  let newStatus = subscription.status
  if (data.status === 'active' && subscription.status !== 'cancelled') newStatus = 'active'
  if (data.status === 'cancelled') newStatus = 'cancelled'

  await prisma.subscription.update({
    where: { lsSubscriptionId },
    data: {
      status:             newStatus,
      nextBillingDate:    newRenewsAt,
      endDate:            newRenewsAt ?? subscription.endDate,
      lsCurrentPeriodEnd: newRenewsAt ?? subscription.lsCurrentPeriodEnd,
    },
  })

  // Deliver tickets only on a genuine renewal (period advanced)
  if (isRenewal) {
    const planInfo = SUBSCRIPTION_VARIANT_MAP[subscription.lsVariantId ?? 0]
    if (planInfo) {
      await deliverTickets(
        subscription.userId,
        subscription.id,
        planInfo.tickets,
        `Dev Tier renewal — ${planInfo.billingCycle}`,
      )
      console.log(`[LS webhook] subscription_updated: renewal — delivered ${planInfo.tickets} tickets to user ${subscription.userId}`)
    }
  }
}

async function handleSubscriptionCancelled(payload: any) {
  const data             = payload.data.attributes
  const lsSubscriptionId = String(payload.data.id)

  // ends_at is when access expires (end of current paid period)
  const endsAt = data.ends_at ? new Date(data.ends_at) : null

  await prisma.subscription.updateMany({
    where: { lsSubscriptionId },
    data: {
      cancelledAt: new Date(),
      endDate:     endsAt,
      autoRenew:   false,
    },
  })

  console.log('[LS webhook] subscription_cancelled:', lsSubscriptionId)
}

async function handleSubscriptionExpired(payload: any) {
  const lsSubscriptionId = String(payload.data.id)

  await prisma.subscription.updateMany({
    where: { lsSubscriptionId },
    data: {
      status:    'expired',
      autoRenew: false,
    },
  })

  console.log('[LS webhook] subscription_expired:', lsSubscriptionId)
}

// ── Main handler ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Verify HMAC signature
  const signature = request.headers.get('X-Signature')
  const secret    = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''

  if (!verifySignature(rawBody, signature, secret)) {
    console.error('[LS webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName  = payload?.meta?.event_name as string
  const customData = payload?.meta?.custom_data ?? {}

  console.log('[LS webhook] event:', eventName)

  try {
    switch (eventName) {
      case 'order_created':
        await handleOrderCreated(payload, customData)
        break
      case 'subscription_created':
        await handleSubscriptionCreated(payload, customData)
        break
      case 'subscription_updated':
        await handleSubscriptionUpdated(payload)
        break
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(payload)
        break
      case 'subscription_expired':
        await handleSubscriptionExpired(payload)
        break
      default:
        console.log('[LS webhook] Unhandled event:', eventName)
    }
  } catch (err) {
    console.error('[LS webhook] Handler error:', err)
    // Return 200 so LS doesn't retry — log the error but don't block
    return NextResponse.json({ received: true, warning: 'Handler error — check logs' })
  } finally {
    await prisma.$disconnect()
  }

  return NextResponse.json({ received: true })
}
