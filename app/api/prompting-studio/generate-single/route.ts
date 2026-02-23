// app/api/prompting-studio/generate-single/route.ts
// Generates a single optimized prompt for celebrity

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { celebrity, baseStyle, model, promptModel } = await req.json();

    if (!celebrity) {
      return NextResponse.json({ error: 'Celebrity name required' }, { status: 400 });
    }

    // Map UI model names to actual Gemini API model names
    const modelNameMap: Record<string, string> = {
      'gemini-3-flash': 'gemini-3-flash-preview',
      'gemini-3-pro': 'gemini-3-pro-preview',
      'gemini-2.0-flash-exp': 'gemini-2.5-flash', // Fallback to stable 2.5
      'gemini-exp-1206': 'gemini-2.5-pro' // Fallback to stable 2.5
    };

    // Use the selected prompt model, default to gemini-3-flash if not provided
    const selectedModel = promptModel || 'gemini-3-flash';
    const actualModelName = modelNameMap[selectedModel] || 'gemini-3-flash-preview';

    console.log(`🤖 Using prompt model: ${selectedModel} → ${actualModelName}`);

    // Generate a single optimized prompt
    const systemPrompt = `You are an expert AI image prompt engineer. Generate ONE optimized prompt for "${celebrity}" with the following requirements:

CRITICAL RULES:
1. Include celebrity name
2. Include high-quality tokens (photorealistic, 4k, high quality, detailed, etc.)
3. Include style: ${baseStyle}
4. Balance appeal with safety - make it attractive but professional
5. Add appropriate lighting, atmosphere, and technical details
6. Keep it under 100 words
7. NO explicit content, focus on artistic/professional qualities

Generate a prompt that will:
- Pass content filters
- Look professional and high-quality
- Be attractive but appropriate
- Include technical photography terms

Respond with ONLY the prompt text, no other commentary or formatting.`;

    const aiModel = genAI.getGenerativeModel({
      model: actualModelName,
      generationConfig: { temperature: 0.7 }
    });

    const result = await aiModel.generateContent(systemPrompt);
    const prompt = result.response.text().trim();

    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error('Prompt generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    );
  }
}
