import { NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth'
import { cookies } from 'next/headers'

const PAYPAL_API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getPayPalAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured')
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()
  return data.access_token
}

export async function POST(request: Request) {
  try {
    console.log('=== CREATING TICKET PURCHASE ORDER ===')

    // Check authentication
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const user = await getUserFromSession(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ticketsCount, amount } = body

    if (!ticketsCount || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('Creating order for user:', user.id)
    console.log('Tickets:', ticketsCount, 'Amount:', amount)

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken()

    // Create PayPal order with CLEAR description format
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `TICKETS_${ticketsCount}`, // IMPORTANT: Include ticket count here
          description: `${ticketsCount} AI Generation Tickets`, // IMPORTANT: Clear format
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/buy-tickets`,
      },
    }

    console.log('PayPal order data:', JSON.stringify(orderData, null, 2))

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderData),
    })

    const order = await response.json()
    console.log('PayPal order created:', order.id)

    if (!response.ok) {
      console.error('PayPal order creation failed:', order)
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: order },
        { status: 500 }
      )
    }

    return NextResponse.json({
      orderId: order.id,
    })

  } catch (error: any) {
    console.error('=== TICKET PURCHASE ERROR ===')
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

