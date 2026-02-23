// Creates a PayPal subscription (recurring billing)
// This uses PayPal's Subscriptions API, not one-time checkout

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

    const { planId } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal subscription
    const subscriptionResponse = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: JSON.stringify({
          userId: user.id,
          tier: 'prompt-studio-dev',
          timestamp: Date.now(),
        }),
        application_context: {
          brand_name: 'AI Design Studio',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
          },
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/subscriptions?success=true`,
          cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/subscriptions?cancelled=true`,
        },
      }),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      console.error('PayPal subscription creation failed:', subscriptionData);
      return NextResponse.json(
        { error: 'Failed to create PayPal subscription', details: subscriptionData },
        { status: 500 }
      );
    }

    // Extract approval URL
    const approvalLink = subscriptionData.links?.find((link: any) => link.rel === 'approve');

    if (!approvalLink) {
      console.error('No approval link found in PayPal response');
      return NextResponse.json(
        { error: 'Failed to get subscription approval link' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscriptionId: subscriptionData.id,
      approvalUrl: approvalLink.href,
      status: subscriptionData.status,
    });
  } catch (error) {
    console.error('PayPal subscription creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
