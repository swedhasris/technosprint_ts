/**
 * Activity Capture Engine
 * Combines DOM observation + optional screen capture for the AI Activity Tracker.
 * App detection from tab title/URL — zero extra permissions for DOM mode.
 */

export interface ActivitySnapshot {
  timestamp: string;
  appName: string;
  appIcon: string;
  appCategory: string;
  appColor: string;
  url: string;
  pageTitle: string;
  pageType: string;
  pagePath: string;
  headings: string[];
  activeElement: string | null;
  formData: Record<string, string>;
  recentClicks: string[];
  recentKeys: number;
  scrollDepth: number;
  idleSeconds: number;
  visibleText: string;
  badges: string[];
  ticketNumber: string | null;
  tabTitle: string;
  wasVisible: boolean;
  screenshotDataUrl: string | null;
  screenshotBlob: Blob | null;
  screenshotFilename: string | null;
  deltaSec: number;
}

export type WatcherStatus = 'idle' | 'active' | 'stopped';

export interface WatcherOptions {
  intervalMs: number;
  captureScreenshots: boolean;
  onSnapshot: (snap: ActivitySnapshot) => void;
  onStatusChange: (s: WatcherStatus) => void;
}

interface AppInfo { name: string; icon: string; category: string; color: string; }

const APP_PATTERNS: Array<{ patterns: RegExp[]; info: AppInfo }> = [
  {
    patterns: [/chatgpt/i, /chat\.openai/i],
    info: { name: 'ChatGPT', icon: '🤖', category: 'AI Tool', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
  },
  {
    patterns: [/claude/i, /anthropic/i],
    info: { name: 'Claude', icon: '🧠', category: 'AI Tool', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  },
  {
    patterns: [/gemini/i, /bard/i],
    info: { name: 'Gemini', icon: '✨', category: 'AI Tool', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/kiro/i],
    info: { name: 'Kiro', icon: '⚡', category: 'AI IDE', color: 'bg-violet-100 text-violet-800 border-violet-300' }
  },
  {
    patterns: [/cursor/i],
    info: { name: 'Cursor', icon: '🖱️', category: 'AI IDE', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
  },
  {
    patterns: [/copilot/i],
    info: { name: 'GitHub Copilot', icon: '🐙', category: 'AI Tool', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  },
  {
    patterns: [/perplexity/i],
    info: { name: 'Perplexity', icon: '🔍', category: 'AI Tool', color: 'bg-teal-100 text-teal-800 border-teal-300' }
  },
  {
    patterns: [/antigravity/i],
    info: { name: 'Antigravity', icon: '🚀', category: 'AI Tool', color: 'bg-purple-100 text-purple-800 border-purple-300' }
  },
  {
    patterns: [/grok/i],
    info: { name: 'Grok', icon: '🔮', category: 'AI Tool', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  },
  {
    patterns: [/mistral/i],
    info: { name: 'Mistral', icon: '🌪️', category: 'AI Tool', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  },
  {
    patterns: [/visual studio code/i, /vscode/i],
    info: { name: 'VS Code', icon: '💙', category: 'Code Editor', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/github\.com/i, /github/i],
    info: { name: 'GitHub', icon: '🐙', category: 'Development', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  },
  {
    patterns: [/gitlab/i],
    info: { name: 'GitLab', icon: '🦊', category: 'Development', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  },
  {
    patterns: [/stackoverflow/i, /stack overflow/i],
    info: { name: 'Stack Overflow', icon: '📚', category: 'Development', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  },
  {
    patterns: [/postman/i],
    info: { name: 'Postman', icon: '📮', category: 'Development', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  },
  {
    patterns: [/vercel/i],
    info: { name: 'Vercel', icon: '▲', category: 'Development', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  },
  {
    patterns: [/netlify/i],
    info: { name: 'Netlify', icon: '🌐', category: 'Development', color: 'bg-teal-100 text-teal-800 border-teal-300' }
  },
  {
    patterns: [/aws console/i, /amazonaws/i],
    info: { name: 'AWS Console', icon: '☁️', category: 'Cloud', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
  },
  {
    patterns: [/azure/i],
    info: { name: 'Azure', icon: '☁️', category: 'Cloud', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/slack/i],
    info: { name: 'Slack', icon: '💬', category: 'Communication', color: 'bg-purple-100 text-purple-800 border-purple-300' }
  },
  {
    patterns: [/microsoft teams/i, /teams\.microsoft/i],
    info: { name: 'Microsoft Teams', icon: '👥', category: 'Communication', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
  },
  {
    patterns: [/zoom/i],
    info: { name: 'Zoom', icon: '📹', category: 'Communication', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/discord/i],
    info: { name: 'Discord', icon: '🎮', category: 'Communication', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
  },
  {
    patterns: [/whatsapp/i],
    info: { name: 'WhatsApp', icon: '💚', category: 'Communication', color: 'bg-green-100 text-green-800 border-green-300' }
  },
  {
    patterns: [/telegram/i],
    info: { name: 'Telegram', icon: '✈️', category: 'Communication', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/gmail/i, /mail\.google/i],
    info: { name: 'Gmail', icon: '📧', category: 'Email', color: 'bg-red-100 text-red-800 border-red-300' }
  },
  {
    patterns: [/outlook/i],
    info: { name: 'Outlook', icon: '📨', category: 'Email', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/jira/i, /atlassian/i],
    info: { name: 'Jira', icon: '🎯', category: 'Project Management', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/confluence/i],
    info: { name: 'Confluence', icon: '📝', category: 'Documentation', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/notion/i],
    info: { name: 'Notion', icon: '📓', category: 'Documentation', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  },
  {
    patterns: [/trello/i],
    info: { name: 'Trello', icon: '📋', category: 'Project Management', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/linear/i],
    info: { name: 'Linear', icon: '⚡', category: 'Project Management', color: 'bg-violet-100 text-violet-800 border-violet-300' }
  },
  {
    patterns: [/asana/i],
    info: { name: 'Asana', icon: '✅', category: 'Project Management', color: 'bg-pink-100 text-pink-800 border-pink-300' }
  },
  {
    patterns: [/figma/i],
    info: { name: 'Figma', icon: '🎨', category: 'Design', color: 'bg-purple-100 text-purple-800 border-purple-300' }
  },
  {
    patterns: [/canva/i],
    info: { name: 'Canva', icon: '🖼️', category: 'Design', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' }
  },
  {
    patterns: [/adobe/i],
    info: { name: 'Adobe', icon: '🔴', category: 'Design', color: 'bg-red-100 text-red-800 border-red-300' }
  },
  {
    patterns: [/google docs/i, /docs\.google/i],
    info: { name: 'Google Docs', icon: '📄', category: 'Documentation', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/google sheets/i, /sheets\.google/i],
    info: { name: 'Google Sheets', icon: '📊', category: 'Spreadsheet', color: 'bg-green-100 text-green-800 border-green-300' }
  },
  {
    patterns: [/google meet/i, /meet\.google/i],
    info: { name: 'Google Meet', icon: '📹', category: 'Communication', color: 'bg-green-100 text-green-800 border-green-300' }
  },
  {
    patterns: [/google calendar/i, /calendar\.google/i],
    info: { name: 'Google Calendar', icon: '📅', category: 'Calendar', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/google drive/i, /drive\.google/i],
    info: { name: 'Google Drive', icon: '💾', category: 'Storage', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
  },
  {
    patterns: [/google search/i, /- google$/i],
    info: { name: 'Google Search', icon: '🔍', category: 'Browsing', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/microsoft word/i, /word online/i],
    info: { name: 'Microsoft Word', icon: '📝', category: 'Documentation', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/microsoft excel/i, /excel online/i],
    info: { name: 'Microsoft Excel', icon: '📊', category: 'Spreadsheet', color: 'bg-green-100 text-green-800 border-green-300' }
  },
  {
    patterns: [/powerpoint/i],
    info: { name: 'PowerPoint', icon: '📽️', category: 'Presentation', color: 'bg-orange-100 text-orange-800 border-orange-300' }
  },
  {
    patterns: [/sharepoint/i],
    info: { name: 'SharePoint', icon: '🗂️', category: 'Documentation', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
  {
    patterns: [/youtube/i],
    info: { name: 'YouTube', icon: '▶️', category: 'Media', color: 'bg-red-100 text-red-800 border-red-300' }
  },
  {
    patterns: [/wikipedia/i],
    info: { name: 'Wikipedia', icon: '📖', category: 'Research', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  },
  {
    patterns: [/servicenow/i],
    info: { name: 'ServiceNow', icon: '🎫', category: 'ITSM', color: 'bg-green-100 text-green-800 border-green-300' }
  },
  {
    patterns: [/zendesk/i],
    info: { name: 'Zendesk', icon: '🎫', category: 'ITSM', color: 'bg-green-100 text-green-800 border-green-300' }
  },
  {
    patterns: [/connect.?it/i, /localhost:3000/i],
    info: { name: 'Connect IT', icon: '🔗', category: 'ITSM', color: 'bg-blue-100 text-blue-800 border-blue-300' }
  },
];

const DEFAULT_APP: AppInfo = {
  name: 'Web Browser', icon: '🌐', category: 'Browsing',
  color: 'bg-slate-100 text-slate-700 border-slate-300',
};

export function detectApp(title: string, url: string): AppInfo {
  const combined = `${title} ${url}`;
  for (const { patterns, info } of APP_PATTERNS) {
    if (patterns.some(p => p.test(combined))) return info;
  }
  return DEFAULT_APP;
}

/* ── Page type detection ── */
function detectPageType(url: string): string {
  if (url.match(/\/tickets\/[^/]+/)) return 'Ticket Detail';
  if (url.includes('/tickets')) return 'Ticket List';
  if (url.includes('/timesheet/weekly')) return 'Weekly Timesheet';
  if (url.includes('/timesheet/reports')) return 'Timesheet Reports';
  if (url.includes('/timesheet')) return 'Timesheet';
  if (url.includes('/activity-tracker')) return 'Activity Tracker';
  if (url.includes('/settings')) return 'System Settings';
  if (url.includes('/users')) return 'User Management';
  if (url.includes('/calendar')) return 'Calendar';
  if (url.includes('/leaderboard')) return 'Leaderboard';
  if (url.includes('/kb')) return 'Knowledge Base';
  if (url.includes('/cmdb')) return 'CMDB';
  if (url.includes('/reports')) return 'Reports';
  if (url.includes('/problem')) return 'Problem Management';
  if (url.includes('/change')) return 'Change Management';
  if (url.includes('/catalog')) return 'Service Catalog';
  if (url.includes('/approvals')) return 'Approvals';
  if (url === '/') return 'Dashboard';
  return 'Application';
}

function extractTicketNumber(url: string): string | null {
  const m = url.match(/\/tickets\/([A-Z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  const text = Array.from(document.querySelectorAll('h1,h2,[class*="font-bold"]'))
    .map(el => el.textContent || '').join(' ');
  const dm = text.match(/\b(INC|TKT|REQ|CHG|PRB)\d{5,}/i);
  return dm ? dm[0].toUpperCase() : null;
}

function getHeadings(): string[] {
  return Array.from(document.querySelectorAll('h1,h2,h3'))
    .slice(0, 6).map(el => el.textContent?.trim() || '').filter(Boolean);
}

function getFormData(): Record<string, string> {
  const data: Record<string, string> = {};
  document.querySelectorAll('input:not([type=password]),select,textarea').forEach(el => {
    const inp = el as HTMLInputElement;
    const label = inp.closest('div')?.querySelector('label')?.textContent?.trim()
      || inp.getAttribute('placeholder') || inp.name || '';
    if (label && inp.value && inp.value.length < 200)
      data[label.slice(0, 40)] = inp.value.slice(0, 100);
  });
  return data;
}

function getActiveElementDesc(): string | null {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const placeholder = (el as HTMLInputElement).placeholder || '';
  const label = el.closest('div')?.querySelector('label')?.textContent?.trim() || '';
  return `${el.tagName.toLowerCase()}${label ? ` "${label}"` : placeholder ? ` "${placeholder}"` : ''}`;
}

function getBadges(): string[] {
  return Array.from(document.querySelectorAll('[class*="badge"],[class*="rounded-full"],[class*="status"]'))
    .slice(0, 8).map(el => el.textContent?.trim() || '')
    .filter(t => t.length > 0 && t.length < 30);
}

function getVisibleText(): string {
  const main = document.querySelector('main') || document.body;
  return (main.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600);
}

function getScrollDepth(): number {
  const el = document.querySelector('main') || document.documentElement;
  const total = el.scrollHeight - el.clientHeight;
  return total > 0 ? Math.round((el.scrollTop / total) * 100) : 0;
}

/* ── Screenshot: uses Electron desktopCapturer (silent, entire screen) when
   running as desktop app, otherwise falls back to html2canvas ── */
async function captureTabScreenshot(): Promise<{ dataUrl: string; blob: Blob; filename: string } | null> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `activity_${ts}.jpeg`;

  // ── Method 1: Electron desktopCapturer — silent, entire screen, no dialog ──
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.isElectron) {
    try {
      const result = await electronAPI.captureScreen();
      if (result?.dataUrl && !result.error) {
        // Convert base64 dataUrl to Blob
        const res = await fetch(result.dataUrl);
        const blob = await res.blob();
        return { dataUrl: result.dataUrl, blob, filename };
      }
    } catch (err) {
      console.warn('[ActivityCapture] Electron capture failed:', err);
    }
  }

  // ── Method 2: html2canvas — renders DOM to canvas (browser fallback) ──
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(document.documentElement, {
      scale: window.devicePixelRatio || 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      scrollX: 0,
      scrollY: 0,
      x: window.scrollX,
      y: window.scrollY,
      ignoreElements: (el) => el.tagName === 'VIDEO' || el.tagName === 'IFRAME',
    });
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.85)
    );
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { dataUrl, blob, filename };
  } catch { /* fall through */ }

  // ── Method 3: Info card fallback ──
  return captureTabScreenshotFallback();
}

async function captureTabScreenshotFallback(): Promise<{ dataUrl: string; blob: Blob; filename: string } | null> {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `activity_${ts}.jpeg`;
    const w = Math.min(window.innerWidth, 1280);
    const h = Math.min(window.innerHeight, 800);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 16px system-ui';
    ctx.fillText(document.title.slice(0, 80), 20, 40);
    ctx.fillStyle = '#64748b'; ctx.font = '13px system-ui';
    ctx.fillText(window.location.href.slice(0, 100), 20, 65);
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui';
    ctx.fillText(new Date().toLocaleString(), 20, 85);

    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .slice(0, 5).map(el => el.textContent?.trim() || '').filter(Boolean);
    let y = 115;
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 14px system-ui';
    headings.forEach(h => { ctx.fillText(`• ${h.slice(0, 90)}`, 20, y); y += 26; });

    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.80)
    );
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.80), blob, filename };
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════
   ActivityWatcher
   - Requests getDisplayMedia ONCE on start (user picks screen)
   - Holds the stream open and grabs a frame every interval
   - No repeated permission dialogs
═══════════════════════════════════════════════════════════ */
export class ActivityWatcher {
  private status: WatcherStatus = 'idle';
  private opts: WatcherOptions;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private recentClicks: string[] = [];
  private keystrokeCount = 0;
  private lastInteractionAt = Date.now();
  private wasVisible = true;
  private lastGlobalKeys = 0;
  private lastGlobalClicks = 0;
  private hasBaseline = false;
  private lastSnapshotAt = Date.now();

  // Persistent screen capture stream — opened once, reused every interval
  private screenStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;

  private _onClick: (e: MouseEvent) => void;
  private _onKey: (e: KeyboardEvent) => void;
  private _onVisibility: () => void;
  private _onMouseMove: () => void;

  constructor(opts: WatcherOptions) {
    this.opts = opts;

    this._onClick = (e: MouseEvent) => {
      this.lastInteractionAt = Date.now();
      const target = e.target as HTMLElement;

      // Walk up the DOM to find the most meaningful clickable element
      const clickable = target.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], label, select, input, textarea') as HTMLElement | null;
      const el = clickable || target;

      // Get a clean, short label
      let label =
        el.getAttribute('aria-label')?.trim() ||
        el.getAttribute('title')?.trim() ||
        el.getAttribute('placeholder')?.trim() ||
        (el as HTMLInputElement).value?.trim().slice(0, 30) ||
        // Get direct text only (not child element text)
        Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent?.trim())
          .filter(Boolean)
          .join(' ')
          .slice(0, 40) ||
        el.textContent?.trim().slice(0, 40) ||
        el.tagName.toLowerCase();

      // Clean up whitespace and skip noise
      label = label.replace(/\s+/g, ' ').trim();
      if (label && label.length > 1 && label.length < 60) {
        this.recentClicks = [...this.recentClicks.slice(-9), label];
      }
    };

    this._onKey = (e: KeyboardEvent) => {
      this.lastInteractionAt = Date.now();
      // Count all keystrokes including special keys
      this.keystrokeCount++;
    };

    // Also reset idle on mouse move (catches activity in other apps via focus events)
    this._onMouseMove = () => {
      this.lastInteractionAt = Date.now();
    };

    this._onVisibility = () => {
      this.wasVisible = !document.hidden;
    };
  }

  private setStatus(s: WatcherStatus) {
    this.status = s;
    this.opts.onStatusChange(s);
  }

  getStatus() { return this.status; }

  /** Request screen access once, then start the interval loop */
  async start(): Promise<void> {
    if (this.status === 'active') return;

    // Only request getDisplayMedia if server-side capture is unavailable
    // (i.e., not running in Node/Electron context)
    if (this.opts.captureScreenshots) {
      // Test if server-side capture works first
      let serverCaptureWorks = false;
      try {
        const test = await fetch('/api/capture-screen', { signal: AbortSignal.timeout(3000) });
        serverCaptureWorks = test.ok;
      } catch { /* server capture not available */ }

      // Only fall back to getDisplayMedia if server capture doesn't work
      if (!serverCaptureWorks && !(window as any).electronAPI?.isElectron) {
        try {
          this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: 1,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              displaySurface: 'monitor',
            } as any,
            audio: false,
            preferCurrentTab: false,
            selfBrowserSurface: 'exclude',
            surfaceSwitching: 'exclude',
            systemAudio: 'exclude',
          } as any);

          this.screenTrack = this.screenStream.getVideoTracks()[0];
          this.screenTrack.addEventListener('ended', () => this.stop());
        } catch (err: any) {
          console.warn('[ActivityWatcher] Screen permission denied:', err.message);
          this.screenStream = null;
          this.screenTrack = null;
        }
      }
    }

    document.addEventListener('click', this._onClick, true);
    document.addEventListener('keydown', this._onKey, true);
    document.addEventListener('mousemove', this._onMouseMove, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibility);
    this.setStatus('active');

    this.takeSnapshot();
    this.intervalId = setInterval(() => this.takeSnapshot(), this.opts.intervalMs);
  }

  stop() {
    if (this.status !== 'active') return;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }

    // Release the screen stream
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
      this.screenTrack = null;
    }

    document.removeEventListener('click', this._onClick, true);
    document.removeEventListener('keydown', this._onKey, true);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.setStatus('stopped');
  }

  updateInterval(ms: number) {
    this.opts.intervalMs = ms;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.takeSnapshot(), ms);
    }
  }

  /** Grab a single frame from the persistent stream — no new permission needed */
  private async grabScreenFrame(): Promise<{ dataUrl: string; blob: Blob; filename: string } | null> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `activity_${ts}.jpeg`;

    // ── Method 1: Electron desktopCapturer (silent, entire computer) ──
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.isElectron) {
      try {
        const result = await electronAPI.captureScreen();
        if (result?.dataUrl && !result.error) {
          const res = await fetch(result.dataUrl);
          const blob = await res.blob();
          return { dataUrl: result.dataUrl, blob, filename };
        }
      } catch { /* fall through */ }
    }

    // ── Method 2: Server-side OS capture via /api/capture-screen ──
    // The Node.js server uses screenshot-desktop to capture the entire screen
    // silently at OS level — no browser permission dialog needed.
    try {
      const res = await fetch('/api/capture-screen');
      if (res.ok) {
        const data = await res.json();
        if (data.data_url && data.image_url) {
          // Convert base64 dataUrl to Blob
          const fetchRes = await fetch(data.data_url);
          const blob = await fetchRes.blob();
          return {
            dataUrl: data.data_url,
            blob,
            filename: data.filename || filename,
          };
        }
      }
    } catch (err) {
      console.warn('[ActivityCapture] Server capture failed:', err);
    }

    // ── Method 3: Browser getDisplayMedia (persistent stream, one-time permission) ──
    if (this.screenTrack && this.screenTrack.readyState === 'live') {
      try {
        let blob: Blob;

        if (typeof (window as any).ImageCapture !== 'undefined') {
          const ic = new (window as any).ImageCapture(this.screenTrack);
          const bitmap = await ic.grabFrame();
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(bitmap.width * 0.75);
          canvas.height = Math.round(bitmap.height * 0.75);
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close?.();
          blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.85)
          );
        } else {
          const video = document.createElement('video');
          video.srcObject = new MediaStream([this.screenTrack]);
          video.muted = true;
          video.playsInline = true;
          await new Promise<void>((res, rej) => {
            video.onloadedmetadata = () => video.play().then(res).catch(rej);
            setTimeout(() => rej(new Error('timeout')), 3000);
          });
          await new Promise(r => requestAnimationFrame(r));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(video.videoWidth * 0.75);
          canvas.height = Math.round(video.videoHeight * 0.75);
          canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
          video.pause(); video.srcObject = null;
          blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.85)
          );
        }

        const dataUrl = await new Promise<string>(res => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.readAsDataURL(blob);
        });
        return { dataUrl, blob, filename };
      } catch (err) {
        console.warn('[ActivityWatcher] Frame grab failed:', err);
      }
    }

    // ── Method 4: html2canvas fallback ──
    return captureTabScreenshot();
  }

  private async takeSnapshot() {
    if (this.status !== 'active') return;
    const now = Date.now();
    const deltaSec = Math.max(0, (now - this.lastSnapshotAt) / 1000);
    this.lastSnapshotAt = now;

    const url = window.location.pathname;
    const fullUrl = window.location.href;
    const title = document.title;
    const idleSeconds = Math.floor((Date.now() - this.lastInteractionAt) / 1000);
    const app = detectApp(title, fullUrl);
    
    // Fetch global stats from server (captures activity in other apps)
    let globalKeysDelta = 0;
    let globalClicksDelta = 0;
    try {
      const statsRes = await fetch('/api/input-stats');
      if (statsRes.ok) {
        const stats = await statsRes.json();
        if (!this.hasBaseline) {
          this.lastGlobalKeys = stats.keystrokes || 0;
          this.lastGlobalClicks = stats.clicks || 0;
          this.hasBaseline = true;
        } else {
          globalKeysDelta = Math.max(0, (stats.keystrokes || 0) - this.lastGlobalKeys);
          globalClicksDelta = Math.max(0, (stats.clicks || 0) - this.lastGlobalClicks);
          this.lastGlobalKeys = stats.keystrokes || 0;
          this.lastGlobalClicks = stats.clicks || 0;
        }
      }
    } catch (e) { console.warn('[ActivityWatcher] Could not fetch global input stats:', e); }

    // If global activity detected, reset idle timer
    if (globalKeysDelta > 0 || globalClicksDelta > 0) {
      this.lastInteractionAt = Date.now();
    }

    let screenshotDataUrl: string | null = null;
    let screenshotBlob: Blob | null = null;
    let screenshotFilename: string | null = null;

    if (this.opts.captureScreenshots) {
      const cap = await this.grabScreenFrame();
      if (cap) {
        screenshotDataUrl = cap.dataUrl;
        screenshotBlob = cap.blob;
        screenshotFilename = cap.filename;
      }
    }

    const snap: ActivitySnapshot = {
      timestamp: new Date().toISOString(),
      appName: app.name,
      appIcon: app.icon,
      appCategory: app.category,
      appColor: app.color,
      url,
      pagePath: url,
      pageTitle: title,
      pageType: detectPageType(url),
      headings: getHeadings(),
      activeElement: getActiveElementDesc(),
      formData: getFormData(),
      recentClicks: [...this.recentClicks, ...Array(globalClicksDelta).fill('External Click')],
      recentKeys: this.keystrokeCount + globalKeysDelta,
      scrollDepth: getScrollDepth(),
      idleSeconds,
      visibleText: getVisibleText(),
      badges: getBadges(),
      ticketNumber: extractTicketNumber(url),
      tabTitle: title,
      wasVisible: this.wasVisible,
      screenshotDataUrl,
      screenshotBlob,
      screenshotFilename,
      deltaSec,
    };

    this.recentClicks = [];
    this.keystrokeCount = 0;
    this.opts.onSnapshot(snap);
  }
}
