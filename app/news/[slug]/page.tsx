"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Info, AlertTriangle, CheckCircle, Sparkles, Calendar, Loader2, BookOpen } from "lucide-react"
import { useParams } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { id: string; type: 'heading'; level: 1 | 2 | 3; text: string }
  | { id: string; type: 'text'; content: string; align?: 'left' | 'center' | 'right' }
  | { id: string; type: 'image'; url: string; alt?: string; caption?: string; size?: 'full' | 'half' | 'small' }
  | { id: string; type: 'video'; url: string; caption?: string; size?: 'full' | 'half' | 'small' }
  | { id: string; type: 'callout'; content: string; style?: 'info' | 'warning' | 'success' | 'update' }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; size?: 'sm' | 'md' | 'lg' }

interface Article {
  id: number
  title: string
  slug: string
  type: string
  summary: string
  previewImage: string | null
  content: ContentBlock[]
  createdAt: string
  publishedAt: string | null
}

// ─── Type Config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  info:     { label: 'Info',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    Icon: Info         },
  warning:  { label: 'Warning',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   Icon: AlertTriangle },
  success:  { label: 'Update',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', Icon: CheckCircle   },
  update:   { label: 'Patch',    color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', Icon: Sparkles      },
  tutorial: { label: 'Tutorial', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  Icon: BookOpen      },
} as const

// ─── Link parser ──────────────────────────────────────────────────────────────

function parseLinks(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (match) {
      return (
        <a
          key={i}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold hover:opacity-80 transition-opacity"
        >
          {match[1]}
        </a>
      )
    }
    return part
  })
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? 'text-3xl font-bold' : block.level === 2 ? 'text-2xl font-semibold' : 'text-xl font-medium'
      return <h2 className={`text-white ${size} leading-snug`}>{block.text}</h2>
    }
    case 'text':
      return (
        <p className={`text-slate-300 leading-relaxed text-${block.align ?? 'left'}`}>
          {parseLinks(block.content)}
        </p>
      )
    case 'image':
      return (
        <div className={
          block.size === 'half' ? 'max-w-sm mx-auto' :
          block.size === 'small' ? 'max-w-[220px]' : 'w-full'
        }>
          {block.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.url}
              alt={block.alt || ''}
              className="w-full rounded-2xl border border-white/10"
            />
          )}
          {block.caption && (
            <p className="text-xs text-slate-500 text-center mt-2">{block.caption}</p>
          )}
        </div>
      )
    case 'video':
      return (
        <div className={
          block.size === 'half' ? 'max-w-sm mx-auto' :
          block.size === 'small' ? 'max-w-[320px]' : 'w-full'
        }>
          {block.url && (
            <video
              src={block.url}
              controls
              playsInline
              className="w-full rounded-2xl border border-white/10"
            />
          )}
          {block.caption && (
            <p className="text-xs text-slate-500 text-center mt-2">{block.caption}</p>
          )}
        </div>
      )
    case 'callout': {
      const CALLOUT_STYLES = {
        info:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-200',    icon: <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />         },
        warning: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-200',   icon: <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" /> },
        success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-200', icon: <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" /> },
        update:  { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-200', icon: <Sparkles size={16} className="text-fuchsia-400 shrink-0 mt-0.5" />   },
      }
      const s = CALLOUT_STYLES[block.style ?? 'info']
      return (
        <div className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${s.bg} ${s.border}`}>
          {s.icon}
          <p className={`text-sm leading-relaxed ${s.text}`}>{parseLinks(block.content)}</p>
        </div>
      )
    }
    case 'divider':
      return <hr className="border-white/[0.08]" />
    case 'spacer':
      return <div className={block.size === 'sm' ? 'h-4' : block.size === 'lg' ? 'h-16' : 'h-8'} />
    default:
      return null
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewsArticlePage() {
  const params = useParams()
  const slug = params?.slug as string

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/news/${slug}`)
        if (res.ok) {
          setArticle(await res.json())
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function formatDate(str: string | null) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
        <Loader2 size={20} className="text-slate-600 animate-spin" />
      </div>
    )
  }

  // Not found
  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-4xl font-black text-white/10 mb-4">404</p>
          <h1 className="text-xl font-bold text-white mb-2">Article Not Found</h1>
          <p className="text-slate-500 text-sm mb-6">This article may have been removed or is not published.</p>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft size={14} />
            Go back
          </button>
        </div>
      </div>
    )
  }

  const cfg = TYPE_CONFIG[article.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.update
  const TypeIcon = cfg.Icon
  const blocks: ContentBlock[] = Array.isArray(article.content) ? article.content : []

  return (
    <div className="min-h-screen bg-[#09090f] relative">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-fuchsia-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-[500px] h-[200px] bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Grid bg */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-10">

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm mb-8 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        {/* Hero image */}
        {article.previewImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.previewImage}
            alt=""
            className="w-full h-52 object-cover rounded-2xl border border-white/10 mb-8"
          />
        )}

        {/* Type badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <TypeIcon size={11} />
            {cfg.label}
          </div>
          {(article.publishedAt || article.createdAt) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar size={11} />
              {formatDate(article.publishedAt || article.createdAt)}
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white leading-snug mb-3">{article.title}</h1>

        {/* Summary */}
        {article.summary && (
          <p className="text-slate-400 text-base leading-relaxed mb-8 pb-8 border-b border-white/[0.07]">
            {article.summary}
          </p>
        )}

        {/* Content blocks */}
        <div className="space-y-6">
          {blocks.length === 0 ? (
            <p className="text-slate-600 italic text-center py-8">No content</p>
          ) : (
            blocks.map((block, i) => <RenderBlock key={block.id || i} block={block} />)
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
          <p className="text-[11px] text-slate-700">Prompt Protocol</p>
        </div>
      </div>
    </div>
  )
}
