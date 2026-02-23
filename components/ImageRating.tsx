'use client';

import { useState } from 'react';

interface Props {
  imageId: number;
  userId: number;
  onRated?: (score: number) => void;
}

export function ImageRating({ imageId, userId, onRated }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRate = async (score: number) => {
    setRating(score);
    setSubmitting(true);

    try {
      const response = await fetch('/api/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedImageId: imageId,
          userId,
          score,
          wasBlocked: false,
          feedbackText: feedback || undefined,
        }),
      });

      if (response.ok) {
        onRated?.(score);
        if (score >= 4) {
          // Show a subtle success message
          setTimeout(() => {
            alert('✨ Thanks! This has been saved to our recipe library.');
          }, 300);
        }
      }
    } catch (error) {
      console.error('Rating failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Rate:</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              disabled={submitting}
              className={`text-2xl transition-all transform hover:scale-110 disabled:opacity-50 ${
                displayRating && star <= displayRating
                  ? 'text-yellow-400'
                  : 'text-gray-300'
              }`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {rating && (
        <div className="space-y-2">
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            {showFeedback ? '▼ Hide feedback' : '▶ Add feedback (optional)'}
          </button>

          {showFeedback && (
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you liked or what could be improved..."
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          )}
        </div>
      )}
    </div>
  );
}
