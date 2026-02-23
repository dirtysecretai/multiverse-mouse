'use client';

import { useState } from 'react';

interface AnalysisResult {
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

interface Props {
  prompt: string;
  model: string;
  onAnalyzed?: (analysis: AnalysisResult) => void;
  onUsePrompt?: (newPrompt: string) => void;
}

export function PromptAnalyzer({ prompt, model, onAnalyzed, onUsePrompt }: Props) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    
    setAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/prompt/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setAnalysis(data);
      onAnalyzed?.(data);
    } catch (err) {
      setError('Failed to analyze prompt. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleAnalyze}
        disabled={analyzing || !prompt.trim()}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {analyzing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Analyzing...
          </span>
        ) : (
          '🔍 Analyze Prompt Before Generating'
        )}
      </button>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
          {/* Scores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="text-3xl font-bold text-blue-600">
                {analysis.scores.clarity}
              </div>
              <div className="text-xs text-gray-600 mt-1 font-medium">Clarity</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className={`text-3xl font-bold ${
                analysis.scores.failureRisk > 30 ? 'text-red-600' : 
                analysis.scores.failureRisk > 15 ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {analysis.scores.failureRisk}%
              </div>
              <div className="text-xs text-gray-600 mt-1 font-medium">Block Risk</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="text-3xl font-bold text-purple-600">
                {analysis.ratios.sfwRatio.toFixed(0)}
              </div>
              <div className="text-xs text-gray-600 mt-1 font-medium">SFW Ratio</div>
            </div>
          </div>

          {/* Issues */}
          {analysis.issues.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="font-semibold text-sm mb-2 text-yellow-800">
                ⚠️ Potential Issues:
              </div>
              <ul className="text-sm space-y-1 text-yellow-700">
                {analysis.issues.map((issue, i) => (
                  <li key={i}>• {issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.addTokens.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="font-semibold text-sm mb-2 text-green-800">
                ✅ Add These for Safety:
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.suggestions.addTokens.map((token, i) => (
                  <span 
                    key={i} 
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alternative Prompts */}
          <div className="space-y-2">
            <div className="font-semibold text-sm text-gray-700">
              💡 Alternative Prompts:
            </div>
            {analysis.rewrites.map((rewrite, i) => (
              <div key={i} className="p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-blue-600 uppercase tracking-wide">
                    {rewrite.style}
                  </span>
                  {onUsePrompt && (
                    <button 
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                      onClick={() => onUsePrompt(rewrite.text)}
                    >
                      Use This
                    </button>
                  )}
                </div>
                <div className="text-sm mb-2 text-gray-800 font-medium">{rewrite.text}</div>
                <div className="text-xs text-gray-500">{rewrite.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
