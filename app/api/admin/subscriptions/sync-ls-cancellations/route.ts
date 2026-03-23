import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// POST — finds every subscription that was cancelled on our site but
// still has an active lsSubscriptionId, and cancels it on LemonSqueezy.
export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get('x-admin-password');
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lsApiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!lsApiKey) {
      return NextResponse.json({ error: 'LEMONSQUEEZY_API_KEY not configured' }, { status: 500 });
    }

    // Find subscriptions cancelled on our site that have a LS subscription ID
    const cancelled = await prisma.subscription.findMany({
      where: {
        cancelledAt: { not: null },
        lsSubscriptionId: { not: null },
      },
      select: {
        id: true,
        lsSubscriptionId: true,
        user: { select: { email: true } },
      },
    });

    if (cancelled.length === 0) {
      return NextResponse.json({ success: true, synced: 0, failed: 0, results: [] });
    }

    const results: { subscriptionId: number; lsId: string; email: string; status: 'synced' | 'failed'; error?: string }[] = [];

    for (const sub of cancelled) {
      try {
        const res = await fetch(
          `https://api.lemonsqueezy.com/v1/subscriptions/${sub.lsSubscriptionId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${lsApiKey}`,
              'Accept': 'application/vnd.api+json',
            },
          }
        );

        // 200 = cancelled successfully, 404 = already cancelled/not found (both are fine)
        if (res.ok || res.status === 404) {
          results.push({
            subscriptionId: sub.id,
            lsId: sub.lsSubscriptionId!,
            email: sub.user.email,
            status: 'synced',
          });
        } else {
          const text = await res.text().catch(() => '');
          results.push({
            subscriptionId: sub.id,
            lsId: sub.lsSubscriptionId!,
            email: sub.user.email,
            status: 'failed',
            error: `HTTP ${res.status}: ${text.substring(0, 100)}`,
          });
        }
      } catch (err: any) {
        results.push({
          subscriptionId: sub.id,
          lsId: sub.lsSubscriptionId!,
          email: sub.user.email,
          status: 'failed',
          error: err?.message || 'Unknown error',
        });
      }
    }

    const synced = results.filter(r => r.status === 'synced').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({ success: true, synced, failed, results });
  } catch (error: any) {
    console.error('sync-ls-cancellations error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
