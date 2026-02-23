'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Play, Upload, X, ArrowLeft, Ticket, Download, Copy, AlertTriangle, Film, Clock, FlaskConical } from 'lucide-react';
import Link from 'next/link';

interface GeneratedVideo {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl: string;
  model: string;
  duration: string;
  resolution: '480p' | '720p' | '1080p';
  timestamp: number;
  loading?: boolean;
}

export default function VideoScannerKlingO3Prototype() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketBalance, setTicketBalance] = useState<number>(0);
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false);

  // Scanner state
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<string>('5');
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('1080p');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');

  // UI state
  const [generationQueue, setGenerationQueue] = useState(0);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [videoModel, setVideoModel] = useState<'wan-2.5' | 'kling-o3' | 'kling-v3'>('kling-o3');
  const [generateAudio, setGenerateAudio] = useState(false);
  const [klingAspectRatio, setKlingAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [endImageFile, setEndImageFile] = useState<File | null>(null);
  const [endImagePreviewUrl, setEndImagePreviewUrl] = useState<string>('');

  const MAX_QUEUE_SIZE = 3;
  const MAX_FEED_SIZE = 50;

  const getTicketCost = () => {
    if (videoModel === 'kling-o3') {
      const klingO3Pricing: Record<string, number> = {
        '3': 15, '4': 18, '5': 20, '6': 24, '7': 28,
        '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
        '13': 52, '14': 56, '15': 60,
      };
      return klingO3Pricing[duration] || 20;
    }
    if (videoModel === 'kling-v3') {
      const ratePerSec = hasPromptStudioDev
        ? (generateAudio ? 3 : 2)
        : (generateAudio ? 4 : 3);
      return parseInt(duration) * ratePerSec;
    }
    const pricing: Record<string, Record<string, number>> = {
      '480p': { '5': 7, '10': 14 },
      '720p': { '5': 13, '10': 26 },
      '1080p': { '5': 20, '10': 40 },
    };
    return pricing[resolution]?.[duration] || 20;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (!data.authenticated) { router.push('/login'); return; }
        setUser(data.user);
        const subRes = await fetch('/api/user/subscription');
        const subData = await subRes.json();
        if (subData.success) setHasPromptStudioDev(subData.hasPromptStudioDev);
        const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) setTicketBalance(ticketData.balance);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleEndImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEndImageFile(file);
    setEndImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioFileName(file.name);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { setGenerationError('Please enter a motion prompt'); return; }
    if (!imageFile) { setGenerationError('Please upload an image'); return; }
    if (generationQueue >= MAX_QUEUE_SIZE) { setGenerationError(`Queue full (max ${MAX_QUEUE_SIZE})`); return; }

    const ticketCost = getTicketCost();
    if (ticketBalance < ticketCost) {
      setGenerationError(`Insufficient tickets. Need ${ticketCost} tickets.`);
      return;
    }

    const generationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGenerationQueue(prev => prev + 1);
    setGenerationError(null);

    const loadingPlaceholder: GeneratedVideo = {
      id: generationId,
      prompt,
      videoUrl: '',
      thumbnailUrl: imagePreviewUrl,
      model: videoModel,
      duration,
      resolution: (videoModel === 'kling-o3' || videoModel === 'kling-v3') ? '1080p' : resolution,
      timestamp: Date.now(),
      loading: true,
    };
    setGeneratedVideos(prev => [loadingPlaceholder, ...prev].slice(0, MAX_FEED_SIZE));

    try {
      const imageFormData = new FormData();
      imageFormData.append('file', imageFile);
      const imageUploadRes = await fetch('/api/upload-reference', { method: 'POST', body: imageFormData });
      const imageUploadData = await imageUploadRes.json();

      let audioUrl = undefined;
      if (audioFile && videoModel === 'wan-2.5') {
        const audioFormData = new FormData();
        audioFormData.append('file', audioFile);
        const audioUploadRes = await fetch('/api/upload-audio', { method: 'POST', body: audioFormData });
        const audioUploadData = await audioUploadRes.json();
        if (audioUploadData.url) audioUrl = audioUploadData.url;
      }

      let endImageUrl = undefined;
      if (endImageFile && videoModel === 'kling-v3') {
        const endImageFormData = new FormData();
        endImageFormData.append('file', endImageFile);
        const endImageUploadRes = await fetch('/api/upload-reference', { method: 'POST', body: endImageFormData });
        const endImageUploadData = await endImageUploadRes.json();
        if (endImageUploadData.url) endImageUrl = endImageUploadData.url;
      }

      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          prompt,
          imageUrl: imageUploadData.url,
          duration,
          resolution,
          audioUrl,
          model: videoModel,
          generateAudio,
          klingAspectRatio,
          endImageUrl,
          hasDevTier: hasPromptStudioDev,
        }),
      });

      const data = await res.json();

      if (data.success && data.videoUrl) {
        setGeneratedVideos(prev =>
          prev.map(vid => vid.id === generationId
            ? { ...vid, videoUrl: data.videoUrl, thumbnailUrl: data.thumbnailUrl || vid.thumbnailUrl, loading: false }
            : vid
          ).slice(0, MAX_FEED_SIZE)
        );
        const ticketRes = await fetch(`/api/user/tickets?userId=${user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) setTicketBalance(ticketData.balance);
      } else {
        setGeneratedVideos(prev => prev.filter(vid => vid.id !== generationId));
        setGenerationError(data.error || 'Video generation failed');
      }
    } catch {
      setGeneratedVideos(prev => prev.filter(vid => vid.id !== generationId));
    } finally {
      setGenerationQueue(prev => Math.max(0, prev - 1));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Prototype Banner */}
      <div className="relative z-20 bg-violet-900/80 border-b border-violet-500/50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-violet-300 text-xs font-bold">
          <FlaskConical size={14} />
          PROTOTYPE — Kling O3 Video Scanner (archived from live)
        </div>
        <Link href="/admin/prototype" className="text-violet-400 hover:text-violet-300 text-xs underline">
          ← Back to Prototype Lab
        </Link>
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-orange-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/prototype">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 h-9 px-3">
                <ArrowLeft size={16} className="mr-1" />
                Prototype Lab
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Film className="text-orange-400" size={24} />
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
                Video Scanner (Prototype)
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold">
            <Ticket size={18} />
            {ticketBalance} tickets
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scanner Panel */}
          <div className="p-6 rounded-2xl border-2 border-orange-500/30 bg-slate-900/80 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-orange-400 mb-4 flex items-center gap-2">
              <Film size={20} />
              Video Generator
            </h2>

            {/* Model Selector — all 3 including Kling O3 */}
            <div className="mb-4">
              <label className="text-xs font-bold text-orange-400 mb-2 block uppercase tracking-wider">Model</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setVideoModel('wan-2.5'); setDuration('5'); setEndImageFile(null); setEndImagePreviewUrl(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${videoModel === 'wan-2.5' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-orange-500/50'}`}
                >
                  <div>WAN 2.5</div>
                  <div className="text-[10px] opacity-70 mt-0.5">480p / 720p / 1080p</div>
                </button>
                <button
                  onClick={() => { setVideoModel('kling-o3'); setDuration('5'); setGenerateAudio(false); setEndImageFile(null); setEndImagePreviewUrl(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${videoModel === 'kling-o3' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-orange-500/50'}`}
                >
                  <div>Kling O3</div>
                  <div className="text-[10px] opacity-70 mt-0.5">3–15s • Native Audio</div>
                </button>
                <button
                  onClick={() => { setVideoModel('kling-v3'); setDuration('5'); setGenerateAudio(false); setKlingAspectRatio('16:9'); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${videoModel === 'kling-v3' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-orange-500/50'}`}
                >
                  <div>Kling 3.0</div>
                  <div className="text-[10px] opacity-70 mt-0.5">3–15s • Aspect Ratio</div>
                </button>
              </div>
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <div className={videoModel === 'kling-v3' ? 'flex gap-3' : ''}>
                <div className={videoModel === 'kling-v3' ? 'flex-1' : 'w-full'}>
                  <label className="text-xs font-bold text-orange-400 mb-2 block uppercase tracking-wider">
                    {videoModel === 'kling-v3' ? 'Start Frame' : 'Input Image (Required)'}
                  </label>
                  {!imagePreviewUrl ? (
                    <label className={`flex flex-col items-center justify-center border-2 border-dashed border-orange-500/30 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-500/5 transition-all ${videoModel === 'kling-v3' ? 'p-3 h-32' : 'p-6'}`}>
                      <Upload className="text-orange-400 mb-1" size={videoModel === 'kling-v3' ? 20 : 32} />
                      <span className={`text-slate-400 text-center ${videoModel === 'kling-v3' ? 'text-[10px]' : 'text-sm'}`}>
                        {videoModel === 'kling-v3' ? 'Upload start frame' : 'Upload image (first frame)'}
                      </span>
                      {videoModel !== 'kling-v3' && <span className="text-xs text-slate-500 mt-1">JPEG, PNG, BMP, WEBP (max 10MB)</span>}
                      <input type="file" accept="image/jpeg,image/jpg,image/png,image/bmp,image/webp" onChange={handleImageUpload} className="hidden" />
                    </label>
                  ) : (
                    <div className={`relative flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden ${videoModel === 'kling-v3' ? 'h-32' : 'w-full max-h-64'}`}>
                      <img src={imagePreviewUrl} alt="Start frame" className={videoModel === 'kling-v3' ? 'h-full w-full object-cover' : 'max-h-64 max-w-full object-contain'} />
                      <button onClick={() => { setImageFile(null); setImagePreviewUrl(''); }} className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 hover:bg-red-400 rounded-full">
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  )}
                </div>
                {videoModel === 'kling-v3' && (
                  <div className="flex-1">
                    <label className="text-xs font-bold text-orange-400 mb-2 block uppercase tracking-wider">
                      End Frame <span className="text-slate-500 normal-case font-normal">(optional)</span>
                    </label>
                    {!endImagePreviewUrl ? (
                      <label className="flex flex-col items-center justify-center p-3 h-32 border-2 border-dashed border-orange-500/20 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-500/5 transition-all">
                        <Upload className="text-orange-400/60 mb-1" size={20} />
                        <span className="text-[10px] text-slate-500 text-center">Upload end frame</span>
                        <input type="file" accept="image/jpeg,image/jpg,image/png,image/bmp,image/webp" onChange={handleEndImageUpload} className="hidden" />
                      </label>
                    ) : (
                      <div className="relative h-32 bg-slate-950 rounded-lg overflow-hidden">
                        <img src={endImagePreviewUrl} alt="End frame" className="h-full w-full object-cover" />
                        <button onClick={() => { setEndImageFile(null); setEndImagePreviewUrl(''); }} className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 hover:bg-red-400 rounded-full">
                          <X size={12} className="text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Motion Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the desired motion..."
                className="bg-slate-950 border-slate-700 text-white text-sm min-h-[100px] resize-none"
                maxLength={800}
              />
              <p className="text-xs text-slate-500 mt-1">{prompt.length}/800 characters</p>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Duration</label>
              {videoModel === 'wan-2.5' ? (
                <div className="flex gap-2">
                  {(['5', '10'] as const).map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`flex-1 py-2 rounded text-xs font-bold ${duration === d ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {d} seconds
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1">
                  {(['3','4','5','6','7','8','9','10','11','12','13','14','15'] as const).map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`py-1.5 rounded text-xs font-bold ${duration === d ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      {d}s
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect Ratio — Kling V3 only */}
            {videoModel === 'kling-v3' && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block">Aspect Ratio</label>
                <div className="flex gap-2">
                  {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                    <button key={ratio} onClick={() => setKlingAspectRatio(ratio)}
                      className={`flex-1 py-2 rounded text-xs font-bold ${klingAspectRatio === ratio ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution — WAN 2.5 only */}
            {videoModel === 'wan-2.5' && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block">Resolution</label>
                <div className="flex gap-1">
                  {(['480p', '720p', '1080p'] as const).map(res => (
                    <button key={res} onClick={() => setResolution(res)}
                      className={`flex-1 py-2 rounded text-xs font-bold ${resolution === res ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      {res}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Audio */}
            {videoModel === 'wan-2.5' ? (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-1 block">Background Audio (Optional)</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer text-xs text-slate-300">
                    <Upload size={14} />
                    {audioFileName || 'Upload Audio'}
                    <input type="file" accept="audio/wav,audio/mp3" onChange={handleAudioUpload} className="hidden" />
                  </label>
                  {audioFile && (
                    <button onClick={() => { setAudioFile(null); setAudioFileName(''); }} className="p-2 bg-red-500 hover:bg-red-400 rounded">
                      <X size={14} className="text-white" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">WAV or MP3, 3-30s, max 15MB</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-2 block">Native Audio Generation</label>
                <button
                  onClick={() => setGenerateAudio(prev => !prev)}
                  className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg border transition-all text-xs ${generateAudio ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                >
                  <div className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 flex items-center ${generateAudio ? 'bg-orange-500' : 'bg-slate-600'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform mx-0.5 ${generateAudio ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  {generateAudio ? 'Native audio enabled' : 'Native audio disabled'}
                </button>
                <p className="text-xs text-slate-500 mt-1">Kling generates ambient audio directly from the video context</p>
              </div>
            )}

            {generationError && (
              <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                {generationError}
              </div>
            )}

            {/* Ticket Cost */}
            <div className="mb-4 p-3 rounded-lg bg-slate-950 border border-orange-500/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Cost:</span>
                <span className="text-orange-400 font-bold">{getTicketCost()} tickets</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {videoModel === 'kling-o3'
                  ? `Kling O3 • ${duration}s`
                  : videoModel === 'kling-v3'
                    ? `Kling 3.0 • ${duration}s • ${klingAspectRatio} • audio ${generateAudio ? 'on' : 'off'}${hasPromptStudioDev ? ' • dev rate' : ''}`
                    : `${resolution} • ${duration}s`}
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !imageFile || generationQueue >= MAX_QUEUE_SIZE}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 text-black font-bold h-12 text-sm disabled:opacity-50"
            >
              {generationQueue >= MAX_QUEUE_SIZE ? (
                <><Clock size={16} className="mr-2" />Queue Full ({generationQueue}/{MAX_QUEUE_SIZE})</>
              ) : generationQueue > 0 ? (
                <><Play size={16} className="mr-2" />Generate ({getTicketCost()} 🎫) — {generationQueue}/{MAX_QUEUE_SIZE} active</>
              ) : (
                <><Play size={16} className="mr-2" />Generate Video ({getTicketCost()} 🎫)</>
              )}
            </Button>
          </div>

          {/* Generated Videos */}
          <div className="p-6 rounded-2xl border-2 border-orange-500/30 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2">
                <Film size={20} />
                Generated Videos ({generatedVideos.length})
              </h2>
              {generatedVideos.length > 0 && (
                <Button
                  onClick={() => { if (confirm('Clear all videos from view?')) setGeneratedVideos([]); }}
                  variant="outline"
                  size="sm"
                  className="bg-red-600/20 hover:bg-red-600/40 border-red-500/50 text-red-400 hover:text-red-300 h-8 text-xs"
                >
                  <X size={14} className="mr-1" />
                  Clear View
                </Button>
              )}
            </div>

            {generatedVideos.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Film size={48} className="mx-auto mb-3 opacity-50" />
                <p>No videos generated yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                {generatedVideos.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => !vid.loading && setSelectedVideo(vid)}
                    className={`rounded-lg border-2 border-slate-700 overflow-hidden transition-all ${vid.loading ? 'cursor-default' : 'cursor-pointer hover:border-orange-400'}`}
                  >
                    {vid.loading ? (
                      <div className="w-full aspect-video bg-slate-800 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-3" />
                          <p className="text-orange-400 text-sm font-bold">Generating...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <video src={vid.videoUrl} poster={vid.thumbnailUrl} className="w-full aspect-video object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="text-white" size={32} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setSelectedVideo(null)}>
          <button onClick={() => setSelectedVideo(null)} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-slate-800 rounded-full text-white z-50">
            <X size={24} />
          </button>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <video src={selectedVideo.videoUrl} controls autoPlay loop className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="flex-shrink-0 w-full bg-slate-900/95 border-t border-orange-500/30 px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <p className="text-white text-xs flex-1 truncate">{selectedVideo.prompt}</p>
              <div className="flex items-center gap-2">
                <a href={selectedVideo.videoUrl} download className="bg-orange-500 hover:bg-orange-400 text-black font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs">
                  <Download size={12} />
                  Download
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(selectedVideo.prompt); }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
