// POST /api/checkout
// Creates a LemonSqueezy checkout session and returns the checkout URL.
// The frontend redirects the user to that URL to complete payment.

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

const prisma = new PrismaClient()

// Ticket packages — mirrors the TICKET_PACKAGES array on the buy-tickets page
const TICKET_PACKAGES: Record<number, { variantId: number; freePrice: number; devPrice: number }> = {
  25:   { variantId: 1377265, freePrice: 5.00,   devPrice: 3.50  },
  50:   { variantId: 1377291, freePrice: 9.00,   devPrice: 6.30  },
  100:  { variantId: 1377293, freePrice: 16.00,  devPrice: 11.20 },
  250:  { variantId: 1377294, freePrice: 35.00,  devPrice: 24.50 },
  500:  { variantId: 1377296, freePrice: 65.00,  devPrice: 45.50 },
  1000: { variantId: 1377297, freePrice: 120.00, devPrice: 84.00 },
}

// Subscription plans — biweekly, monthly, yearly
const SUBSCRIPTION_PLANS: Record<string, { variantId: number }> = {
  biweekly: { variantId: 1377310 },
  monthly:  { variantId: 1377319 },
  yearly:   { variantId: 1377321 },
}

async function createLSCheckout(
  variantId: number,
  email: string,
  customData: Record<string, string>,
  customPrice?: number,
  redirectUrl?: string,
): Promise<string> {
  const apiKey    = process.env.LEMONSQUEEZY_API_KEY!
  const storeId   = process.env.LEMONSQUEEZY_STORE_ID!
  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL || 'https://prompt-protocol.vercel.app'

  const body: any = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email,
          custom: customData,
        },
        checkout_options: {
          dark: true,
          media: false,
        },
        product_options: {
          redirect_url: redirectUrl || `${baseUrl}/dashboard`,
          enabled_variants: [variantId],
        },
      },
      relationships: {
        store:   { data: { type: 'stores',   id: storeId } },
        variant: { data: { type: 'variants', id: String(variantId) } },
      },
    },
  }

  // Only send custom_price when we're overriding (dev tier discount).
  // LS expects an integer in the store's currency unit (cents for USD).
  if (customPrice !== undefined) {
    body.data.attributes.custom_price = Math.round(customPrice * 100)
  }

  const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Authorization:   `Bearer ${apiKey}`,
      'Content-Type':  'application/vnd.api+json',
      Accept:          'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`LemonSqueezy checkout creation failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return data.data.attributes.url as string
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const user = await getUserFromSession(token)
    if (!user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const body = await request.json()
    const { type } = body
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://prompt-protocol.vercel.app'

    // ── One-time ticket purchase ─────────────────────────────────────
    if (type === 'tickets') {
      const { tickets } = body as { tickets: number }
      const pkg = TICKET_PACKAGES[tickets]
      if (!pkg) return NextResponse.json({ error: 'Invalid ticket package' }, { status: 400 })

      // Check dev tier status (active subscription)
      const activeSub = await prisma.subscription.findFirst({
        where: { userId: user.id, tier: 'prompt-studio-dev', status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
      const isDevTier   = !!activeSub
      const price       = isDevTier ? pkg.devPrice : undefined  // undefined = use variant's default price
      const customPrice = isDevTier ? pkg.devPrice : undefined

      const checkoutUrl = await createLSCheckout(
        pkg.variantId,
        (user as any).email,
        { user_id: String(user.id), ticket_count: String(tickets) },
        customPrice,
        `${baseUrl}/buy-tickets?success=true&tickets=${tickets}`,
      )

      return NextResponse.json({ checkoutUrl })
    }

    // ── Subscription ─────────────────────────────────────────────────
    if (type === 'subscription') {
      const { planId } = body as { planId: string }
      const plan = SUBSCRIPTION_PLANS[planId]
      if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

      const checkoutUrl = await createLSCheckout(
        plan.variantId,
        (user as any).email,
        { user_id: String(user.id), plan_id: planId },
        undefined,
        `${baseUrl}/subscriptions?success=true`,
      )

      return NextResponse.json({ checkoutUrl })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    console.error('[Checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
