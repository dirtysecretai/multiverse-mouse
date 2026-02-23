"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Terminal, RefreshCw, MessageSquare, Activity, Clock, ArrowLeft, Bug, Lightbulb, CheckCircle, Eye, Trash2
} from "lucide-react"

interface Feedback {
  id: number
  userId: number | null
  userEmail: string
  type: string
  subject: string
  message: string
  status: string
  adminNotes: string | null
  createdAt: string
  user?: {
    id: number
    email: string
    name: string | null
  }
}

interface EchoMessage {
  id: number
  message: string
  visibleName: boolean
  name?: string
  imageUrls?: string[]
  createdAt: string
}

export default function AdminFeedbackPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [activeTab, setActiveTab] = useState<'feedback' | 'echo'>('feedback')

  const fetchData = useCallback(async (pwd: string) => {
    setIsLoading(true)
    try {
      // Fetch feedback
      const feedbackRes = await fetch(`/api/feedback?password=${pwd}`)
      if (feedbackRes.ok) {
        const feedbackData = await feedbackRes.json()
        setFeedbacks(feedbackData)
      }

      // Fetch echo messages
      const echoRes = await fetch('/api/echo')
      if (echoRes.ok) {
        const echoData = await echoRes.json()
        setEchoMessages(Array.isArray(echoData) ? echoData : [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")

    if (authStatus === "true" && savedPassword) {
      setAdminPassword(savedPassword)
      setIsAuthenticated(true)
      fetchData(savedPassword)

      // Auto-refresh every 30 seconds
      const interval = setInterval(() => fetchData(savedPassword), 30000)
      return () => clearInterval(interval)
    } else {
      localStorage.removeItem("multiverse-admin-auth")
    }
  }, [fetchData])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        setAdminPassword(password)
        sessionStorage.setItem("admin-password", password)
        setIsAuthenticated(true)
        localStorage.setItem("multiverse-admin-auth", "true")
        fetchData(password)
      } else {
        alert("Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("Authentication failed")
    }
  }

  const updateFeedbackStatus = async (id: number, status: string) => {
    try {
      await fetch('/api/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          id,
          status,
          adminNotes: adminNotes || null,
        })
      })
      fetchData(adminPassword)
      setSelectedFeedback(null)
      setAdminNotes("")
    } catch (error) {
      alert('Failed to update feedback')
    }
  }

  const deleteFeedback = async (id: number) => {
    if (!confirm('Delete this feedback?')) return

    try {
      await fetch(`/api/feedback?password=${adminPassword}&id=${id}`, {
        method: 'DELETE'
      })
      fetchData(adminPassword)
    } catch (error) {
      alert('Failed to delete feedback')
    }
  }

  const deleteEchoMessage = async (id: number) => {
    if (!confirm('Delete this message?')) return

    try {
      await fetch('/api/echo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: id })
      })
      fetchData(adminPassword)
    } catch (error) {
      alert('Failed to delete message')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug size={16} className="text-red-400" />
      case 'request': return <Lightbulb size={16} className="text-cyan-400" />
      default: return <MessageSquare size={16} className="text-fuchsia-400" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bug': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'request': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
      default: return 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500/20 text-green-400'
      case 'reviewed': return 'bg-yellow-500/20 text-yellow-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center mb-8">
            <Terminal className="mx-auto text-cyan-400 mb-4" size={48} />
            <h1 className="text-2xl font-black text-cyan-400">ADMIN_ACCESS</h1>
            <p className="text-sm text-slate-500 mt-2">Feedback & Requests</p>
          </div>
          <form onSubmit={handleLogin}>
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white mb-4"
            />
            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
              AUTHENTICATE
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-500 flex items-center gap-3">
              <MessageSquare size={32} /> FEEDBACK_MANAGER
            </h1>
            <p className="text-slate-500 text-sm mt-1">User feedback, requests & echo messages</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/admin'}
              className="bg-slate-700 hover:bg-slate-600 text-white"
            >
              <ArrowLeft size={16} className="mr-2" /> Back to Admin
            </Button>
            <Button
              onClick={() => fetchData(adminPassword)}
              disabled={isLoading}
              className="bg-cyan-500 hover:bg-cyan-400 text-black"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'feedback'
                ? 'bg-fuchsia-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <MessageSquare size={16} className="inline mr-2" />
            Feedback & Requests ({feedbacks.length})
          </button>
          <button
            onClick={() => setActiveTab('echo')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'echo'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Activity size={16} className="inline mr-2" />
            Echo Stream ({echoMessages.length})
          </button>
        </div>

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {feedbacks.length === 0 ? (
              <div className="p-12 rounded-xl border border-slate-800 bg-slate-900/60 text-center">
                <MessageSquare size={48} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500">No feedback submissions yet</p>
              </div>
            ) : (
              feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-fuchsia-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getTypeIcon(feedback.type)}
                        <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(feedback.type)}`}>
                          {feedback.type.toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(feedback.status)}`}>
                          {feedback.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(feedback.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{feedback.subject}</h3>
                      <p className="text-sm text-slate-400 mb-3">{feedback.message}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>From: <span className="text-cyan-400">{feedback.userEmail}</span></span>
                        {feedback.adminNotes && (
                          <span className="text-yellow-400">Notes: {feedback.adminNotes}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setSelectedFeedback(feedback)
                          setAdminNotes(feedback.adminNotes || '')
                        }}
                        size="sm"
                        className="bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        onClick={() => deleteFeedback(feedback.id)}
                        size="sm"
                        className="bg-red-600 hover:bg-red-500 text-white"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Echo Stream Tab */}
        {activeTab === 'echo' && (
          <div className="space-y-4">
            {echoMessages.length === 0 ? (
              <div className="p-12 rounded-xl border border-slate-800 bg-slate-900/60 text-center">
                <Activity size={48} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500">No echo messages yet</p>
              </div>
            ) : (
              echoMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-cyan-500/30 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-cyan-400 font-bold">{msg.name || "ANONYMOUS"}</span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock size={10} /> {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-white mb-3">{msg.message}</p>
                      {msg.imageUrls && Array.isArray(msg.imageUrls) && msg.imageUrls.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {msg.imageUrls.map((url: string, idx: number) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Reference ${idx + 1}`}
                              className="h-24 w-24 object-cover rounded-lg border border-cyan-500/30 hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => deleteEchoMessage(msg.id)}
                      size="sm"
                      className="bg-red-600 hover:bg-red-500 text-white ml-4"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border-2 border-fuchsia-500/30 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getTypeIcon(selectedFeedback.type)}
                <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(selectedFeedback.type)}`}>
                  {selectedFeedback.type.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedFeedback(null)
                  setAdminNotes("")
                }}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{selectedFeedback.subject}</h2>
            <p className="text-slate-400 mb-4">{selectedFeedback.message}</p>

            <div className="text-xs text-slate-500 mb-6">
              <p>From: <span className="text-cyan-400">{selectedFeedback.userEmail}</span></p>
              <p>Submitted: {new Date(selectedFeedback.createdAt).toLocaleString()}</p>
              <p>Current Status: <span className={`${getStatusColor(selectedFeedback.status)} px-2 py-0.5 rounded`}>{selectedFeedback.status}</span></p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-fuchsia-400 mb-2">ADMIN NOTES</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this feedback..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => updateFeedbackStatus(selectedFeedback.id, 'reviewed')}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
              >
                Mark Reviewed
              </Button>
              <Button
                onClick={() => updateFeedbackStatus(selectedFeedback.id, 'resolved')}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold"
              >
                <CheckCircle size={16} className="mr-2" />
                Mark Resolved
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
