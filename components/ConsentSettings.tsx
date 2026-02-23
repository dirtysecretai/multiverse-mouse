'use client';

import { useState, useEffect } from 'react';

interface Props {
  userId: number;
}

export function ConsentSettings({ userId }: Props) {
  const [optInTraining, setOptInTraining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/user/consent?userId=${userId}`)
      .then(r => r.json())
      .then(data => {
        setOptInTraining(data.optInTraining || false);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load consent:', err);
        setLoading(false);
      });
  }, [userId]);

  const handleToggle = async () => {
    setSaving(true);
    const newValue = !optInTraining;

    try {
      const response = await fetch('/api/user/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          optInTraining: newValue,
          optInAnalytics: true,
        }),
      });

      if (response.ok) {
        setOptInTraining(newValue);
      }
    } catch (error) {
      console.error('Failed to update consent:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="border p-4 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 p-5 rounded-lg bg-white shadow-sm">
      <h3 className="font-bold text-lg mb-4 text-gray-800">Privacy Settings</h3>
      
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-1">
          <input
            type="checkbox"
            checked={optInTraining}
            onChange={handleToggle}
            disabled={saving}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-blue-500 peer-disabled:opacity-50 transition-colors"></div>
          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
        </div>
        
        <div className="flex-1">
          <div className="font-medium text-gray-800 group-hover:text-gray-900">
            Help Improve AI Design Studio
          </div>
          <div className="text-sm text-gray-600 mt-1 leading-relaxed">
            Allow your prompts to be used for improving our AI models. 
            All personal information (emails, phone numbers, names) is 
            automatically removed before use.
          </div>
        </div>
      </label>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-blue-500 mt-0.5">ℹ️</span>
          <div className="text-xs text-blue-700">
            <strong>Your privacy is protected:</strong> We automatically remove 
            emails, phone numbers, and names from all data. You can change this 
            setting anytime, and you can request complete data deletion.
          </div>
        </div>
      </div>

      {saving && (
        <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Saving...
        </div>
      )}
    </div>
  );
}
