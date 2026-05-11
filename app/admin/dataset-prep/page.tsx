"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeft, Plus, Trash2, Save, X, ChevronDown, ChevronUp,
  Layers, FileText, Image as ImageIcon, Loader2,
  SkipForward, FolderOpen, Play, Settings,
  GripVertical, Copy, RefreshCw, Info, Square
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportRule {
  id: string
  label: string
  sourceField: string
  outputFolder: string
  filenamePattern: string
  required: boolean
}

interface ExportTemplate {
  id: string
  name: string
  description: string
  createdAt: string
  rules: ExportRule[]
}

interface Bucket {
  id: number
  name: string
  count: number
  folderId: number | null
}

interface BucketCounts {
  total: number
  markedForTraining: number
  hasCaption: number
  hasRefs: number
  blobRefs: number
}

type LogEntry =
  | { type: 'start';     total: number }
  | { type: 'progress';  done: number; total: number }
  | { type: 'file';      path: string }
  | { type: 'skip';      id: number; reason: string }
  | { type: 'warn';      path: string; reason: string }
  | { type: 'done';      exported: number; skipped: number }
  | { type: 'error';     message: string }
  | { type: 'cancelled' }

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_FIELDS = [
  { value: 'imageUrl',              label: 'Output Image',           type: 'image' },
  { value: 'referenceImageUrls[0]', label: 'Reference Image [0]',   type: 'image' },
  { value: 'referenceImageUrls[1]', label: 'Reference Image [1]',   type: 'image' },
  { value: 'referenceImageUrls[2]', label: 'Reference Image [2]',   type: 'image' },
  { value: 'referenceImageUrls[3]', label: 'Reference Image [3]',   type: 'image' },
  { value: 'prompt',                label: 'Prompt Text',           type: 'text'  },
  { value: 'adminCaption',          label: 'Caption',               type: 'text'  },
  { value: 'adminTags',             label: 'Tags (comma-separated)','type': 'text' },
  { value: 'model',                 label: 'Model Name',            type: 'text'  },
  { value: 'quality',               label: 'Quality Setting',       type: 'text'  },
  { value: 'aspectRatio',           label: 'Aspect Ratio',         type: 'text'  },
  { value: 'createdAt',             label: 'Creation Date (ISO)',   type: 'text'  },
  { value: 'id',                    label: 'Generation ID',        type: 'text'  },
]

const PATTERN_VARS = [
  { var: '{n}',       desc: 'Sequential index (1, 2, 3…)' },
  { var: '{n:04}',    desc: 'Zero-padded to 4 digits (0001, 0002…)' },
  { var: '{id}',      desc: 'Database ID of the generation' },
  { var: '{prompt}',  desc: 'Slugified prompt, first 40 chars' },
  { var: '{model}',   desc: 'Model name slug' },
  { var: '{date}',    desc: 'Creation date (YYYY-MM-DD)' },
  { var: '{tags}',    desc: 'Tags joined by underscore' },
  { var: '{aspect}',  desc: 'Aspect ratio e.g. 16x9, 1x1' },
]

const UPLOADS_BUCKET = '__uploads__'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getAdminPassword(): string {
  try { return sessionStorage.getItem('admin-password') || '' } catch { return '' }
}
function authHeaders(): Record<string, string> {
  const p = getAdminPassword()
  return p ? { 'x-admin-password': p } : {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newRuleId() { return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }

function emptyRule(): ExportRule {
  return { id: newRuleId(), label: 'New rule', sourceField: 'imageUrl', outputFolder: '', filenamePattern: '{n}.png', required: true }
}

function cloneTemplate(t: ExportTemplate): ExportTemplate {
  return JSON.parse(JSON.stringify(t))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RuleRow({ rule, onChange, onDelete }: {
  rule: ExportRule
  onChange: (r: ExportRule) => void
  onDelete: () => void
}) {
  const fieldMeta = SOURCE_FIELDS.find(f => f.value === rule.sourceField)

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical size={12} className="text-slate-700 shrink-0" />
        <input
          value={rule.label}
          onChange={e => onChange({ ...rule, label: e.target.value })}
          placeholder="Rule label…"
          className="flex-1 bg-transparent text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer shrink-0">
          <input type="checkbox" checked={rule.required} onChange={e => onChange({ ...rule, required: e.target.checked })}
            className="w-3 h-3 accent-violet-500" />
          required
        </label>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Source field */}
        <div className="space-y-1">
          <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Source field</p>
          <div className="relative">
            <select
              value={rule.sourceField}
              onChange={e => onChange({ ...rule, sourceField: e.target.value })}
              className="w-full appearance-none border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-violet-500/40 pr-6"
              style={{ backgroundColor: '#131320', color: '#cbd5e1' }}
            >
              {SOURCE_FIELDS.map(f => (
                <option key={f.value} value={f.value} style={{ backgroundColor: '#131320', color: '#cbd5e1' }}>{f.label}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          </div>
          <p className="text-[9px] text-slate-700">{fieldMeta?.type === 'image' ? '📷 image file' : '📄 text file'}</p>
        </div>

        {/* Output folder */}
        <div className="space-y-1">
          <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Output subfolder</p>
          <input
            value={rule.outputFolder}
            onChange={e => onChange({ ...rule, outputFolder: e.target.value })}
            placeholder="e.g. low_res (blank = root)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40"
          />
        </div>

        {/* Filename pattern */}
        <div className="space-y-1">
          <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Filename pattern</p>
          <input
            value={rule.filenamePattern}
            onChange={e => onChange({ ...rule, filenamePattern: e.target.value })}
            placeholder="e.g. {n}.png"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40 font-mono"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DatasetPrepPage() {
  const [tab, setTab] = useState<'templates' | 'export'>('templates')

  // Templates state
  const [templates, setTemplates]         = useState<ExportTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null)
  const [isNewTemplate, setIsNewTemplate] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [varsOpen, setVarsOpen]           = useState(false)

  // Export state
  const [buckets, setBuckets]             = useState<Bucket[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [selectedBucketId, setSelectedBucketId]     = useState<number | null>(null)
  const [outputPath, setOutputPath]       = useState('')
  const [filterMarked, setFilterMarked]             = useState(false)
  const [filterCaptioned, setFilterCaptioned]       = useState(false)
  const [filterRefs, setFilterRefs]                 = useState(false)
  const [filterExcludeBlobRefs, setFilterExcludeBlobRefs] = useState(false)
  const [filterModel, setFilterModel]               = useState('')
  const [bucketCounts, setBucketCounts]             = useState<BucketCounts | null>(null)
  const [exporting, setExporting]         = useState(false)
  const [stopping, setStopping]           = useState(false)
  const [exportLog, setExportLog]         = useState<LogEntry[]>([])
  const [exportDone, setExportDone]       = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Load templates
  const loadTemplates = useCallback(async () => {
    const res = await fetch('/api/admin/dataset-prep/templates', { headers: authHeaders() })
    if (res.ok) setTemplates(await res.json())
  }, [])

  // Load buckets
  const loadBuckets = useCallback(async () => {
    const res = await fetch('/api/admin/buckets', { headers: authHeaders() })
    if (res.ok) {
      const all: Bucket[] = await res.json()
      setBuckets(all.filter(b => b.name !== UPLOADS_BUCKET))
    }
  }, [])

  useEffect(() => { loadTemplates(); loadBuckets() }, [loadTemplates, loadBuckets])

  useEffect(() => {
    if (!selectedBucketId) { setBucketCounts(null); return }
    fetch(`/api/admin/dataset-prep/count?bucketId=${selectedBucketId}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setBucketCounts(d))
  }, [selectedBucketId])

  // Scroll log to bottom
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [exportLog])

  // ── Template CRUD ──────────────────────────────────────────────────────────

  function startNewTemplate() {
    setEditingTemplate({
      id: '', name: 'New Template', description: '',
      createdAt: new Date().toISOString(), rules: [emptyRule()],
    })
    setIsNewTemplate(true)
  }

  function startEditTemplate(t: ExportTemplate) {
    setEditingTemplate(cloneTemplate(t))
    setIsNewTemplate(false)
  }

  function cancelEdit() { setEditingTemplate(null) }

  async function saveTemplate() {
    if (!editingTemplate) return
    setSavingTemplate(true)
    try {
      if (isNewTemplate) {
        const res = await fetch('/api/admin/dataset-prep/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(editingTemplate),
        })
        if (res.ok) { await loadTemplates(); setEditingTemplate(null) }
      } else {
        const res = await fetch(`/api/admin/dataset-prep/templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(editingTemplate),
        })
        if (res.ok) { await loadTemplates(); setEditingTemplate(null) }
      }
    } finally { setSavingTemplate(false) }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    await fetch(`/api/admin/dataset-prep/templates/${id}`, { method: 'DELETE', headers: authHeaders() })
    await loadTemplates()
    if (editingTemplate?.id === id) setEditingTemplate(null)
  }

  async function duplicateTemplate(t: ExportTemplate) {
    const clone = cloneTemplate(t)
    clone.name = `${clone.name} (copy)`
    const res = await fetch('/api/admin/dataset-prep/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(clone),
    })
    if (res.ok) await loadTemplates()
  }

  function updateRule(idx: number, rule: ExportRule) {
    if (!editingTemplate) return
    const rules = [...editingTemplate.rules]
    rules[idx] = rule
    setEditingTemplate({ ...editingTemplate, rules })
  }

  function deleteRule(idx: number) {
    if (!editingTemplate) return
    const rules = editingTemplate.rules.filter((_, i) => i !== idx)
    setEditingTemplate({ ...editingTemplate, rules })
  }

  function addRule() {
    if (!editingTemplate) return
    setEditingTemplate({ ...editingTemplate, rules: [...editingTemplate.rules, emptyRule()] })
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  async function runExport() {
    if (!selectedTemplateId || !selectedBucketId || !outputPath.trim()) return
    setExporting(true)
    setExportLog([])
    setExportDone(false)

    try {
      const res = await fetch('/api/admin/dataset-prep/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          bucketId: selectedBucketId,
          outputPath: outputPath.trim(),
          filters: {
            markedOnly: filterMarked || undefined,
            captionedOnly: filterCaptioned || undefined,
            refsOnly: filterRefs || undefined,
            excludeBlobRefs: filterExcludeBlobRefs || undefined,
            model: filterModel || undefined,
          },
        }),
      })

      if (!res.ok || !res.body) {
        setExportLog(l => [...l, { type: 'error', message: `HTTP ${res.status}` }])
        setExportDone(true)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.replace(/^data: /, '').trim()
          if (!line) continue
          try {
            const evt = JSON.parse(line) as LogEntry
            setExportLog(l => [...l, evt])
            if (evt.type === 'done' || evt.type === 'error' || evt.type === 'cancelled') {
              setExportDone(true)
            }
          } catch {}
        }
      }
    } finally {
      setExporting(false)
      setStopping(false)
    }
  }

  async function stopExport() {
    setStopping(true)
    await fetch('/api/admin/dataset-prep/export', {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => {})
  }

  const selectedBucket = buckets.find(b => b.id === selectedBucketId)
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  const exportReady = selectedTemplateId && selectedBucketId && outputPath.trim()

  const doneEvent      = exportLog.find((e): e is Extract<LogEntry, { type: 'done' }>      => e.type === 'done')
  const errorEvent     = exportLog.find((e): e is Extract<LogEntry, { type: 'error' }>     => e.type === 'error')
  const cancelledEvent = exportLog.find((e): e is Extract<LogEntry, { type: 'cancelled' }> => e.type === 'cancelled')
  const progressEvent  = [...exportLog].reverse().find((e): e is Extract<LogEntry, { type: 'progress' }> => e.type === 'progress')
  const startEvent     = exportLog.find((e): e is Extract<LogEntry, { type: 'start' }> => e.type === 'start')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#09090f]/90 backdrop-blur border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <button onClick={() => window.location.href = '/admin'}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-white">Dataset Preparation</h1>
          <p className="text-[11px] text-slate-600">Build export templates and prepare training datasets from your generations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-4">
        <div className="flex gap-0">
          {([['templates', 'Templates', Layers], ['export', 'Export', Play]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Templates tab ── */}
        {tab === 'templates' && (
          <div className="space-y-6">

            {/* Template editor */}
            {editingTemplate ? (
              <div className="rounded-2xl border border-violet-500/20 bg-[#0f0f1a] p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{isNewTemplate ? 'New Template' : 'Edit Template'}</p>
                  <button onClick={cancelEdit} className="p-1 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors">
                    <X size={14} />
                  </button>
                </div>

                {/* Name + description */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">Template name</label>
                    <input value={editingTemplate.name}
                      onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">Description</label>
                    <input value={editingTemplate.description}
                      onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                      placeholder="What is this template for?"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40" />
                  </div>
                </div>

                {/* Rules */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-400">Rules <span className="text-slate-600 font-normal">({editingTemplate.rules.length})</span></p>
                    <button onClick={addRule}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] hover:bg-violet-500/15 transition-all">
                      <Plus size={11} /> Add rule
                    </button>
                  </div>
                  {editingTemplate.rules.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-4">No rules yet — add one above</p>
                  )}
                  {editingTemplate.rules.map((rule, idx) => (
                    <RuleRow key={rule.id} rule={rule}
                      onChange={r => updateRule(idx, r)}
                      onDelete={() => deleteRule(idx)} />
                  ))}
                </div>

                {/* Variables reference */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <button onClick={() => setVarsOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    <span className="flex items-center gap-2"><Info size={11} /> Filename pattern variables</span>
                    {varsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                  {varsOpen && (
                    <div className="px-4 pb-3 grid grid-cols-2 gap-x-6 gap-y-1">
                      {PATTERN_VARS.map(v => (
                        <div key={v.var} className="flex items-center gap-2 py-0.5">
                          <code className="text-[11px] text-violet-400 font-mono bg-violet-500/10 px-1.5 py-0.5 rounded shrink-0">{v.var}</code>
                          <span className="text-[11px] text-slate-500">{v.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={saveTemplate} disabled={savingTemplate || !editingTemplate.name.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 transition-all disabled:opacity-50">
                    {savingTemplate ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    {isNewTemplate ? 'Create template' : 'Save changes'}
                  </button>
                  {!isNewTemplate && (
                    <button onClick={() => deleteTemplate(editingTemplate.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/15 transition-all">
                      <Trash2 size={11} /> Delete
                    </button>
                  )}
                  <button onClick={cancelEdit}
                    className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-xs transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Template list */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-slate-600">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
                  <button onClick={startNewTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs hover:bg-violet-500/20 transition-all">
                    <Plus size={11} /> New template
                  </button>
                </div>

                {templates.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">
                    <Layers size={28} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No templates yet</p>
                    <p className="text-xs mt-1">Create one to define how your dataset is exported</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map(t => (
                      <div key={t.id} className="rounded-xl border border-white/[0.07] bg-[#0f0f1a] p-4 flex flex-col gap-3 hover:border-white/[0.12] transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{t.name}</p>
                          {t.description && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{t.description}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {t.rules.map(r => (
                              <span key={r.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[9px] text-slate-500">
                                {SOURCE_FIELDS.find(f => f.value === r.sourceField)?.type === 'image'
                                  ? <ImageIcon size={8} /> : <FileText size={8} />}
                                {r.outputFolder ? `${r.outputFolder}/` : ''}{r.filenamePattern}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1.5 pt-1 border-t border-white/[0.05]">
                          <button onClick={() => startEditTemplate(t)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white hover:border-white/15 text-[11px] transition-all">
                            <Settings size={10} /> Edit
                          </button>
                          <button onClick={() => duplicateTemplate(t)}
                            className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-[11px] transition-all" title="Duplicate">
                            <Copy size={10} />
                          </button>
                          <button onClick={() => { setSelectedTemplateId(t.id); setTab('export') }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/20 text-[11px] transition-all">
                            <Play size={10} /> Use
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Export tab ── */}
        {tab === 'export' && (
          <div className="space-y-4 max-w-2xl">

            {/* Step 1: Template */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">1 · Template</p>
              {templates.length === 0 ? (
                <p className="text-xs text-slate-600">No templates yet — <button onClick={() => setTab('templates')} className="text-violet-400 hover:text-violet-300 underline">create one</button></p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => setSelectedTemplateId(t.id)}
                      className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                        selectedTemplateId === t.id
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
                      }`}>
                      <p className="text-xs font-medium text-white">{t.name}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{t.rules.length} rule{t.rules.length !== 1 ? 's' : ''}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Show rule preview for selected template */}
              {selectedTemplate && (
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 space-y-1">
                  {selectedTemplate.rules.map(r => {
                    const src = SOURCE_FIELDS.find(f => f.value === r.sourceField)
                    const dest = [r.outputFolder, r.filenamePattern].filter(Boolean).join('/')
                    return (
                      <div key={r.id} className="flex items-center gap-2 text-[10px] text-slate-500">
                        {src?.type === 'image' ? <ImageIcon size={9} className="text-cyan-600 shrink-0" /> : <FileText size={9} className="text-amber-600 shrink-0" />}
                        <span className="text-slate-400">{r.label}</span>
                        <span className="text-slate-700">→</span>
                        <code className="text-slate-500 font-mono">{dest || r.filenamePattern}</code>
                        {r.required && <span className="text-red-600 text-[9px]">required</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Source bucket */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">2 · Source Bucket</p>
              <div className="relative">
                <select value={selectedBucketId ?? ''}
                  onChange={e => setSelectedBucketId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full appearance-none border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500/40 pr-8"
                  style={{ backgroundColor: '#131320', color: '#f1f5f9' }}>
                  <option value="" style={{ backgroundColor: '#131320', color: '#64748b' }}>Select bucket…</option>
                  {buckets.map(b => (
                    <option key={b.id} value={b.id} style={{ backgroundColor: '#131320', color: '#f1f5f9' }}>{b.name} ({b.count} images)</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">Filters</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { val: filterMarked,          setter: setFilterMarked,          label: 'Marked for training',  count: bucketCounts?.markedForTraining },
                    { val: filterCaptioned,        setter: setFilterCaptioned,       label: 'Has caption',          count: bucketCounts?.hasCaption },
                    { val: filterRefs,             setter: setFilterRefs,            label: 'Has reference images', count: bucketCounts?.hasRefs },
                    { val: filterExcludeBlobRefs,  setter: setFilterExcludeBlobRefs, label: 'Exclude broken refs',  count: bucketCounts ? bucketCounts.total - bucketCounts.blobRefs : undefined },
                  ]).map(({ val, setter, label, count }) => (
                    <label key={label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all text-[11px] ${
                      val ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-white/[0.07] bg-white/[0.03] text-slate-500 hover:border-white/15'
                    }`}>
                      <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="w-3 h-3 accent-violet-500" />
                      {label}
                      {count !== undefined && (
                        <span className={val ? 'text-violet-400/60' : 'text-slate-700'}>{count.toLocaleString()}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {selectedBucket && (
                <div className="text-[10px] text-slate-600 space-y-1">
                  <p>
                    {(bucketCounts?.total ?? selectedBucket.count).toLocaleString()} images in{' '}
                    <span className="text-slate-400">{selectedBucket.name}</span>
                  </p>
                  {bucketCounts && (filterMarked || filterCaptioned || filterRefs || filterExcludeBlobRefs) && (
                    <div className="pl-2 border-l border-white/[0.06] space-y-0.5">
                      {filterMarked && (
                        <p><span className="text-red-400/70">−{(bucketCounts.total - bucketCounts.markedForTraining).toLocaleString()}</span> not marked for training</p>
                      )}
                      {filterCaptioned && (
                        <p><span className="text-red-400/70">−{(bucketCounts.total - bucketCounts.hasCaption).toLocaleString()}</span> no caption</p>
                      )}
                      {filterRefs && (
                        <p><span className="text-red-400/70">−{(bucketCounts.total - bucketCounts.hasRefs).toLocaleString()}</span> no reference images</p>
                      )}
                      {filterExcludeBlobRefs && (
                        <p><span className="text-red-400/70">−{bucketCounts.blobRefs.toLocaleString()}</span> broken Vercel Blob references</p>
                      )}
                      <p className="text-slate-700 text-[9px] pt-0.5">Filters are combined — actual export count will be ≤ the smallest individual filter</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Output path */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">3 · Output Folder</p>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus-within:border-violet-500/40 transition-colors">
                <FolderOpen size={13} className="text-slate-600 shrink-0" />
                <input
                  value={outputPath}
                  onChange={e => setOutputPath(e.target.value)}
                  placeholder="C:\Training\datasets\my-dataset"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-700 focus:outline-none font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-700">Full path on your local machine. Subfolders will be created automatically.</p>
            </div>

            {/* Export / Stop buttons */}
            <div className="flex gap-2">
              <button onClick={runExport}
                disabled={!exportReady || exporting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {exporting ? 'Exporting…' : 'Export Dataset'}
              </button>
              {exporting && (
                <button onClick={stopExport} disabled={stopping}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50">
                  {stopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                  Stop
                </button>
              )}
            </div>

            {/* Progress + log */}
            {exportLog.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a12] p-4 space-y-3">
                {/* Progress bar */}
                {startEvent && progressEvent && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{progressEvent.done} / {startEvent.total} images</span>
                      {doneEvent && <span className="text-emerald-400">✓ Done — {doneEvent.exported} exported, {doneEvent.skipped} skipped</span>}
                      {cancelledEvent && <span className="text-amber-400">Stopped</span>}
                      {errorEvent && <span className="text-red-400">Error: {errorEvent.message}</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${doneEvent ? 'bg-emerald-500' : cancelledEvent ? 'bg-amber-500' : errorEvent ? 'bg-red-500' : 'bg-violet-500'}`}
                        style={{ width: `${Math.round((progressEvent.done / startEvent.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Log */}
                <div className="max-h-64 overflow-y-auto space-y-0.5 font-mono text-[10px]">
                  {exportLog.map((entry, i) => {
                    if (entry.type === 'start')     return <p key={i} className="text-slate-600">Starting export of {entry.total} images…</p>
                    if (entry.type === 'file')      return <p key={i} className="text-slate-400"><span className="text-emerald-600">✓</span> {entry.path}</p>
                    if (entry.type === 'skip')      return <p key={i} className="text-slate-600"><SkipForward size={9} className="inline mr-1" />Skipped #{entry.id} — {entry.reason}</p>
                    if (entry.type === 'warn')      return <p key={i} className="text-amber-600">⚠ {entry.path} — {entry.reason}</p>
                    if (entry.type === 'done')      return <p key={i} className="text-emerald-400 font-semibold">Export complete. {entry.exported} exported, {entry.skipped} skipped.</p>
                    if (entry.type === 'cancelled') return <p key={i} className="text-amber-400 font-semibold">Export stopped by user.</p>
                    if (entry.type === 'error')     return <p key={i} className="text-red-400">Error: {entry.message}</p>
                    return null
                  })}
                  <div ref={logEndRef} />
                </div>

                {exportDone && !exporting && (
                  <button onClick={() => { setExportLog([]); setExportDone(false) }}
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
                    <RefreshCw size={10} /> Clear log
                  </button>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
