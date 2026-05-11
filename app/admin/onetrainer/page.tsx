"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeft, Play, Square, Loader2, CheckCircle, AlertCircle,
  Plus, Trash2, FolderOpen, ChevronDown, RefreshCw, Cpu,
  Circle, Zap, Terminal, Settings2, BookOpen, X
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Preset {
  filename: string
  name:     string
  config:   Record<string, unknown>
}

interface Concept {
  id:            string
  name:          string
  path:          string
  repeats:       number
  prompt_source: 'sample' | 'filename' | 'concept'
  prompt_path:   string   // used when prompt_source === 'concept'
}

interface TrainStatus {
  status:     'idle' | 'running' | 'done' | 'error' | 'cancelled'
  pid:        number | null
  logs:       string[]
  returncode: number | null
  started_at: number | null
  run_name:   string | null
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getPass(): string {
  try { return sessionStorage.getItem('admin-password') || '' } catch { return '' }
}
function ah(): Record<string, string> {
  const p = getPass(); return p ? { 'x-admin-password': p } : {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }

function emptyConcept(): Concept {
  return { id: uid(), name: 'concept', path: '', repeats: 1, prompt_source: 'sample', prompt_path: '' }
}

function statusColor(s: TrainStatus['status']) {
  return { idle: 'text-slate-500', running: 'text-emerald-400', done: 'text-emerald-400', error: 'text-red-400', cancelled: 'text-amber-400' }[s]
}
function statusLabel(s: TrainStatus['status']) {
  return { idle: 'Idle', running: 'Training…', done: 'Done', error: 'Error', cancelled: 'Cancelled' }[s]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OneTrainerPage() {
  // Server
  const [serverRunning, setServerRunning] = useState(false)
  const [serverLoading, setServerLoading] = useState(false)

  // Presets
  const [presets, setPresets]           = useState<Preset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)

  // Overrides
  const [runName,    setRunName]    = useState('My Training Run')
  const [lr,         setLr]         = useState('')
  const [batchSize,  setBatchSize]  = useState('')
  const [maxSteps,   setMaxSteps]   = useState('')
  const [resolution, setResolution] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [loraRank,   setLoraRank]   = useState('')

  // Concepts
  const [concepts, setConcepts] = useState<Concept[]>([emptyConcept()])

  // Training status
  const [trainStatus, setTrainStatus] = useState<TrainStatus>({
    status: 'idle', pid: null, logs: [], returncode: null, started_at: null, run_name: null,
  })
  const [launching, setLaunching] = useState(false)
  const [tab, setTab]             = useState<'config' | 'monitor'>('config')

  const logEndRef = useRef<HTMLDivElement>(null)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Server status ──────────────────────────────────────────────────────────

  const checkServer = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/onetrainer/server', { headers: ah() })
      if (res.ok) setServerRunning((await res.json()).running)
    } catch {}
  }, [])

  useEffect(() => {
    checkServer()
    const t = setInterval(checkServer, 5000)
    return () => clearInterval(t)
  }, [checkServer])

  async function toggleServer() {
    setServerLoading(true)
    try {
      if (serverRunning) {
        await fetch('/api/admin/onetrainer/server', { method: 'DELETE', headers: ah() })
        setServerRunning(false)
      } else {
        const res = await fetch('/api/admin/onetrainer/server', { method: 'POST', headers: ah() })
        const j   = await res.json()
        setServerRunning(j.started ?? false)
        if (j.started) loadPresets()
      }
    } finally { setServerLoading(false) }
  }

  // ── Presets ────────────────────────────────────────────────────────────────

  const loadPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/onetrainer/presets', { headers: ah() })
      if (res.ok) setPresets(await res.json())
    } catch {}
  }, [])

  useEffect(() => { if (serverRunning) loadPresets() }, [serverRunning, loadPresets])

  function selectPreset(p: Preset) {
    setSelectedPreset(p)
    // Pre-fill overrides from preset values
    setLr(String(p.config.learning_rate ?? ''))
    setBatchSize(String(p.config.batch_size ?? ''))
    setResolution(String(p.config.resolution ?? ''))
    setOutputPath(String(p.config.output_model_destination ?? ''))
    setLoraRank('')
    setMaxSteps('')
  }

  // ── Training status poll ───────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/onetrainer/status', { headers: ah() })
      if (res.ok) {
        const s: TrainStatus = await res.json()
        setTrainStatus(s)
        if (s.status !== 'running') stopPoll()
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startPoll() {
    if (pollRef.current) return
    pollRef.current = setInterval(fetchStatus, 2000)
  }

  function stopPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => {
    if (trainStatus.status === 'running') { startPoll(); setTab('monitor') }
    return stopPoll
  }, [trainStatus.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll log
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [trainStatus.logs])

  // ── Start training ─────────────────────────────────────────────────────────

  async function startTraining() {
    if (!selectedPreset) return
    setLaunching(true)
    try {
      // Build config: start from preset, apply overrides
      const config: Record<string, unknown> = { ...selectedPreset.config }
      if (lr)          config.learning_rate             = parseFloat(lr)
      if (batchSize)   config.batch_size                = parseInt(batchSize)
      if (maxSteps)    config.max_steps                 = parseInt(maxSteps)
      if (resolution)  config.resolution                = resolution
      if (outputPath)  config.output_model_destination  = outputPath
      if (loraRank)    config.lora_rank                 = parseInt(loraRank)
      config.output_model_format = config.output_model_format ?? 'SAFETENSORS'

      // Build concepts
      const conceptPayload = concepts
        .filter(c => c.path.trim())
        .map(c => ({
          name:    c.name,
          path:    c.path.trim(),
          repeats: c.repeats,
          text: {
            prompt_source: c.prompt_source,
            prompt_path:   c.prompt_path || '',
          },
        }))

      const res = await fetch('/api/admin/onetrainer/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ah() },
        body: JSON.stringify({ name: runName, config, concepts: conceptPayload }),
      })

      if (res.ok) {
        await fetchStatus()
        setTab('monitor')
        startPoll()
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? `Error ${res.status}`)
      }
    } finally { setLaunching(false) }
  }

  async function cancelTraining() {
    await fetch('/api/admin/onetrainer/cancel', { method: 'POST', headers: ah() })
    await fetchStatus()
  }

  // ── Concept helpers ────────────────────────────────────────────────────────

  function updateConcept(id: string, patch: Partial<Concept>) {
    setConcepts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isTraining = trainStatus.status === 'running'
  const canTrain   = serverRunning && selectedPreset && concepts.some(c => c.path.trim()) && !isTraining

  return (
    <div className="min-h-screen bg-[#09090f] text-white">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#09090f]/90 backdrop-blur border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <button onClick={() => window.location.href = '/admin'}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">OneTrainer</h1>
          <p className="text-[11px] text-slate-600">Local fine-tuning via OneTrainer</p>
        </div>

        {/* Server status pill */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${
            serverRunning
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-white/[0.08] bg-white/[0.03] text-slate-500'
          }`}>
            <Circle size={6} className={serverRunning ? 'fill-emerald-400 text-emerald-400' : 'fill-slate-600 text-slate-600'} />
            {serverRunning ? 'Server online' : 'Server offline'}
          </div>
          <button onClick={toggleServer} disabled={serverLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
              serverRunning
                ? 'border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
            }`}>
            {serverLoading
              ? <Loader2 size={11} className="animate-spin" />
              : serverRunning ? <Square size={11} /> : <Zap size={11} />}
            {serverLoading ? 'Starting…' : serverRunning ? 'Stop Server' : 'Start Server'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] px-4">
        <div className="flex">
          {([['config', 'Configuration', Settings2], ['monitor', 'Monitor', Terminal]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === id ? 'border-violet-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}>
              <Icon size={12} /> {label}
              {id === 'monitor' && isTraining && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Configuration tab ── */}
        {tab === 'config' && (
          <>
            {/* Preset picker */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">1 · Base Preset</p>
                {serverRunning && (
                  <button onClick={loadPresets} className="p-1 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors">
                    <RefreshCw size={11} />
                  </button>
                )}
              </div>

              {!serverRunning ? (
                <p className="text-xs text-slate-600">Start the server to load presets.</p>
              ) : presets.length === 0 ? (
                <p className="text-xs text-slate-600">No presets found — check your OneTrainer installation.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {presets.map(p => (
                    <button key={p.filename} onClick={() => selectPreset(p)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-[11px] transition-all ${
                        selectedPreset?.filename === p.filename
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
                      }`}>
                      <p className="font-medium text-white truncate">{p.name}</p>
                      <p className="text-slate-600 mt-0.5 truncate">{String(p.config.model_type ?? '')} · {String(p.config.training_method ?? '')}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Overrides */}
            {selectedPreset && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5 space-y-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">2 · Run Settings</p>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">Run name</label>
                  <input value={runName} onChange={e => setRunName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40" />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    ['Learning Rate',  lr,         setLr,         'e.g. 0.0001',  'number'],
                    ['Batch Size',     batchSize,  setBatchSize,  'e.g. 2',       'number'],
                    ['Max Steps',      maxSteps,   setMaxSteps,   'e.g. 1000',    'number'],
                    ['Resolution',     resolution, setResolution, 'e.g. 768',     'text'  ],
                    ['LoRA Rank',      loraRank,   setLoraRank,   'e.g. 16',      'number'],
                    ['Output Path',    outputPath, setOutputPath, 'path/lora.safetensors', 'text'],
                  ].map(([label, val, setter, ph, type]) => (
                    <div key={label as string} className="space-y-1.5">
                      <label className="text-[10px] text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1">
                        {label as string}
                        <span className="text-slate-700 normal-case font-sans">
                          {val ? '' : `(preset: ${selectedPreset.config[
                            ({ 'Learning Rate': 'learning_rate', 'Batch Size': 'batch_size',
                               'Resolution': 'resolution', 'Output Path': 'output_model_destination' } as Record<string, string>)[label as string] ?? ''
                          ] ?? '—'})`}
                        </span>
                      </label>
                      <input
                        type={type as string}
                        value={val as string}
                        onChange={e => (setter as (v: string) => void)(e.target.value)}
                        placeholder={ph as string}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concepts */}
            {selectedPreset && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">3 · Training Concepts</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Each concept is a folder of images. Use Dataset Prep to export a bucket first.</p>
                  </div>
                  <button onClick={() => setConcepts(p => [...p, emptyConcept()])}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white text-[11px] transition-all">
                    <Plus size={11} /> Add concept
                  </button>
                </div>

                <div className="space-y-3">
                  {concepts.map((c, i) => (
                    <div key={c.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 font-mono shrink-0">#{i + 1}</span>
                        <input value={c.name} onChange={e => updateConcept(c.id, { name: e.target.value })}
                          placeholder="Concept name"
                          className="flex-1 bg-transparent text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none" />
                        {concepts.length > 1 && (
                          <button onClick={() => setConcepts(p => p.filter(x => x.id !== c.id))}
                            className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Image folder */}
                        <div className="space-y-1 col-span-2">
                          <label className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Image folder path</label>
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus-within:border-violet-500/30 transition-colors">
                            <FolderOpen size={11} className="text-slate-600 shrink-0" />
                            <input value={c.path} onChange={e => updateConcept(c.id, { path: e.target.value })}
                              placeholder="C:\Training\datasets\my-dataset\images"
                              className="flex-1 bg-transparent text-[11px] text-white placeholder:text-slate-700 focus:outline-none font-mono" />
                          </div>
                        </div>

                        {/* Caption source */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Caption source</label>
                          <div className="relative">
                            <select value={c.prompt_source} onChange={e => updateConcept(c.id, { prompt_source: e.target.value as Concept['prompt_source'] })}
                              className="w-full appearance-none border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-violet-500/40 pr-6"
                              style={{ backgroundColor: '#131320', color: '#cbd5e1' }}>
                              <option value="sample"   style={{ backgroundColor: '#131320', color: '#cbd5e1' }}>txt files (same name as image)</option>
                              <option value="filename" style={{ backgroundColor: '#131320', color: '#cbd5e1' }}>Image filename as prompt</option>
                              <option value="concept"  style={{ backgroundColor: '#131320', color: '#cbd5e1' }}>Single prompt file</option>
                            </select>
                            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                          </div>
                        </div>

                        {/* Repeats */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Repeats</label>
                          <input type="number" min="0.1" step="0.1" value={c.repeats}
                            onChange={e => updateConcept(c.id, { repeats: parseFloat(e.target.value) || 1 })}
                            className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white focus:outline-none focus:border-violet-500/40" />
                        </div>

                        {/* Prompt path (only for concept mode) */}
                        {c.prompt_source === 'concept' && (
                          <div className="space-y-1 col-span-2">
                            <label className="text-[9px] text-slate-600 uppercase tracking-wider font-mono">Prompt file path</label>
                            <input value={c.prompt_path} onChange={e => updateConcept(c.id, { prompt_path: e.target.value })}
                              placeholder="C:\Training\prompts.txt"
                              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40 font-mono" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Start button */}
            {selectedPreset && (
              <button onClick={startTraining} disabled={!canTrain || launching}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {launching ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {launching ? 'Launching…' : isTraining ? 'Training in progress…' : 'Start Training'}
              </button>
            )}
          </>
        )}

        {/* ── Monitor tab ── */}
        {tab === 'monitor' && (
          <div className="space-y-4">

            {/* Status header */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f1a] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 text-sm font-semibold ${statusColor(trainStatus.status)}`}>
                    {trainStatus.status === 'running'  && <Loader2 size={14} className="animate-spin" />}
                    {trainStatus.status === 'done'     && <CheckCircle size={14} />}
                    {trainStatus.status === 'error'    && <AlertCircle size={14} />}
                    {trainStatus.status === 'idle'     && <Cpu size={14} />}
                    {trainStatus.status === 'cancelled' && <X size={14} />}
                    {statusLabel(trainStatus.status)}
                  </div>
                  {trainStatus.run_name && <span className="text-xs text-slate-500">{trainStatus.run_name}</span>}
                  {trainStatus.pid && <span className="text-[10px] text-slate-700 font-mono">PID {trainStatus.pid}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={fetchStatus} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors">
                    <RefreshCw size={11} />
                  </button>
                  {isTraining && (
                    <button onClick={cancelTraining}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/15 transition-all">
                      <Square size={10} /> Cancel
                    </button>
                  )}
                </div>
              </div>

              {trainStatus.started_at && (
                <p className="text-[10px] text-slate-600 mt-2">
                  Started {new Date(trainStatus.started_at * 1000).toLocaleTimeString()}
                  {trainStatus.status !== 'running' && trainStatus.returncode !== null && ` · Exit code ${trainStatus.returncode}`}
                </p>
              )}
            </div>

            {/* Log terminal */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#07070e] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Terminal size={10} /> Training Log
                </p>
                <span className="text-[10px] text-slate-700">{trainStatus.logs.length} lines</span>
              </div>

              {trainStatus.logs.length === 0 ? (
                <p className="text-xs text-slate-700 font-mono text-center py-8">No logs yet — start a training run.</p>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto space-y-0.5 font-mono text-[11px]">
                  {trainStatus.logs.map((line, i) => {
                    const isErr  = /error|exception|traceback/i.test(line)
                    const isWarn = /warn|warning/i.test(line)
                    const isStep = /step|epoch|loss/i.test(line)
                    return (
                      <p key={i} className={
                        isErr  ? 'text-red-400' :
                        isWarn ? 'text-amber-400' :
                        isStep ? 'text-emerald-400' :
                        line.startsWith('[server]') ? 'text-violet-400' :
                        'text-slate-400'
                      }>{line}</p>
                    )
                  })}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>

            {/* Quick link to config */}
            {!isTraining && (
              <button onClick={() => setTab('config')}
                className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors">
                <Settings2 size={11} /> Configure a new run
              </button>
            )}
          </div>
        )}

        {/* Offline notice */}
        {!serverRunning && tab === 'config' && (
          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 flex items-start gap-3">
            <BookOpen size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-600 space-y-1">
              <p className="font-medium text-amber-400">Server is offline</p>
              <p>Click <strong>Start Server</strong> at the top right. It launches the local OneTrainer process — no files are opened on your desktop.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
