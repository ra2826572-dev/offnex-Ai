import {
  GeneratedImageItem,
  ImageAspectRatio,
  ImageQuality,
  ImageStyle,
} from '../types';

export interface OfflineImageRequest {
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
  count: number;
  referenceImage?: {
    data: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let s = seed || 123456789;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function getDimensions(aspectRatio: ImageAspectRatio, quality: ImageQuality): { width: number; height: number } {
  const high = quality === 'high';
  switch (aspectRatio) {
    case '16:9':
      return high ? { width: 1280, height: 720 } : { width: 1024, height: 576 };
    case '9:16':
      return high ? { width: 720, height: 1280 } : { width: 576, height: 1024 };
    case '4:3':
      return high ? { width: 1200, height: 900 } : { width: 960, height: 720 };
    case '1:1':
    default:
      return high ? { width: 1080, height: 1080 } : { width: 896, height: 896 };
  }
}

type ThemePalette = {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accent1: string;
  accent2: string;
  highlight: string;
  ground1: string;
  ground2: string;
  motif: 'cosmos' | 'mountain' | 'ocean' | 'city' | 'forest' | 'logo' | 'product' | 'abstract';
};

function selectTheme(prompt: string, style: ImageStyle, variantIndex: number): ThemePalette {
  const p = prompt.toLowerCase();

  let motif: ThemePalette['motif'] = 'abstract';
  if (style === 'Logo Design' || /\b(logo|emblem|brand|icon|badge|monogram)\b/i.test(p)) {
    motif = 'logo';
  } else if (style === 'Product Photography' || /\b(product|bottle|watch|perfume|phone|headphone|shoe|mug|gadget)\b/i.test(p)) {
    motif = 'product';
  } else if (/\b(space|galaxy|nebula|cosmos|planet|star|astronaut|moon|universe)\b/i.test(p)) {
    motif = 'cosmos';
  } else if (/\b(city|cyberpunk|neon|building|skyline|street|tower|futuristic|metropolis)\b/i.test(p)) {
    motif = 'city';
  } else if (/\b(ocean|sea|water|beach|wave|island|river|lake|ship)\b/i.test(p)) {
    motif = 'ocean';
  } else if (/\b(forest|tree|jungle|nature|garden|flower|green|park|leaf)\b/i.test(p)) {
    motif = 'forest';
  } else if (/\b(mountain|hill|sunset|sunrise|desert|valley|landscape|sky|clouds|k2|lahore|islamabad|castle)\b/i.test(p)) {
    motif = 'mountain';
  } else if (style === 'Realistic Photography' || style === 'Cinematic') {
    motif = variantIndex % 2 === 0 ? 'mountain' : 'city';
  } else if (style === '3D Rendering') {
    motif = 'product';
  } else if (style === 'Anime') {
    motif = 'city';
  }

  // Distinct rich palettes matching prompt color words or variant
  if (/\b(sunset|sunrise|fire|red|orange|gold|desert|autumn|warm)\b/i.test(p)) {
    return {
      skyTop: '#1A0B2E',
      skyMid: '#7B1E58',
      skyBottom: '#F97316',
      accent1: '#FBBF24',
      accent2: '#FB7185',
      highlight: '#FEF08A',
      ground1: '#2A103B',
      ground2: '#11061D',
      motif,
    };
  }
  if (/\b(forest|emerald|green|nature|jungle|tree|leaf)\b/i.test(p)) {
    return {
      skyTop: '#062022',
      skyMid: '#0F4C4A',
      skyBottom: '#34D399',
      accent1: '#A7F3D0',
      accent2: '#38BDF8',
      highlight: '#ECFDF5',
      ground1: '#0A2E2A',
      ground2: '#041413',
      motif,
    };
  }
  if (/\b(cyberpunk|neon|purple|violet|gaming|futuristic|synth)\b/i.test(p) || variantIndex % 3 === 1) {
    return {
      skyTop: '#09061A',
      skyMid: '#2D146B',
      skyBottom: '#7547FF',
      accent1: '#22D3EE',
      accent2: '#F472B6',
      highlight: '#E0E7FF',
      ground1: '#140B33',
      ground2: '#070414',
      motif,
    };
  }
  if (/\b(ocean|sea|ice|winter|arctic|blue|aqua)\b/i.test(p) || variantIndex % 3 === 2) {
    return {
      skyTop: '#051226',
      skyMid: '#0C356A',
      skyBottom: '#38BDF8',
      accent1: '#7DD3FC',
      accent2: '#818CF8',
      highlight: '#F0F9FF',
      ground1: '#08203E',
      ground2: '#030B1A',
      motif,
    };
  }

  return {
    skyTop: '#0B0B1E',
    skyMid: '#251B5B',
    skyBottom: '#6D28D9',
    accent1: '#38BDF8',
    accent2: '#C084FC',
    highlight: '#F5F3FF',
    ground1: '#141236',
    ground2: '#070714',
    motif,
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawMountainScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  rng: () => number
) {
  // Glowing sun/moon
  const sunX = w * (0.3 + rng() * 0.4);
  const sunY = h * (0.28 + rng() * 0.14);
  const sunR = Math.min(w, h) * 0.16;

  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.15, sunX, sunY, sunR * 2.8);
  halo.addColorStop(0, pal.highlight);
  halo.addColorStop(0.35, pal.accent1 + '88');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  const sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
  sunGrad.addColorStop(0, pal.highlight);
  sunGrad.addColorStop(1, pal.accent1);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Layered distant mountains
  const layers = [
    { baseY: h * 0.56, amp: h * 0.16, color: pal.skyMid + 'CC' },
    { baseY: h * 0.66, amp: h * 0.14, color: pal.ground1 },
    { baseY: h * 0.78, amp: h * 0.12, color: pal.ground2 },
  ];

  layers.forEach((layer, idx) => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    const steps = 10 + idx * 3;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const peak = Math.sin(i * 1.4 + rng() * 2.5) * 0.5 + 0.5;
      const y = layer.baseY - peak * layer.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = layer.color;
    ctx.fill();
  });

  // Reflective lake shimmer in foreground
  const waterGrad = ctx.createLinearGradient(0, h * 0.78, 0, h);
  waterGrad.addColorStop(0, pal.accent1 + '33');
  waterGrad.addColorStop(1, pal.ground2);
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, h * 0.84, w, h * 0.16);

  ctx.fillStyle = pal.highlight + '55';
  for (let i = 0; i < 18; i++) {
    const rw = w * (0.04 + rng() * 0.12);
    const rx = sunX - rw / 2 + (rng() - 0.5) * sunR;
    const ry = h * (0.85 + rng() * 0.13);
    ctx.fillRect(rx, ry, rw, 2 + rng() * 2);
  }
}

function drawCityScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  rng: () => number
) {
  // Neon orbital ring / moon in sky
  const moonX = w * (0.25 + rng() * 0.5);
  const moonY = h * 0.28;
  const moonR = Math.min(w, h) * 0.15;
  const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2.6);
  glow.addColorStop(0, pal.accent2 + 'AA');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = pal.highlight;
  ctx.fill();

  // Horizon perspective grid
  ctx.strokeStyle = pal.accent1 + '44';
  ctx.lineWidth = 1.5;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * (w * 0.04), h * 0.72);
    ctx.lineTo(w / 2 + i * (w * 0.16), h);
    ctx.stroke();
  }

  // Skyline buildings
  let x = 0;
  while (x < w) {
    const bw = Math.max(32, w * (0.05 + rng() * 0.07));
    const bh = h * (0.22 + rng() * 0.36);
    const by = h * 0.78 - bh;

    ctx.fillStyle = '#0D1026';
    ctx.fillRect(x, by, bw - 2, bh + h * 0.22);

    // Roof neon accent
    ctx.fillStyle = rng() > 0.5 ? pal.accent1 : pal.accent2;
    ctx.fillRect(x, by, bw - 2, 3);

    // Lit skyscraper windows
    const cols = Math.max(2, Math.floor(bw / 14));
    const rows = Math.max(4, Math.floor(bh / 18));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() > 0.48) {
          ctx.fillStyle = rng() > 0.3 ? pal.highlight + 'AA' : pal.accent1 + 'CC';
          ctx.fillRect(x + 6 + c * 12, by + 10 + r * 16, 6, 8);
        }
      }
    }
    x += bw;
  }

  // Wet street reflections at bottom
  const roadGrad = ctx.createLinearGradient(0, h * 0.78, 0, h);
  roadGrad.addColorStop(0, pal.ground1);
  roadGrad.addColorStop(1, '#050611');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = (i % 2 === 0 ? pal.accent1 : pal.accent2) + '55';
    ctx.fillRect(rng() * w, h * (0.8 + rng() * 0.18), 18 + rng() * 70, 3);
  }
}

function drawOceanScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  rng: () => number
) {
  const sunX = w * 0.5;
  const sunY = h * 0.44;
  const sunR = Math.min(w, h) * 0.14;

  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
  halo.addColorStop(0, pal.highlight);
  halo.addColorStop(0.4, pal.accent1 + '66');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = pal.highlight;
  ctx.fill();

  // Ocean waves
  for (let layer = 0; layer < 5; layer++) {
    const baseY = h * (0.52 + layer * 0.095);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 24) {
      const y = baseY + Math.sin(x * 0.015 + layer * 1.3) * (12 + layer * 3);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = layer % 2 === 0 ? pal.ground1 : pal.ground2;
    ctx.fill();

    // Foam highlight
    ctx.strokeStyle = pal.accent1 + '66';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Sun reflection streak on water
  for (let i = 0; i < 22; i++) {
    const rw = (22 - i) * 7 + rng() * 30;
    ctx.fillStyle = pal.highlight + '55';
    ctx.fillRect(sunX - rw / 2 + (rng() - 0.5) * 20, h * 0.54 + i * ((h * 0.42) / 22), rw, 3);
  }
}

function drawCosmosScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  rng: () => number
) {
  // Nebula clouds
  for (let i = 0; i < 4; i++) {
    const nx = w * (0.2 + rng() * 0.6);
    const ny = h * (0.2 + rng() * 0.6);
    const nr = Math.max(w, h) * (0.25 + rng() * 0.25);
    const neb = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    neb.addColorStop(0, (i % 2 === 0 ? pal.accent1 : pal.accent2) + '55');
    neb.addColorStop(1, 'transparent');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);
  }

  // Hero Planet
  const px = w * 0.52;
  const py = h * 0.48;
  const pr = Math.min(w, h) * 0.22;

  // Planet ring
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.28);
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI * 2);
  ctx.strokeStyle = pal.accent1 + 'AA';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  const pGrad = ctx.createLinearGradient(px - pr, py - pr, px + pr, py + pr);
  pGrad.addColorStop(0, pal.highlight);
  pGrad.addColorStop(0.4, pal.accent2);
  pGrad.addColorStop(1, '#09071A');
  ctx.fillStyle = pGrad;
  ctx.fill();
}

function drawForestScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  rng: () => number
) {
  // Volumetric light beams
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const beam = ctx.createLinearGradient(w * (0.2 + i * 0.15), 0, w * (0.35 + i * 0.15), h);
    beam.addColorStop(0, pal.highlight + '2A');
    beam.addColorStop(1, 'transparent');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(w * (0.15 + i * 0.16), 0);
    ctx.lineTo(w * (0.24 + i * 0.16), 0);
    ctx.lineTo(w * (0.42 + i * 0.16), h);
    ctx.lineTo(w * (0.26 + i * 0.16), h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Hills + pine silhouettes
  ctx.fillStyle = pal.ground1;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  const count = 26;
  for (let i = 0; i < count; i++) {
    const tx = (i / count) * w + rng() * 25;
    const th = h * (0.18 + rng() * 0.28);
    const tw = th * 0.42;
    const ty = h * 0.85;
    ctx.fillStyle = i % 2 === 0 ? pal.ground1 : pal.ground2;
    ctx.beginPath();
    ctx.moveTo(tx, ty - th);
    ctx.lineTo(tx - tw / 2, ty);
    ctx.lineTo(tx + tw / 2, ty);
    ctx.closePath();
    ctx.fill();
  }

  // Glowing fireflies
  for (let i = 0; i < 36; i++) {
    const fx = rng() * w;
    const fy = h * (0.35 + rng() * 0.55);
    const fr = 2 + rng() * 5;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 3);
    fg.addColorStop(0, pal.highlight);
    fg.addColorStop(1, 'transparent');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLogoOrProductScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  isLogo: boolean,
  prompt: string,
  rng: () => number
) {
  const cx = w / 2;
  const cy = h * 0.46;
  const r = Math.min(w, h) * 0.24;

  // Radial studio spotlight
  const spot = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.2);
  spot.addColorStop(0, pal.accent1 + '66');
  spot.addColorStop(0.5, pal.accent2 + '22');
  spot.addColorStop(1, 'transparent');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  if (isLogo) {
    // Hexagonal + orbital vector crest
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const crestGrad = ctx.createLinearGradient(-r, -r, r, r);
    crestGrad.addColorStop(0, pal.accent1);
    crestGrad.addColorStop(1, pal.accent2);
    ctx.fillStyle = crestGrad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = pal.highlight;
    ctx.stroke();

    // Inner monogram letter from prompt
    const letter = (prompt.trim().match(/[A-Za-z]/)?.[0] || 'O').toUpperCase();
    ctx.fillStyle = '#0A0B18';
    ctx.font = `900 ${Math.round(r * 0.9)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 6);
    ctx.restore();
  } else {
    // 3D studio pedestal & glassmorphic sphere
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 1.15, r * 1.35, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#070917';
    ctx.fill();
    ctx.strokeStyle = pal.accent1 + '88';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Primary 3D shaded orb + floating secondary geometry
    const orbGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.08, cx, cy, r);
    orbGrad.addColorStop(0, '#FFFFFF');
    orbGrad.addColorStop(0.28, pal.accent1);
    orbGrad.addColorStop(0.75, pal.accent2);
    orbGrad.addColorStop(1, '#120C2E');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = orbGrad;
    ctx.fill();

    // Floating orbiting rings/spheres
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i + rng();
      const ox = cx + Math.cos(ang) * r * 1.4;
      const oy = cy + Math.sin(ang) * r * 0.7;
      const sr = r * (0.14 + rng() * 0.12);
      ctx.beginPath();
      ctx.arc(ox, oy, sr, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? pal.accent1 : pal.highlight;
      ctx.fill();
    }
  }
}

function drawAbstractScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: ThemePalette,
  rng: () => number
) {
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const startY = h * (0.2 + i * 0.13);
    ctx.moveTo(0, startY);
    ctx.bezierCurveTo(
      w * (0.25 + rng() * 0.1),
      startY - h * 0.22,
      w * (0.65 + rng() * 0.1),
      startY + h * 0.22,
      w,
      startY - (rng() - 0.5) * h * 0.2
    );
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = (i % 2 === 0 ? pal.accent1 : pal.accent2) + '30';
    ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    const cx = w * (0.15 + rng() * 0.7);
    const cy = h * (0.18 + rng() * 0.62);
    const cr = Math.min(w, h) * (0.08 + rng() * 0.16);
    const grad = ctx.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 4, cx, cy, cr);
    grad.addColorStop(0, pal.highlight);
    grad.addColorStop(0.5, i % 2 === 0 ? pal.accent1 : pal.accent2);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

export async function generateOfflineImages(req: OfflineImageRequest): Promise<GeneratedImageItem[]> {
  if (typeof document === 'undefined') {
    return [];
  }

  const count = Math.max(1, Math.min(4, req.count || 1));
  const { width, height } = getDimensions(req.aspectRatio, req.quality);
  const refImgElement = req.referenceImage
    ? await loadImage(`data:${req.referenceImage.mimeType};base64,${req.referenceImage.data}`)
    : null;

  const items: GeneratedImageItem[] = [];

  for (let idx = 0; idx < count; idx++) {
    const seed = hashSeed(`${req.prompt}::${req.style}::${req.aspectRatio}::${idx}`);
    const rng = createRng(seed);
    const pal = selectTheme(req.prompt, req.style, idx);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // 1. Sky / Studio Gradient Base
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, pal.skyTop);
    bgGrad.addColorStop(0.55, pal.skyMid);
    bgGrad.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. If user uploaded a reference image, blend it artfully as underlayer
    if (refImgElement) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      const scale = Math.max(width / refImgElement.width, height / refImgElement.height);
      const dw = refImgElement.width * scale;
      const dh = refImgElement.height * scale;
      ctx.drawImage(refImgElement, (width - dw) / 2, (height - dh) / 2, dw, dh);
      ctx.restore();
    }

    // 3. Stars / atmospheric dust particles
    const starCount = req.quality === 'high' ? 95 : 60;
    for (let s = 0; s < starCount; s++) {
      const sx = rng() * width;
      const sy = rng() * height * 0.7;
      const sr = 0.8 + rng() * 2.2;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.7})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Motif Artwork
    switch (pal.motif) {
      case 'mountain':
        drawMountainScene(ctx, width, height, pal, rng);
        break;
      case 'city':
        drawCityScene(ctx, width, height, pal, rng);
        break;
      case 'ocean':
        drawOceanScene(ctx, width, height, pal, rng);
        break;
      case 'cosmos':
        drawCosmosScene(ctx, width, height, pal, rng);
        break;
      case 'forest':
        drawForestScene(ctx, width, height, pal, rng);
        break;
      case 'logo':
        drawLogoOrProductScene(ctx, width, height, pal, true, req.prompt, rng);
        break;
      case 'product':
        drawLogoOrProductScene(ctx, width, height, pal, false, req.prompt, rng);
        break;
      case 'abstract':
      default:
        drawAbstractScene(ctx, width, height, pal, rng);
        break;
    }

    // 5. Style Post-Processing
    if (req.style === 'Cinematic') {
      const barH = Math.round(height * 0.06);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, barH);
      ctx.fillRect(0, height - barH, width, barH);
    } else if (req.style === 'Anime' || req.style === 'Illustration') {
      // Crisp cel-style diagonal shine streaks
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const lx = rng() * width;
        const ly = rng() * height;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 90, ly - 55);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Subtle cinematic vignette
    const vig = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78
    );
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(3,4,12,0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    items.push({
      id: `offline-img-${Date.now()}-${idx}`,
      dataUrl: canvas.toDataURL('image/png'),
      mimeType: 'image/png',
    });
  }

  return items;
}
