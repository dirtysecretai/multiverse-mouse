# AI Generation Queue System - Implementation Guide

## Overview

This queue system manages AI image/video generation with **per-model concurrency limits** and a **FIFO queue** for overflow requests. When a model reaches its concurrency limit, new generations are automatically queued and processed in order.

---

## 🗄️ Database Schema

### New Tables Added to Prisma

1. **ModelConcurrencyLimit** - Stores per-model generation limits
   - `modelId`: Unique model identifier (e.g., 'nano-banana-pro')
   - `modelType`: 'image' or 'video'
   - `maxConcurrent`: Maximum simultaneous generations
   - `currentActive`: Currently processing count

2. **GenerationQueue** - FIFO queue for pending generations
   - `userId`: User who requested generation
   - `modelId`: Which model to use
   - `prompt`: Generation prompt
   - `parameters`: JSON with all generation settings
   - `status`: 'queued', 'processing', 'completed', 'failed', 'cancelled'
   - `priority`: Higher priority processed first (0 = normal FIFO)
   - `ticketCost`: Tickets reserved for this generation
   - `queuePosition`: Current position in queue
   - Timestamps: `queuedAt`, `startedAt`, `completedAt`

---

## 🎛️ Admin Interface

### Access the Queue Management Page

Navigate to: **Admin Terminal → Queue Management**

Location: `/admin/queue`

### Features

#### 1. **Real-time Dashboard**
- **Stats Cards**: Shows counts for Queued, Processing, Completed, Failed
- **Auto-refresh**: Updates every 5 seconds

#### 2. **Model Concurrency Limits**
- View all models and their current usage
- Edit limits (1-50 concurrent generations per model)
- Visual indicators when models are at capacity
- Default limits:
  - Most image models: 5 concurrent
  - High-speed models (Flash Scanner): 10 concurrent
  - Compute-heavy models (Flux-2, SeeDream): 2-3 concurrent
  - Video models: 2 concurrent

#### 3. **Queue Viewer**
- See all items in queue with status
- Filter by status (queued, processing, completed, failed)
- Filter by model
- View queue position for pending items
- See timestamps for queued, started, completed
- View error messages for failed items

#### 4. **Queue Actions**
- **Cancel**: Cancel queued or processing items (refunds tickets)
- **Retry**: Retry failed items
- **Clear Completed**: Bulk remove completed/cancelled items

---

## 📝 How to Integrate into Your Generation Endpoints

### Step 1: Check if Model Can Process Immediately

```typescript
import { canProcessGeneration, queueGeneration } from '@/lib/queue-worker';

// In your /api/generate route
export async function POST(request: Request) {
  const { prompt, model, userId, quality, aspectRatio, referenceImages } = await request.json();

  // Check if model can process now
  const canProcess = await canProcessGeneration(model);

  if (!canProcess) {
    // Add to queue
    const { queueId, position } = await queueGeneration({
      userId,
      modelId: model,
      modelType: 'image', // or 'video'
      prompt,
      parameters: { quality, aspectRatio, referenceImages },
      ticketCost: 1, // or however many tickets this costs
      priority: 0 // 0 = normal, higher = priority
    });

    return NextResponse.json({
      queued: true,
      queueId,
      position,
      message: `Generation queued at position ${position}`
    });
  }

  // Process immediately...
  // (your existing generation logic)
}
```

### Step 2: Mark as Processing When Starting

```typescript
import { startProcessing } from '@/lib/queue-worker';

// When actually starting generation
await startProcessing(queueId); // if coming from queue

// OR for immediate processing, manually increment:
await prisma.modelConcurrencyLimit.update({
  where: { modelId: model },
  data: { currentActive: { increment: 1 } }
});
```

### Step 3: Mark as Complete or Failed

```typescript
import { completeGeneration, failGeneration } from '@/lib/queue-worker';

try {
  // After successful generation
  const imageUrl = await generateImage(prompt);

  if (queueId) {
    await completeGeneration(queueId, imageUrl);
  } else {
    // Manual decrement if not from queue
    await prisma.modelConcurrencyLimit.update({
      where: { modelId: model },
      data: { currentActive: { decrement: 1 } }
    });
  }

  return NextResponse.json({ imageUrl });
} catch (error) {
  if (queueId) {
    await failGeneration(queueId, error.message);
  } else {
    await prisma.modelConcurrencyLimit.update({
      where: { modelId: model },
      data: { currentActive: { decrement: 1 } }
    });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

---

## 🔄 Polling for Queue Status (Frontend)

```typescript
// In your frontend generation component
const checkQueueStatus = async (queueId: number) => {
  const res = await fetch(`/api/queue/status/${queueId}`);
  const data = await res.json();

  if (data.status === 'queued') {
    console.log(`Position: ${data.position}, Est. wait: ${data.estimatedWait}s`);
    // Poll again in 3 seconds
    setTimeout(() => checkQueueStatus(queueId), 3000);
  } else if (data.status === 'completed') {
    console.log('Generation complete!', data.resultUrl);
    // Display result
  } else if (data.status === 'failed') {
    console.error('Generation failed:', data.errorMessage);
  }
};
```

---

## 🔧 Database Migration

Run this to create the new tables:

```bash
npx prisma db push
```

Or generate and run migration:

```bash
npx prisma migrate dev --name add_queue_system
```

---

## 🚀 Initialization

The system auto-initializes default limits for all models on first GET request to `/api/admin/queue/limits`.

You can also manually initialize by visiting:
```
GET /api/admin/queue/initialize
```

---

## 📊 Default Model Limits

### Image Models
- `nano-banana`: 5 concurrent
- `nano-banana-pro`: 5 concurrent
- `seedream-4.5`: 3 concurrent
- `flux-2-pro`: 2 concurrent
- `gemini-3-pro-image`: 5 concurrent
- `flash-scanner-v2.5`: 10 concurrent

### Video Models
- `minimax-video-01`: 2 concurrent
- `haiper-2.0`: 2 concurrent
- `kling-1.6`: 2 concurrent

**Adjust these limits in the admin panel based on your API rate limits and infrastructure.**

---

## 🎯 Benefits

1. **Traffic Management**: Control load on external APIs
2. **Fair Access**: FIFO ensures first-come-first-served
3. **Cost Control**: Limit expensive model usage
4. **User Experience**: Transparent queue position
5. **Failure Handling**: Automatic retries and ticket refunds
6. **Analytics**: Track usage patterns per model

---

## 🔐 Security Notes

- Queue management is admin-only (email check: `dirtysecretai@gmail.com`)
- Tickets are reserved when queued, preventing double-spending
- Failed generations automatically refund tickets
- Cancelled items refund tickets

---

## 📈 Monitoring

Monitor these metrics in the admin panel:
- Total queued items
- Currently processing per model
- Completed count
- Failed count
- Average queue wait times
- Model capacity usage

---

## 🎨 Next Steps

1. ✅ Run database migration (`npx prisma db push`)
2. ✅ Visit `/admin/queue` to initialize models
3. ✅ Set appropriate limits for each model
4. ⚠️ Integrate `canProcessGeneration()` into your generation endpoints
5. ⚠️ Add queue status polling to frontend
6. ⚠️ Update user UI to show queue position when queued
7. ⚠️ Consider adding webhook/notification when generation completes

---

## 🐛 Troubleshooting

**Queue items stuck in "processing":**
- Check if generation endpoint crashed mid-generation
- Manually mark as failed in database or use retry button

**Model always showing full capacity:**
- Check `currentActive` count in ModelConcurrencyLimit table
- Reset if needed: `UPDATE ModelConcurrencyLimit SET currentActive = 0 WHERE modelId = '...'`

**Tickets not refunding:**
- Check GenerationQueue item status
- Verify Ticket table reserved/balance columns

---

## 📞 Support

For issues with the queue system, check:
1. Browser console for frontend errors
2. Server logs for API errors
3. Database directly for stuck items
4. Admin queue panel for real-time status
