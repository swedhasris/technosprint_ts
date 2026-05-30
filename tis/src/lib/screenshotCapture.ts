/**
 * Screenshot Capture Module
 * Uses browser Screen Capture API (getDisplayMedia) to capture real screenshots.
 *
 * FORMAT RULES (per spec):
 *   - Start context  → PNG  (timesheet_start_<timestamp>.png)
 *   - Stop  context  → JPEG (timesheet_stop_<timestamp>.jpeg)
 *
 * Pipeline: getDisplayMedia → grab frame → canvas → compress → PNG/JPEG blob → upload
 * No raw video stream is ever stored.
 */

/** Max dimension for compression — keeps file size reasonable */
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

/** JPEG quality (0–1). Only applies to JPEG output. */
const JPEG_QUALITY = 0.82;

declare var ImageCapture: any;

export type ScreenshotContext = 'start' | 'stop';
export type ImageFormat = 'png' | 'jpeg';

export interface CaptureResult {
  /** base64 data URL — used for instant in-browser preview */
  dataUrl: string;
  /** Compressed image blob — sent to server */
  blob: Blob;
  /** MIME type: image/png or image/jpeg */
  mime: string;
  /** Format label */
  format: ImageFormat;
  /** Server filename: timesheet_start_<ts>.png or timesheet_stop_<ts>.jpeg */
  filename: string;
  width: number;
  height: number;
  /** Approximate file size in KB */
  sizeKB: number;
  capturedAt: string;
}

/**
 * Determine format from context:
 *   start → PNG  (lossless, captures exact state)
 *   stop  → JPEG (compressed, smaller file)
 */
function formatForContext(context: ScreenshotContext): ImageFormat {
  return context === 'start' ? 'png' : 'jpeg';
}

/**
 * Build the required filename:
 *   timesheet_start_2026-05-04T12-30-00-000Z.png
 *   timesheet_stop_2026-05-04T12-30-00-000Z.jpeg
 */
function buildFilename(context: ScreenshotContext, format: ImageFormat): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = format === 'png' ? 'png' : 'jpeg';
  return `timesheet_${context}_${ts}.${ext}`;
}

/**
 * Compress a canvas to the target format.
 * Resizes down if larger than MAX_WIDTH × MAX_HEIGHT.
 */
function compressCanvas(
  source: HTMLCanvasElement | ImageBitmap,
  format: ImageFormat
): Promise<Blob> {
  const srcW = 'width' in source ? source.width : (source as any).width;
  const srcH = 'height' in source ? source.height : (source as any).height;

  // Calculate scaled dimensions
  let w = srcW;
  let h = srcH;
  if (w > MAX_WIDTH || h > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source as any, 0, 0, w, h);

  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpeg' ? JPEG_QUALITY : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas compression failed — toBlob returned null'));
      },
      mime,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Capture a screenshot for the given context (start or stop).
 *
 * Flow:
 *   1. getDisplayMedia  — browser shows native screen picker
 *   2. Grab single frame via ImageCapture API (or video fallback)
 *   3. Compress + convert to PNG (start) or JPEG (stop)
 *   4. Stop stream immediately — no raw video stored
 *   5. Return blob + dataUrl + metadata
 */
export async function captureScreenshot(context: ScreenshotContext): Promise<CaptureResult> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen Capture API (getDisplayMedia) is not available in this browser.');
  }

  const format = formatForContext(context);
  const filename = buildFilename(context, format);
  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor',
        frameRate: 1,
        width: { ideal: MAX_WIDTH },
        height: { ideal: MAX_HEIGHT },
      },
      audio: false,
      ...(({ preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude', systemAudio: 'exclude' }) as any),
    } as any);

    const track = stream.getVideoTracks()[0];
    let blob: Blob;
    let width: number;
    let height: number;

    if (typeof ImageCapture !== 'undefined') {
      // ── Primary path: ImageCapture API (Chrome, Edge) ──
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      width = bitmap.width;
      height = bitmap.height;
      blob = await compressCanvas(bitmap, format);
      bitmap.close?.();
    } else {
      // ── Fallback: video element → canvas (Firefox, Safari) ──
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => video.play().then(resolve).catch(reject);
        video.onerror = () => reject(new Error('Video element failed to load'));
        setTimeout(() => reject(new Error('Video load timed out after 6s')), 6000);
      });

      // Two rAF cycles to guarantee a real painted frame
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));

      width = video.videoWidth || 1280;
      height = video.videoHeight || 720;

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = width;
      tmpCanvas.height = height;
      tmpCanvas.getContext('2d')!.drawImage(video, 0, 0, width, height);

      blob = await compressCanvas(tmpCanvas, format);

      video.pause();
      video.srcObject = null;
    }

    const dataUrl = await blobToDataUrl(blob);
    const sizeKB = Math.round(blob.size / 1024);

    return {
      dataUrl,
      blob,
      mime: format === 'png' ? 'image/png' : 'image/jpeg',
      format,
      filename,
      width,
      height,
      sizeKB,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    // Always release the stream — removes the browser's recording indicator
    stream?.getTracks().forEach(t => t.stop());
  }
}

/**
 * Upload a captured screenshot to the server.
 * Validates that the blob is PNG or JPEG before sending.
 * Returns the server-side image URL.
 */
export async function uploadScreenshot(
  capture: CaptureResult,
  userId: string
): Promise<string> {
  // Client-side type guard — server also validates
  if (!['image/png', 'image/jpeg'].includes(capture.mime)) {
    throw new Error(`Invalid image format: ${capture.mime}. Only PNG and JPEG are accepted.`);
  }

  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);
  const formData = new FormData();
  formData.append('screenshot', capture.blob, capture.filename);
  formData.append('userId', safeUser);
  formData.append('format', capture.format);
  formData.append('sizeKB', String(capture.sizeKB));

  const res = await fetch('/api/upload-screenshot', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `Upload failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.image_url as string;
}
