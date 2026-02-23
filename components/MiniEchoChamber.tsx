"use client"

import { useState } from "react"
import { MessageSquare, Send, X } from "lucide-react"

export function MiniEchoChamber() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          visibleName: false,
          images: []
        })
      })

      if (response.ok) {
        setMessage("")
        setSubmitted(true)
        setTimeout(() => {
          setSubmitted(false)
          setIsExpanded(false)
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Collapsed state - just a button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full p-3 rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm hover:border-cyan-500/30 hover:bg-slate-900/70 transition-all group"
      >
        <div className="flex items-center justify-center gap-2 text-slate-400 group-hover:text-cyan-400 transition-colors">
          <MessageSquare size={16} />
          <span className="text-sm font-medium">Send Feedback or Request</span>
        </div>
      </button>
    )
  }

  // Expanded state - input form
  return (
    <div className="w-full p-4 rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-cyan-400" />
          <span className="text-sm font-mono text-cyan-400">feedback.exe</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Success message */}
      {submitted ? (
        <div className="text-center py-4">
          <p className="text-cyan-400 font-medium">Thanks for your feedback!</p>
        </div>
      ) : (
        <>
          {/* Input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share feedback, report bugs, or request features..."
            className="w-full h-20 p-3 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none mb-3"
            disabled={isSubmitting}
          />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            {isSubmitting ? (
              "Sending..."
            ) : (
              <>
                <Send size={14} />
                Send Feedback
              </>
            )}
          </button>

          <p className="text-[10px] text-slate-500 text-center mt-2">
            Your feedback helps improve the site
          </p>
        </>
      )}
    </div>
  )
}
