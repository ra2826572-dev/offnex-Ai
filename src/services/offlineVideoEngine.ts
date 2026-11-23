import { ImageAspectRatio, ImageQuality, ImageStyle } from '../types';
import { generateOfflineImages } from './offlineImageEngine';

export interface VideoGenerationRequest {
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality?: ImageQuality;
  durationSec?: number;
  baseImageDataUrl?: string;
  offlineMode?: boolean;
}

export interface GeneratedVideoResult {
  videoUrl: string;
  posterUrl: string;
  mimeType: string;
  durationSec: number;
  modelUsed: string;
  mode: 'online' | 'offline';
}

function getVideoDimensions(aspectRatio: ImageAspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case '16:9':
      return { width: 854, height: 480 };
    case '9:16':
      return { width: 480, height: 854 };
    case '4:3':
      return { width: 720, height: 540 };
    case '1:1':
    default:
      return { width: 640, height: 640 };
  }
}

function loadBitmap(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // Ignore probe failure
    }
  }
  return '';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to encode generated video.'));
    reader.readAsDataURL(blob);
  });
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: string;
}

function createParticles(prompt: string, w: number, h: number): Particle[] {
  const low = prompt.toLowerCase();
  const isRain = /\b(rain|storm|barish|monsoon|thunder)\b/i.test(low);
  const isSnow = /\b(snow|winter|ice|baraf|cold)\b/i.test(low);
  const isFire = /\b(fire|sunset|sunrise|lava|spark|night|city|neon|cyberpunk)\b/i.test(low);
  const count = isRain ? 70 : isSnow ? 55 : 42;

  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    if (isRain) {
      list.push({
        x,
        y,
        vx: -1.8,
        vy: 8 + Math.random() * 6,
        size: 1.5,
        alpha: 0.35 + Math.random() * 0.4,
        hue: '#BAE6FD',
      });
    } else if (isSnow) {
      list.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 1.2 + Math.random() * 1.8,
        size: 2 + Math.random() * 3,
        alpha: 0.45 + Math.random() * 0.45,
        hue: '#FFFFFF',
      });
    } else if (isFire) {
      list.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.1,
        vy: -(0.7 + Math.random() * 1.5),
        size: 1.8 + Math.random() * 3.2,
        alpha: 0.35 + Math.random() * 0.55,
        hue: i % 2 === 0 ? '#FBBF24' : '#A78BFA',
      });
    } else {
      list.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(0.35 + Math.random() * 0.9),
        size: 1.5 + Math.random() * 2.8,
        alpha: 0.25 + Math.random() * 0.45,
        hue: i % 2 === 0 ? '#C4B5FD' : '#38BDF8',
      });
    }
  }
  return list;
}

export async function generatePlayableVideo(
  req: VideoGenerationRequest
): Promise<GeneratedVideoResult> {
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    throw new Error('Video studio requires a browser environment.');
  }

  const durationSec = Math.min(8, Math.max(3, req.durationSec ?? 4));
  const { width, height } = getVideoDimensions(req.aspectRatio);
  const mode: 'online' | 'offline' = req.offlineMode ? 'offline' : 'online';

  // Ensure we always have a rich visual scene image as base frame (safe for canvas export)
  let baseSrc = req.baseImageDataUrl;
  if (baseSrc && /^https?:\/\//i.test(baseSrc) && !baseSrc.startsWith(window.location.origin)) {
    baseSrc = `/api/pinterest/image?url=${encodeURIComponent(baseSrc)}`;
  }
  let baseImg = baseSrc ? await loadBitmap(baseSrc) : null;

  // Verify baseImg doesn't taint canvas before starting MediaRecorder
  if (baseImg) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 4;
      probe.height = 4;
      const pCtx = probe.getContext('2d');
      pCtx?.drawImage(baseImg, 0, 0, 4, 4);
      probe.toDataURL('image/png');
    } catch {
      baseImg = null;
    }
  }

  if (!baseImg) {
    const generated = await generateOfflineImages({
      prompt: req.prompt,
      style: req.style,
      aspectRatio: req.aspectRatio,
      quality: req.quality || 'standard',
      count: 1,
    });
    baseSrc = generated[0]?.dataUrl || '';
    baseImg = baseSrc ? await loadBitmap(baseSrc) : null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize video canvas renderer.');
  }

  const particles = createParticles(req.prompt, width, height);
  const isRain = /\b(rain|storm|barish|monsoon|thunder)\b/i.test(req.prompt);
  const caption = req.prompt.trim().slice(0, 56);

  const drawFrame = (progress: number) => {
    ctx.clearRect(0, 0, width, height);

    // 1. Base background & Ken Burns pan + smooth zoom
    if (baseImg) {
      const imgAspect = (baseImg.naturalWidth || width) / (baseImg.naturalHeight || height);
      const canvasAspect = width / height;
      let drawW = width;
      let drawH = height;
      if (imgAspect > canvasAspect) {
        drawH = height;
        drawW = height * imgAspect;
      } else {
        drawW = width;
        drawH = width / imgAspect;
      }

      const zoom = 1.04 + Math.sin(progress * Math.PI) * 0.1;
      const panX = (progress - 0.5) * width * 0.06;
      const panY = Math.cos(progress * Math.PI) * height * 0.025;

      ctx.save();
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(zoom, zoom);
      ctx.drawImage(baseImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#090B1A');
      bg.addColorStop(0.5, '#221854');
      bg.addColorStop(1, '#0D132B');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Dynamic atmospheric light sweep
    const sweepX = width * (0.15 + progress * 0.7);
    const sweepY = height * (0.28 + Math.sin(progress * Math.PI * 2) * 0.06);
    const glow = ctx.createRadialGradient(sweepX, sweepY, 4, sweepX, sweepY, width * 0.45);
    glow.addColorStop(0, 'rgba(167, 139, 250, 0.22)');
    glow.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // 3. Motion particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.save();
      ctx.globalAlpha = p.alpha * (0.7 + 0.3 * Math.sin(progress * Math.PI * 4 + p.x));
      if (isRain) {
        ctx.strokeStyle = p.hue;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 1.4);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.hue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Subtle cinematic vignette & animated caption bar
    const vig = ctx.createLinearGradient(0, height * 0.68, 0, height);
    vig.addColorStop(0, 'rgba(7, 9, 20, 0)');
    vig.addColorStop(1, 'rgba(7, 9, 20, 0.78)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, height * 0.68, width, height * 0.32);

    const fade = Math.min(1, progress * 5) * Math.min(1, (1 - progress) * 5 + 0.35);
    ctx.save();
    ctx.globalAlpha = Math.max(0.2, Math.min(1, fade));
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.max(14, Math.round(width * 0.026))}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(caption, Math.round(width * 0.045), height - Math.round(height * 0.065));

    // Smooth playback bar along very bottom edge
    ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
    ctx.fillRect(0, height - 3, width * progress, 3);
    ctx.restore();
  };

  // Capture initial poster frame
  drawFrame(0.18);
  const posterUrl = canvas.toDataURL('image/jpeg', 0.88);

  const mimeType = pickSupportedMimeType();
  if (!mimeType || typeof canvas.captureStream !== 'function') {
    throw new Error('This browser does not support video recording captureStream.');
  }

  const stream = canvas.captureStream(24);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 1_200_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  const recordedBlob = await new Promise<Blob>((resolve, reject) => {
    const startTime = performance.now();
    const totalMs = durationSec * 1000;
    let rafId = 0;
    let stopped = false;

    recorder.onstop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' });
      if (blob.size === 0) {
        reject(new Error('Recorded video was empty.'));
      } else {
        resolve(blob);
      }
    };

    recorder.onerror = () => {
      if (rafId) cancelAnimationFrame(rafId);
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error('Video recording failed.'));
    };

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalMs);
      drawFrame(progress);

      if (elapsed < totalMs) {
        rafId = requestAnimationFrame(step);
      } else if (!stopped) {
        stopped = true;
        try {
          recorder.stop();
        } catch {
          // Already stopped
        }
      }
    };

    recorder.start(150);
    rafId = requestAnimationFrame(step);
  });

  const videoUrl = await blobToDataUrl(recordedBlob);

  return {
    videoUrl,
    posterUrl,
    mimeType: recordedBlob.type || 'video/webm',
    durationSec,
    modelUsed: mode === 'offline' ? 'Offnex Video Studio (Offline)' : 'Offnex Video Studio (Hybrid)',
    mode,
  };
}

export function downloadGeneratedVideo(videoUrl: string, baseFileName: string): void {
  const safeName = (baseFileName || 'offnex_ai_video')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 48);
  const link = document.createElement('a');
  link.href = videoUrl;
  link.download = `${safeName}.webm`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
