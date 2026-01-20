import { NextResponse } from 'next/server'

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
    const body = await request.json()
    const { galleryId, amount, galleryTitle } = body

    if (!galleryId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('Creating PayPal order:', { galleryId, amount, galleryTitle })

    const accessToken = await getPayPalAccessToken()

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `gallery_${galleryId}`,
          description: `Access to ${galleryTitle || 'Gallery'}`,
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
          },
        },
      ],
      // REMOVED: application_context with return_url and cancel_url
      // This was causing localhost issues - popup flow handles this automatically
    }

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderData),
    })

    const order = await response.json()

    if (!response.ok) {
      console.error('PayPal order creation failed:', order)
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: order },
        { status: 500 }
      )
    }

    console.log('PayPal order created successfully:', order.id)

    return NextResponse.json({
      success: true,
      orderId: order.id,
    })

  } catch (error: any) {
    console.error('Error creating PayPal order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


