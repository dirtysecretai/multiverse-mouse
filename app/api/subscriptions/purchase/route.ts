// app/api/subscriptions/purchase/route.ts
// Creates a PayPal order for subscription purchase

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { cookies } from 'next/headers';

const PAYPAL_API = process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const user = token ? await getUserFromSession(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tier, amount, plan, interval, tickets } = await req.json();

    if (!tier || !amount || !plan || !interval || !tickets) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate tier
    if (tier !== 'prompt-studio-dev') {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    // Validate plan amounts and tickets
    const validPlans = {
      biweekly: { amount: 20, tickets: 250 },
      monthly: { amount: 40, tickets: 500 },
      yearly: { amount: 480, tickets: 500 },
    };

    if (!validPlans[interval as keyof typeof validPlans] ||
        validPlans[interval as keyof typeof validPlans].amount !== amount ||
        validPlans[interval as keyof typeof validPlans].tickets !== tickets) {
      return NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create description based on interval
    const descriptions = {
      biweekly: 'Prompt Studio Dev Tier - Biweekly ($20 + 250 tickets every 2 weeks)',
      monthly: 'Prompt Studio Dev Tier - Monthly ($40 + 500 tickets/month)',
      yearly: 'Prompt Studio Dev Tier - Yearly ($480 + 500 tickets/month)',
    };

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: descriptions[interval as keyof typeof descriptions],
            amount: {
              currency_code: 'USD',
              value: amount.toFixed(2),
            },
            custom_id: JSON.stringify({
              type: 'subscription',
              userId: user.id,
              tier,
              plan,
              interval,
              tickets,
              timestamp: Date.now(),
            }),
          },
        ],
        application_context: {
          brand_name: 'AI Design Studio',
          locale: 'en-US',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
        },
      }),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('PayPal order creation failed:', orderData);
      return NextResponse.json(
        { error: 'Failed to create PayPal order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: orderData.id,
    });
  } catch (error) {
    console.error('Subscription purchase error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription order' },
      { status: 500 }
    );
  }
}
