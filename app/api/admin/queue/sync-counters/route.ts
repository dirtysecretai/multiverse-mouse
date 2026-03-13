import { NextResponse } from 'next/server';
import { syncActiveCounters } from '../stats/route';

// POST - Force-sync all currentActive counters from ground truth.
// Fixes negative or drifted counters caused by double-decrements.
export async function POST() {
  try {
    await syncActiveCounters();
    return NextResponse.json({ success: true, message: 'Active counters synced from queue ground truth' });
  } catch (error) {
    console.error('Failed to sync active counters:', error);
    return NextResponse.json({ error: 'Failed to sync counters' }, { status: 500 });
  }
}
