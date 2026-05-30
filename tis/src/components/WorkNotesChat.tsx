/**
 * WorkNotesChat — Private Work Notes Chat Stream
 *
 * START flow: timer starts → capture PNG → upload → AI note → 🟢 bubble
 * STOP  flow: timer stops  → capture JPEG → upload → AI note → 🔴 bubble
 *
 * All notes are private/internal. No page refresh required.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, Camera, Bot, Lock, Clock,
  Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Maximize2, ImageIcon, Download,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { captureScreenshot, uploadScreenshot, type CaptureResult } from '../lib/screenshotCapture';

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
export interface WorkNoteMessage {
  id: string;
  type: 'start' | 'stop';
  timestamp: string;
  screenshotUrl: string | null;
  screenshotPreview: string | null;
  screenshotFilename: string | null;   // e.g. timesheet_start_2026-05-04T....png
  screenshotFormat: string | null;     // 'PNG' | 'JPEG'
  screenshotSizeKB: number | null;
  aiNote: string;
  duration?: string;
  sessionId?: string;
}

interface WorkNotesChatProps {
  ticketNumber?: string;
  ticketTitle?: string;
  ticketId?: string;
  onSessionStart?: (sessionId: string, startTime: Date) => void;
  onSessionStop?: (sessionId: string, durationSeconds: number) => void;
}

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function formatHMS(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/* ─────────────────────────────────────────
   Screenshot Modal
───────────────────────────────────────── */
function ScreenshotModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-6xl max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <img src={src} alt="Screenshot" className="max-w-full max-h-[88vh] object-contain block" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/90 transition-colors text-xl font-bold leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Chat Bubble
───────────────────────────────────────── */
function ChatBubble({
  msg,
  onPreviewClick,
}: {
  key?: React.Key;
  msg: WorkNoteMessage;
  onPreviewClick: (src: string) => void;
}) {
  const isStart = msg.type === 'start';
  // Use base64 preview if available (just captured), otherwise use server URL
  const previewSrc = msg.screenshotPreview || msg.screenshotUrl;

  return (
    <div className={`flex gap-3 ${isStart ? 'flex-row' : 'flex-row-reverse'}`}>

      {/* Avatar dot */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm text-base
        ${isStart ? 'bg-green-100' : 'bg-red-100'}`}>
        {isStart ? '🟢' : '🔴'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] rounded-2xl shadow-sm overflow-hidden border
        ${isStart
          ? 'bg-green-50 border-green-200 rounded-tl-sm'
          : 'bg-red-50  border-red-200  rounded-tr-sm'}`}>

        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b
          ${isStart ? 'border-green-200 bg-green-100/70' : 'border-red-200 bg-red-100/70'}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide
              ${isStart ? 'text-green-800' : 'text-red-800'}`}>
              {isStart ? '🟢 Session Started' : '🔴 Session Stopped'}
            </span>
            {msg.duration && (
              <span className="text-xs font-mono bg-white/80 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                ⏱ {msg.duration}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 ml-2 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{fmtTime(msg.timestamp)}</span>
          </div>
        </div>

        {/* ── Screenshot Image — full photo display ── */}
        {previewSrc ? (
          <div className="border-b border-gray-100">
            {/* Full image — natural size, no cropping */}
            <img
              src={previewSrc}
              alt="Screenshot"
              className="w-full block cursor-zoom-in"
              style={{ maxHeight: '400px', objectFit: 'contain', background: '#111' }}
              loading="lazy"
              onClick={() => onPreviewClick(previewSrc)}
              onError={e => {
                // If server URL fails, hide broken image
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {/* Bottom bar: format badge + download */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/80">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3 text-white/70" />
                <span className="text-[10px] text-white/80 font-mono">
                  {msg.screenshotFilename || 'screenshot'}
                </span>
                {msg.screenshotFormat && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase
                    ${msg.screenshotFormat === 'PNG' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
                    {msg.screenshotFormat}
                  </span>
                )}
                {msg.screenshotSizeKB && (
                  <span className="text-[10px] text-white/50">{msg.screenshotSizeKB} KB</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Open full size */}
                <a
                  href={previewSrc.startsWith('data:') ? '#' : previewSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => { if (previewSrc.startsWith('data:')) { e.preventDefault(); onPreviewClick(previewSrc); } }}
                  className="p-1 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  title="View full size"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </a>
                {/* Download */}
                {msg.screenshotUrl && msg.screenshotFilename && (
                  <a
                    href={msg.screenshotUrl}
                    download={msg.screenshotFilename}
                    className="p-1 rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                    title="Download image"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-xs text-gray-400 italic">
            <Camera className="w-3.5 h-3.5" />
            <span>Screenshot unavailable</span>
          </div>
        )}

        {/* ── 📝 AI Note ── */}
        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide block mb-0.5">
                📝 AI Note
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{msg.aiNote}</p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pb-2.5 flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] text-gray-400">Private · Internal only</span>
          <span className="text-[10px] text-gray-400 ml-auto">{fmtDate(msg.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Processing Bubble (live step indicator)
───────────────────────────────────────── */
function ProcessingBubble({ step }: { step: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-700 font-medium">{step}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export function WorkNotesChat({
  ticketNumber = '',
  ticketTitle = '',
  ticketId = '',
  onSessionStart,
  onSessionStop,
}: WorkNotesChatProps) {
  const { user, profile } = useAuth();

  const [messages, setMessages]           = useState<WorkNoteMessage[]>([]);
  const [isRunning, setIsRunning]         = useState(false);
  const [elapsed, setElapsed]             = useState(0);
  const [processingStep, setStep]         = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [previewModal, setPreviewModal]   = useState<string | null>(null);
  const [activeSessionId, setSessionId]   = useState<string | null>(null);
  const [collapsed, setCollapsed]         = useState(false);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0); // always-current elapsed for stop handler

  /* ── Load saved notes ── */
  useEffect(() => {
    if (user) loadNotes();
  }, [user, ticketId]);

  async function loadNotes() {
    try {
      const p = new URLSearchParams({ user_id: user!.uid, limit: '50' });
      if (ticketId) p.append('ticket_id', ticketId);
      const res = await fetch(`/api/work-notes?${p}`);
      if (!res.ok) return;
      const rows = await res.json();
      setMessages((rows || []).map((n: any): WorkNoteMessage => ({
        id: String(n.id),
        type: n.note_type,
        timestamp: n.created_at,
        screenshotUrl: n.screenshot_url || null,
        screenshotPreview: null,
        screenshotFilename: n.screenshot_filename || (n.screenshot_url ? n.screenshot_url.split('/').pop() : null),
        screenshotFormat: n.screenshot_format || null,
        screenshotSizeKB: n.screenshot_size_kb || null,
        aiNote: n.ai_note || 'Work session in progress',
        duration: n.duration_display || undefined,
        sessionId: n.session_id ? String(n.session_id) : undefined,
      })));
    } catch { /* silent */ }
  }

  /* ── Timer ── */
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(s => { elapsedRef.current = s + 1; return s + 1; });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processingStep]);

  /* ── Core pipeline: Capture → Convert → Compress → Upload → AI → Save → Display ── */
  const runPipeline = useCallback(async (
    context: 'start' | 'stop',
    sessionId: string | null,
    durationSeconds: number,
  ): Promise<WorkNoteMessage | null> => {
    const userId   = user?.uid   || 'anonymous';
    const userName = profile?.name || user?.email || 'User';

    let capture: CaptureResult | null = null;
    let screenshotUrl: string | null = null;

    // ── Step 1: Capture + Convert + Compress ──
    setStep(`📸 Capturing screenshot (${context === 'start' ? 'PNG' : 'JPEG'})...`);
    try {
      capture = await captureScreenshot(context);
      // ── Step 2: Upload ──
      setStep(`⬆️ Uploading ${capture.format.toUpperCase()} (${capture.sizeKB}KB)...`);
      screenshotUrl = await uploadScreenshot(capture, userId);
    } catch (err: any) {
      console.warn('[WorkNotes] Screenshot/upload failed:', err.message);
      setError(`📸 Screenshot unavailable: ${err.message}. Continuing with AI note only.`);
      setTimeout(() => setError(null), 6000);
    }

    // ── Step 3: Generate AI Note ──
    setStep('🤖 Generating AI work note...');
    let aiNote = context === 'start' ? 'Work session in progress.' : 'Work session completed.';
    try {
      const aiRes = await fetch('/api/ai/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          ticketNumber,
          ticketTitle,
          userId,
          userName,
          durationSeconds: context === 'stop' ? durationSeconds : undefined,
          pageUrl: window.location.pathname,
          pageTitle: document.title,
        }),
      });
      if (aiRes.ok) {
        const d = await aiRes.json();
        if (d.note) aiNote = d.note;
      }
    } catch { /* use default */ }

    // ── Step 4: Save to DB ──
    setStep('💾 Saving work note...');
    let savedId = `local_${Date.now()}`;
    let savedSessionId = sessionId;
    try {
      const saveRes = await fetch('/api/work-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          ticket_id: ticketId || null,
          ticket_number: ticketNumber || null,
          note_type: context,
          screenshot_url: screenshotUrl,
          screenshot_filename: capture?.filename || null,
          screenshot_format: capture ? capture.format.toUpperCase() : null,
          screenshot_size_kb: capture ? capture.sizeKB : null,
          ai_note: aiNote,
          session_id: savedSessionId,
          duration_seconds: context === 'stop' ? durationSeconds : null,
          duration_display: context === 'stop' ? formatHMS(durationSeconds) : null,
        }),
      });
      if (saveRes.ok) {
        const saved = await saveRes.json();
        savedId = String(saved.id);
        if (saved.session_id) savedSessionId = String(saved.session_id);
      }
    } catch { /* use local id */ }

    return {
      id: savedId,
      type: context,
      timestamp: new Date().toISOString(),
      screenshotUrl,
      screenshotPreview: capture?.dataUrl || null,
      screenshotFilename: capture?.filename || (screenshotUrl ? screenshotUrl.split('/').pop() || null : null),
      screenshotFormat: capture ? capture.format.toUpperCase() : null,
      screenshotSizeKB: capture?.sizeKB || null,
      aiNote,
      duration: context === 'stop' ? formatHMS(durationSeconds) : undefined,
      sessionId: savedSessionId || undefined,
    };  }, [user, profile, ticketNumber, ticketTitle, ticketId]);

  /* ── START ── */
  const handleStart = useCallback(async () => {
    if (isRunning || processingStep) return;
    setError(null);

    // 1. Start timer immediately
    setIsRunning(true);
    setElapsed(0);
    elapsedRef.current = 0;

    const tempId = `sess_${Date.now()}`;
    setSessionId(tempId);
    const startTime = new Date();

    try {
      const msg = await runPipeline('start', tempId, 0);
      if (msg) {
        setMessages(prev => [...prev, msg]);
        if (msg.sessionId) setSessionId(msg.sessionId);
        onSessionStart?.(msg.sessionId || tempId, startTime);
      }
    } catch (err: any) {
      setError(`Start failed: ${err.message}`);
    } finally {
      setStep(null);
    }
  }, [isRunning, processingStep, runPipeline, onSessionStart]);

  /* ── STOP ── */
  const handleStop = useCallback(async () => {
    if (!isRunning || processingStep) return;
    setError(null);

    // 1. Stop timer immediately
    setIsRunning(false);
    const finalDuration = elapsedRef.current;

    try {
      const msg = await runPipeline('stop', activeSessionId, finalDuration);
      if (msg) {
        setMessages(prev => [...prev, msg]);
        onSessionStop?.(activeSessionId || '', finalDuration);
      }
    } catch (err: any) {
      setError(`Stop failed: ${err.message}`);
    } finally {
      setStep(null);
      setSessionId(null);
      setElapsed(0);
      elapsedRef.current = 0;
    }
  }, [isRunning, processingStep, activeSessionId, runPipeline, onSessionStop]);

  /* ─────────────────────────────────────────
     Render
  ───────────────────────────────────────── */
  return (
    <>
      {previewModal && (
        <ScreenshotModal src={previewModal} onClose={() => setPreviewModal(null)} />
      )}

      <div className="border border-border rounded-lg bg-white shadow-sm overflow-hidden">

        {/* ══ Header bar ══ */}
        <div
          className="flex items-center justify-between px-5 py-3 bg-white hover:bg-muted/10 cursor-pointer select-none border-b border-border"
          onClick={() => setCollapsed(c => !c)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(c => !c); } }}
        >
          {/* Left: title + badges */}
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-600">Work Notes (Private)</span>
            {messages.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {messages.length}
              </span>
            )}
            {isRunning && (
              <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                LIVE
              </span>
            )}
          </div>

          {/* Right: timer + button + chevron */}
          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
            {isRunning && (
              <span className="font-mono text-lg font-bold text-green-600 tabular-nums">
                {formatHMS(elapsed)}
              </span>
            )}

            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={!!processingStep}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                {processingStep
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Play className="w-4 h-4 fill-white" />}
                Start
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={!!processingStep}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                {processingStep
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Square className="w-4 h-4 fill-white" />}
                Stop
              </button>
            )}

            {collapsed
              ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
              : <ChevronUp   className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>

        {/* ══ Body ══ */}
        {!collapsed && (
          <div className="flex flex-col">

            {/* Processing step banner */}
            {processingStep && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                <span className="text-xs text-blue-700 font-medium">{processingStep}</span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-700">{error}</span>
              </div>
            )}

            {/* Chat stream */}
            <div className="p-4 space-y-4 max-h-[540px] overflow-y-auto bg-gray-50/40">
              {messages.length === 0 && !processingStep && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-3 border border-amber-100">
                    <Camera className="w-6 h-6 text-amber-400" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">No work notes yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Click <strong>Start</strong> to begin. A screenshot (PNG) and AI note will be captured automatically.
                    Clicking <strong>Stop</strong> captures a JPEG and logs the session duration.
                  </p>
                </div>
              )}

              {messages.map(msg => (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  onPreviewClick={src => setPreviewModal(src)}
                />
              ))}

              {processingStep && <ProcessingBubble step={processingStep} />}

              <div ref={chatEndRef} />
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border bg-white flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>Private · visible only to you and admins</span>
              </div>
              {messages.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span>{messages.length} note{messages.length !== 1 ? 's' : ''} recorded</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
