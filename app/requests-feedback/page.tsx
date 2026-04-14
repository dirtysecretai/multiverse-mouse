'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, ArrowLeft, CheckCircle, Bug, Lightbulb, Clock, Inbox } from 'lucide-react';

interface MyFeedback {
  id: number
  type: string
  subject: string
  message: string
  status: string
  adminNotes: string | null
  createdAt: string
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    bug: 'bg-red-500/15 text-red-400 border-red-500/30',
    request: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    feedback: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
  }
  const icons: Record<string, React.ReactNode> = {
    bug: <Bug size={11} />,
    request: <Lightbulb size={11} />,
    feedback: <MessageSquare size={11} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${styles[type] ?? styles.feedback}`}>
      {icons[type] ?? icons.feedback}
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-500/20 text-slate-400',
    reviewed: 'bg-amber-500/20 text-amber-400',
    resolved: 'bg-green-500/20 text-green-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export default function FeedbackPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<'submit' | 'my'>('submit');

  // My submissions state
  const [myFeedbacks, setMyFeedbacks] = useState<MyFeedback[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myLoaded, setMyLoaded] = useState(false);

  const [formData, setFormData] = useState({
    type: 'feedback',
    subject: '',
    message: '',
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/');
          return;
        }

        setUser(data.user);
      } catch (err) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const fetchMyFeedbacks = async () => {
    setMyLoading(true);
    try {
      const res = await fetch('/api/feedback/my');
      const data = await res.json();
      if (data.success) {
        setMyFeedbacks(data.feedbacks);
      }
    } catch {
      // silent
    } finally {
      setMyLoading(false);
      setMyLoaded(true);
    }
  };

  const handleTabChange = (tab: 'submit' | 'my') => {
    setActiveTab(tab);
    if (tab === 'my' && !myLoaded) {
      fetchMyFeedbacks();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.message.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userEmail: user?.email,
          type: formData.type,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
        setFormData({ type: 'feedback', subject: '', message: '' });
        // Invalidate cached submissions so next view is fresh
        setMyLoaded(false);
      } else {
        alert('Failed to submit feedback: ' + data.error);
      }
    } catch (error) {
      alert('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-500 flex items-center gap-3">
              <MessageSquare size={32} /> FEEDBACK & REQUESTS
            </h1>
            <p className="text-slate-500 text-sm mt-1">Share your thoughts, report bugs, or request features</p>
          </div>
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-slate-700 hover:bg-slate-600 text-white"
          >
            <ArrowLeft size={16} className="mr-2" /> Dashboard
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-900/60 border border-slate-800 w-fit">
          <button
            onClick={() => handleTabChange('submit')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'submit'
                ? 'bg-fuchsia-600/80 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Send size={13} className="inline mr-1.5 -mt-0.5" />
            Submit Feedback
          </button>
          <button
            onClick={() => handleTabChange('my')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'my'
                ? 'bg-cyan-600/80 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Inbox size={13} className="inline mr-1.5 -mt-0.5" />
            My Submissions
          </button>
        </div>

        {/* ── SUBMIT TAB ── */}
        {activeTab === 'submit' && (
          <>
            {submitted ? (
              <div className="p-8 rounded-2xl border-2 border-green-500/30 bg-slate-900/80 backdrop-blur-sm text-center">
                <CheckCircle size={64} className="mx-auto text-green-400 mb-4" />
                <h2 className="text-2xl font-bold text-green-400 mb-2">Thank You!</h2>
                <p className="text-slate-400 mb-6">
                  Your feedback has been submitted successfully. We appreciate you taking the time to help us improve!
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => setSubmitted(false)}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                  >
                    Submit Another
                  </Button>
                  <Button
                    onClick={() => handleTabChange('my')}
                    className="bg-cyan-700 hover:bg-cyan-600 text-white"
                  >
                    View My Submissions
                  </Button>
                  <Button
                    onClick={() => router.push('/dashboard')}
                    className="bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl border-2 border-fuchsia-500/30 bg-slate-900/80 backdrop-blur-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Type Selection */}
                  <div>
                    <label className="block text-sm font-bold text-fuchsia-400 mb-3">TYPE</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'feedback' })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === 'feedback'
                            ? 'border-fuchsia-500 bg-fuchsia-500/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <MessageSquare size={24} className={`mx-auto mb-2 ${formData.type === 'feedback' ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                        <span className={`text-sm font-bold ${formData.type === 'feedback' ? 'text-fuchsia-400' : 'text-slate-400'}`}>
                          Feedback
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'request' })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === 'request'
                            ? 'border-cyan-500 bg-cyan-500/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <Lightbulb size={24} className={`mx-auto mb-2 ${formData.type === 'request' ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <span className={`text-sm font-bold ${formData.type === 'request' ? 'text-cyan-400' : 'text-slate-400'}`}>
                          Feature Request
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'bug' })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.type === 'bug'
                            ? 'border-red-500 bg-red-500/20'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <Bug size={24} className={`mx-auto mb-2 ${formData.type === 'bug' ? 'text-red-400' : 'text-slate-500'}`} />
                        <span className={`text-sm font-bold ${formData.type === 'bug' ? 'text-red-400' : 'text-slate-400'}`}>
                          Bug Report
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-bold text-fuchsia-400 mb-2">SUBJECT</label>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Brief summary of your feedback..."
                      required
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-bold text-fuchsia-400 mb-2">MESSAGE</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Describe your feedback, request, or bug in detail..."
                      required
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none resize-none"
                    />
                  </div>

                  {/* User Info */}
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <p className="text-xs text-slate-500">
                      Submitting as: <span className="text-cyan-400 font-medium">{user?.email}</span>
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white font-bold h-12"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={18} className="mr-2" />
                        Submit Feedback
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* Info Card */}
            <div className="mt-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-cyan-400 mb-2">What happens next?</h3>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>Your feedback will be reviewed by our team</li>
                <li>Bug reports are prioritized for quick fixes</li>
                <li>Feature requests help shape our roadmap</li>
                <li>We read every submission - thank you for your input!</li>
              </ul>
            </div>
          </>
        )}

        {/* ── MY SUBMISSIONS TAB ── */}
        {activeTab === 'my' && (
          <div>
            {myLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm">Loading your submissions…</p>
              </div>
            ) : myFeedbacks.length === 0 ? (
              <div className="p-12 rounded-2xl border border-slate-800 bg-slate-900/50 text-center">
                <Inbox size={48} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-400 font-medium mb-1">No submissions yet</p>
                <p className="text-sm text-slate-500">Your submitted feedback and requests will appear here.</p>
                <Button
                  onClick={() => setActiveTab('submit')}
                  className="mt-5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm"
                >
                  Submit your first feedback
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myFeedbacks.map(fb => (
                  <div
                    key={fb.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <TypeBadge type={fb.type} />
                      <StatusBadge status={fb.status} />
                      <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
                        <Clock size={11} />
                        {formatDate(fb.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white mb-1">{fb.subject}</h3>

                    <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{fb.message}</p>

                    {fb.adminNotes && (
                      <div className="mt-3 px-3 py-2.5 rounded-lg bg-fuchsia-900/20 border border-fuchsia-500/25">
                        <p className="text-xs font-semibold text-fuchsia-400 mb-1">Response from the team:</p>
                        <p className="text-sm text-fuchsia-200/80 leading-relaxed">{fb.adminNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
