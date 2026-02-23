// lib/prompt-intelligence.ts
// Helper functions for Prompt Intelligence system

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// USER CONSENT MANAGEMENT
// =============================================================================

export async function ensureUserConsent(userId: number) {
  let consent = await prisma.userConsent.findUnique({
    where: { userId },
  });

  if (!consent) {
    consent = await prisma.userConsent.create({
      data: {
        userId,
        optInTraining: false,
        optInAnalytics: true,
      },
    });
  }

  return consent;
}

export async function updateUserConsent(
  userId: number,
  optInTraining: boolean,
  optInAnalytics: boolean
) {
  return await prisma.userConsent.upsert({
    where: { userId },
    update: {
      optInTraining,
      optInAnalytics,
      updatedAt: new Date(),
    },
    create: {
      userId,
      optInTraining,
      optInAnalytics,
    },
  });
}

// =============================================================================
// PROMPT ANALYSIS
// =============================================================================

interface AnalysisData {
  subjects: string[];
  wardrobe: string[];
  lighting: string[];
  cameraSettings: string[];
  styleTokens: string[];
  totalTokens: number;
  sfwTokens: number;
  descriptiveTokens: number;
  sfwRatio: number;
  clarityScore?: number;
  complexityScore?: number;
  failureRiskScore?: number;
}

export async function savePromptAnalysis(
  generatedImageId: number,
  analysis: AnalysisData
) {
  try {
    await prisma.promptAnalysis.create({
      data: {
        generatedImageId,
        subjects: analysis.subjects,
        wardrobe: analysis.wardrobe,
        lighting: analysis.lighting,
        cameraSettings: analysis.cameraSettings,
        styleTokens: analysis.styleTokens,
        totalTokens: analysis.totalTokens,
        sfwTokens: analysis.sfwTokens,
        descriptiveTokens: analysis.descriptiveTokens,
        sfwRatio: analysis.sfwRatio,
        clarityScore: analysis.clarityScore,
        complexityScore: analysis.complexityScore,
        failureRiskScore: analysis.failureRiskScore,
        analyzerVersion: 'v1',
      },
    });
    
    console.log('✅ Saved prompt analysis for image', generatedImageId);
  } catch (error) {
    console.error('Failed to save prompt analysis:', error);
  }
}

// =============================================================================
// PII REDACTION
// =============================================================================

interface RedactionResult {
  cleanText: string;
  originalLength: number;
  redactedLength: number;
  flags: {
    emails: number;
    phones: number;
    names: number;
    urls: number;
  };
}

export async function redactPrompt(text: string): Promise<RedactionResult> {
  let cleanText = text;
  const flags = {
    emails: 0,
    phones: 0,
    names: 0,
    urls: 0,
  };

  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatches = text.match(emailPattern);
  if (emailMatches) {
    flags.emails = emailMatches.length;
    cleanText = cleanText.replace(emailPattern, '[EMAIL_REDACTED]');
  }

  const phonePattern = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  const phoneMatches = text.match(phonePattern);
  if (phoneMatches) {
    flags.phones = phoneMatches.length;
    cleanText = cleanText.replace(phonePattern, '[PHONE_REDACTED]');
  }

  const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const urlMatches = text.match(urlPattern);
  if (urlMatches) {
    flags.urls = urlMatches.length;
    cleanText = cleanText.replace(urlPattern, '[URL_REDACTED]');
  }

  const namePattern = /\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+\b/g;
  const nameMatches = text.match(namePattern);
  if (nameMatches) {
    flags.names = nameMatches.length;
    cleanText = cleanText.replace(namePattern, '[NAME_REDACTED]');
  }

  return {
    cleanText: cleanText.trim(),
    originalLength: text.length,
    redactedLength: cleanText.length,
    flags,
  };
}

export async function saveRedactedPrompt(
  generatedImageId: number,
  prompt: string
) {
  const image = await prisma.generatedImage.findUnique({
    where: { id: generatedImageId },
    include: { user: { include: { userConsent: true } } },
  });

  if (!image?.user.userConsent?.optInTraining) {
    console.log('⏭️  Skipping redaction - user not opted in');
    return;
  }

  try {
    const redactionResult = await redactPrompt(prompt);

    await prisma.redactedPrompt.create({
      data: {
        generatedImageId,
        cleanText: redactionResult.cleanText,
        originalLength: redactionResult.originalLength,
        redactedLength: redactionResult.redactedLength,
        redactionFlags: redactionResult.flags,
      },
    });

    console.log('✅ Saved redacted prompt for image', generatedImageId);
  } catch (error) {
    console.error('Failed to save redacted prompt:', error);
  }
}

// =============================================================================
// USER RATINGS
// =============================================================================

export async function saveImageRating(
  generatedImageId: number,
  userId: number,
  rating: {
    score: number;
    wasBlocked: boolean;
    wasAccurate?: boolean;
    feedbackText?: string;
    tags?: string[];
  }
) {
  try {
    await prisma.imageRating.create({
      data: {
        generatedImageId,
        userId,
        score: rating.score,
        wasBlocked: rating.wasBlocked,
        wasAccurate: rating.wasAccurate,
        feedbackText: rating.feedbackText,
        tags: rating.tags || [],
      },
    });

    console.log('✅ Saved rating for image', generatedImageId);

    if (rating.score >= 4 && !rating.wasBlocked) {
      await considerForRecipeLibrary(generatedImageId);
    }
  } catch (error) {
    console.error('Failed to save rating:', error);
  }
}

async function considerForRecipeLibrary(generatedImageId: number) {
  const image = await prisma.generatedImage.findUnique({
    where: { id: generatedImageId },
    include: { promptAnalysis: true },
  });

  if (!image || !image.promptAnalysis) return;

  const similarRecipes = await prisma.promptRecipe.findMany({
    where: {
      model: image.model,
      tags: { hasSome: image.promptAnalysis.subjects },
    },
  });

  if (similarRecipes.length < 3) {
    await prisma.promptRecipe.create({
      data: {
        userId: image.userId,
        title: `${image.promptAnalysis.subjects.slice(0, 3).join(', ')} - ${image.model}`,
        prompt: image.prompt,
        model: image.model,
        settings: {},
        tags: [
          ...image.promptAnalysis.subjects,
          ...image.promptAnalysis.styleTokens,
        ].slice(0, 10),
        successRate: 100,
        usageCount: 0,
        isPublic: false,
      },
    });

    console.log('📚 Added to recipe library');
  }
}

// =============================================================================
// MAIN INTEGRATION FUNCTION
// =============================================================================

export async function processGenerationSuccess(
  generatedImageId: number,
  analysisData?: AnalysisData
) {
  const image = await prisma.generatedImage.findUnique({
    where: { id: generatedImageId },
  });

  if (!image) return;

  if (analysisData) {
    await savePromptAnalysis(generatedImageId, analysisData);
  }

  await saveRedactedPrompt(generatedImageId, image.prompt);
}

// =============================================================================
// ANALYTICS
// =============================================================================

export async function getDashboardMetrics(userId?: number) {
  const where = userId ? { userId } : {};

  const [
    totalGenerations,
    totalByModel,
    avgRatings,
    recentImages,
  ] = await Promise.all([
    prisma.generatedImage.count({ where }),

    prisma.generatedImage.groupBy({
      by: ['model'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),

    prisma.imageRating.aggregate({
      where: userId ? { userId } : {},
      _avg: { score: true },
    }),

    prisma.generatedImage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        promptAnalysis: true,
        imageRating: true,
      },
    }),
  ]);

  return {
    totalGenerations,
    modelBreakdown: totalByModel.map(m => ({
      model: m.model,
      count: m._count.id,
    })),
    avgRating: avgRatings._avg.score || 0,
    recentImages,
  };
}

export async function findOptimalRatio(model: string) {
  const images = await prisma.generatedImage.findMany({
    where: { model },
    include: {
      promptAnalysis: true,
      imageRating: true,
    },
  });

  const ratioGroups: Record<string, any[]> = {
    'low': [],
    'medium': [],
    'high': [],
  };

  for (const img of images) {
    if (!img.promptAnalysis) continue;

    const ratio = img.promptAnalysis.sfwRatio;
    if (ratio <= 40) ratioGroups.low.push(img);
    else if (ratio <= 70) ratioGroups.medium.push(img);
    else ratioGroups.high.push(img);
  }

  const stats = Object.entries(ratioGroups).map(([range, imgs]) => {
    const avgRating = imgs
      .filter(i => i.imageRating)
      .reduce((sum, i) => sum + (i.imageRating?.score || 0), 0) / (imgs.length || 1);

    return {
      range,
      count: imgs.length,
      avgRating,
    };
  });

  const optimal = stats.reduce((best, current) => 
    current.avgRating > best.avgRating ? current : best
  );

  return {
    model,
    optimal: optimal.range,
    stats,
    recommendation: `For ${model}, use ${optimal.range} SFW ratio (${optimal.avgRating.toFixed(1)} avg rating)`,
  };
}
