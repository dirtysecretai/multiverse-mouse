"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eye, EyeOff, Sparkles } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.email || !formData.password) {
      setError('Email and password are required')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Success! Redirect to dashboard
        router.push('/dashboard')
      } else {
        setError(data.error || 'Signup failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* Glow effects */}
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="text-cyan-400" size={32} />
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                Multiverse Portal
              </h1>
            </div>
            <p className="text-slate-400 text-sm">Create your account to start generating AI images</p>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4 p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-cyan-400 mb-4">SIGN_UP</h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Name (Optional)</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your name"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                className="bg-slate-950 border-slate-700 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Password *</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="bg-slate-950 border-slate-700 text-white pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Must be 8+ characters with uppercase, lowercase, and number</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Confirm Password *</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="bg-slate-950 border-slate-700 text-white"
                required
              />
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" required className="mt-1" />
              <span>
                I agree to the{' '}
                <Link href="/terms" className="text-cyan-400 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-cyan-400 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" required className="mt-1" />
              <span>I am 18 years or older</span>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold"
            >
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </Button>

            <div className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="text-cyan-400 hover:underline font-bold">
                Login
              </Link>
            </div>
          </form>

          {/* Back to home */}
          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-slate-500 hover:text-cyan-400 transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
