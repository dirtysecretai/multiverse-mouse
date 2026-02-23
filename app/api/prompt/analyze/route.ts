// app/api/prompt/analyze/route.ts
// Prompt Analyzer - Analyzes prompts before generation

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AnalyzeRequest {
  prompt: string;
  model: string;
}

interface AnalyzeResponse {
  parse: {
    subjects: string[];
    wardrobe: string[];
    lighting: string[];
    cameraSettings: string[];
    styleTokens: string[];
  };
  scores: {
    clarity: number;
    failureRisk: number;
    complexity: number;
  };
  ratios: {
    totalTokens: number;
    sfwTokens: number;
    descriptiveTokens: number;
    sfwRatio: number;
  };
  issues: string[];
  suggestions: {
    addTokens: string[];
    removeTokens: string[];
  };
  rewrites: Array<{
    style: string;
    text: string;
    explanation: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();
    const { prompt, model } = body;

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzePromptWithGemini(prompt, model);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Prompt analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze prompt' },
      { status: 500 }
    );
  }
}

async function analyzePromptWithGemini(
  prompt: string,
  targetModel: string
): Promise<AnalyzeResponse> {
  
  const systemPrompt = `You are an expert AI image generation prompt analyst for the "${targetModel}" model.

CRITICAL CONTEXT: The "Wobbly Line" Strategy
- AI models have safety filters that block certain content
- The key is balancing "Safe For Work" (SFW) tokens against descriptive tokens
- SFW tokens include: "cinematic", "4k", "professional lighting", "masterpiece", "high quality", "photorealistic", "detailed", "intricate"
- Descriptive tokens: specific details about subjects, wardrobe, poses, scenes
- Optimal ratio typically 50:1 to 75:1 (SFW:Descriptive) for Gemini models

Your analysis must:
1. Parse the prompt into structured components
2. Calculate token ratios
3. Identify potential issues
4. Score clarity, complexity, and failure risk
5. Suggest improvements

Respond ONLY with valid JSON in this exact format:
{
  "parse": {
    "subjects": ["list of main subjects"],
    "wardrobe": ["clothing items"],
    "lighting": ["lighting terms"],
    "cameraSettings": ["camera/technical terms"],
    "styleTokens": ["quality/style modifiers"]
  },
  "scores": {
    "clarity": 0-100,
    "failureRisk": 0-100,
    "complexity": 0-100
  },
  "ratios": {
    "totalTokens": number,
    "sfwTokens": number,
    "descriptiveTokens": number,
    "sfwRatio": number
  },
  "issues": ["list of potential problems"],
  "suggestions": {
    "addTokens": ["tokens to add for safety"],
    "removeTokens": ["risky tokens to remove"]
  },
  "rewrites": [
    {
      "style": "Maximum Safety",
      "text": "rewritten prompt with very high SFW ratio",
      "explanation": "why this version is safer"
    },
    {
      "style": "Balanced",
      "text": "rewritten prompt with balanced ratio",
      "explanation": "balanced approach"
    },
    {
      "style": "Creative",
      "text": "rewritten prompt optimized for quality",
      "explanation": "maximizes detail while staying safe"
    }
  ]
}`;

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.3,
    }
  });

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `Analyze this prompt for "${targetModel}":\n\nPROMPT: ${prompt}\n\nProvide your analysis in JSON format.` }
  ]);

  const response = result.response;
  const text = response.text();

  let jsonText = text.trim();
  
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
  }

  const analysis: AnalyzeResponse = JSON.parse(jsonText);
  return analysis;
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    version: '1.0',
    features: ['parse', 'scores', 'ratios', 'issues', 'suggestions', 'rewrites']
  });
}
