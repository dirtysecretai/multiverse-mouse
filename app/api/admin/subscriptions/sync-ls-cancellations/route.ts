import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

type SyncResult = {
  subscriptionId: number;
  lsId: string;
  email: string;
  action: string;
  status: 'synced' | 'skipped' | 'failed';
  error?: string;
};

// POST — bidirectional sync with LemonSqueezy for all subscriptions that have an lsSubscriptionId.
//
// What it does:
//   • Our DB active  + LS cancelled  → pull cancellation into DB
//     (unless metadata.manualOverrideAt is newer than LS updated_at — admin overrides are respected)
//   • Our DB active  + LS active     → update lsCurrentPeriodEnd / nextBillingDate from LS
//   • Our DB non-active + LS active  → push cancellation TO LS
//   • Both cancelled                 → no-op
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

    const allLsSubs = await prisma.subscription.findMany({
      where: { lsSubscriptionId: { not: null } },
      select: {
        id: true,
        lsSubscriptionId: true,
        status: true,
        cancelledAt: true,
        metadata: true,
        user: { select: { email: true } },
      },
    });

    if (allLsSubs.length === 0) {
      return NextResponse.json({ success: true, synced: 0, skipped: 0, failed: 0, results: [] });
    }

    const results: SyncResult[] = [];

    for (const sub of allLsSubs) {
      try {
        const res = await fetch(
          `https://api.lemonsqueezy.com/v1/subscriptions/${sub.lsSubscriptionId}`,
          {
            headers: {
              'Authorization': `Bearer ${lsApiKey}`,
              'Accept': 'application/vnd.api+json',
            },
          }
        );

        if (res.status === 404) {
          results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'not_found_on_ls', status: 'skipped' });
          continue;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'fetch_error', status: 'failed', error: `HTTP ${res.status}: ${text.substring(0, 100)}` });
          continue;
        }

        const lsData = await res.json();
        const attrs = lsData.data?.attributes;
        if (!attrs) {
          results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'parse_error', status: 'failed', error: 'Unexpected LS response' });
          continue;
        }

        const lsStatus: string    = attrs.status;
        const lsUpdatedAt         = attrs.updated_at ? new Date(attrs.updated_at) : null;
        const renewsAt            = attrs.renews_at  ? new Date(attrs.renews_at)  : null;
        const endsAt              = attrs.ends_at    ? new Date(attrs.ends_at)    : null;
        const lsIsActive          = !['cancelled', 'expired'].includes(lsStatus);
        const lsIsCancelled       = !lsIsActive;

        const meta: any           = sub.metadata ?? {};
        const manualOverrideAt    = meta.manualOverrideAt ? new Date(meta.manualOverrideAt) : null;
        // Admin override is "newer" only if it post-dates the last LS update
        const manualIsNewer       = !!(manualOverrideAt && lsUpdatedAt && manualOverrideAt > lsUpdatedAt);

        // ── Case 1: our DB active, LS cancelled ────────────────────────────────
        if (sub.status === 'active' && lsIsCancelled) {
          if (manualIsNewer) {
            results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'skip_manual_override', status: 'skipped' });
          } else {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'cancelled', cancelledAt: endsAt || new Date(), autoRenew: false },
            });
            results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'pulled_cancellation', status: 'synced' });
          }
          continue;
        }

        // ── Case 2: our DB non-active, LS active → push cancellation to LS ────
        if (sub.status !== 'active' && lsIsActive) {
          const cancelRes = await fetch(
            `https://api.lemonsqueezy.com/v1/subscriptions/${sub.lsSubscriptionId}`,
            {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${lsApiKey}`, 'Accept': 'application/vnd.api+json' },
            }
          );
          if (cancelRes.ok || cancelRes.status === 404) {
            results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'pushed_cancellation', status: 'synced' });
          } else {
            const text = await cancelRes.text().catch(() => '');
            results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'push_cancel_failed', status: 'failed', error: `HTTP ${cancelRes.status}: ${text.substring(0, 100)}` });
          }
          continue;
        }

        // ── Case 3: both active → update renewal dates ─────────────────────────
        if (sub.status === 'active' && lsIsActive) {
          if (renewsAt) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { lsCurrentPeriodEnd: renewsAt, nextBillingDate: renewsAt },
            });
          }
          results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'updated_renewal', status: 'synced' });
          continue;
        }

        // ── Case 4: both cancelled → nothing to do ─────────────────────────────
        results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'already_in_sync', status: 'synced' });

      } catch (err: any) {
        results.push({ subscriptionId: sub.id, lsId: sub.lsSubscriptionId!, email: sub.user.email, action: 'error', status: 'failed', error: err?.message || 'Unknown error' });
      }
    }

    const synced  = results.filter(r => r.status === 'synced').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed  = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({ success: true, synced, skipped, failed, results });
  } catch (error: any) {
    console.error('sync-ls error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
