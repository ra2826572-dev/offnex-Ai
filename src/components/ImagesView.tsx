'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Wand2,
  SlidersHorizontal,
  Download,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Maximize2,
  RotateCw,
  AlertCircle,
  WifiOff,
  X,
  Sparkles,
  Image as ImageIcon,
  Calendar,
} from 'lucide-react';
import {
  GeneratedImageRecord,
  ImageAspectRatio,
  ImageQuality,
  ImageStyle,
} from '../types';
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_STYLES,
  ImageCapabilities,
  LocalImageStatus,
  ValidatedReferenceImage,
  downloadGeneratedImage,
  fetchImageCapabilities,
  fetchLocalImageStatus,
  validateAndReadReferenceImage,
} from '../services/imageService';
import { ImageGenerationSubmitPayload } from './ChatView';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ImagesViewProps {
  imageHistory: GeneratedImageRecord[];
  isGeneratingImage: boolean;
  lastImageError: string | null;
  onClearError: () => void;
  onGenerateImage: (payload: ImageGenerationSubmitPayload, addToChat?: boolean) => Promise<void>;
  onDeleteImageHistory: (id: string) => void;
  offlineStrict: boolean;
  onDisableOfflineMode?: () => void;
  userId?: string;
}

interface PresetCardItem {
  id: string;
  title: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  prompt: string;
  gradient: string;
  accent: string;
  motif:
    | 'anime-heart'
    | 'aerial'
    | 'tin'
    | 'retro80s'
    | 'caricature'
    | 'sketch'
    | 'stickers'
    | 'photobooth'
    | 'y2k'
    | 'anime'
    | 'portrait70s'
    | 'impressionist'
    | 'pins'
    | 'underwater'
    | 'avatar3d'
    | 'logo'
    | 'product'
    | 'social'
    | 'cinematic';
}

const TRENDING_PRESETS: PresetCardItem[] = [
  {
    id: 'anime-reaction',
    title: 'Anime reaction',
    style: 'Anime',
    aspectRatio: '1:1',
    prompt: 'Expressive cheerful anime character with sparkling heart eyes and dynamic comic background',
    gradient: 'from-rose-500/30 via-pink-500/20 to-amber-400/20',
    accent: '#FB7185',
    motif: 'anime-heart',
  },
  {
    id: 'aerial-view',
    title: 'Aerial view',
    style: 'Realistic Photography',
    aspectRatio: '1:1',
    prompt: 'Top-down drone aerial photography of a tiny puppy sitting in sunlit emerald green grass',
    gradient: 'from-emerald-600/40 via-green-700/30 to-lime-900/40',
    accent: '#34D399',
    motif: 'aerial',
  },
  {
    id: 'collectors-tin',
    title: "Collector's tin",
    style: 'Product Photography',
    aspectRatio: '1:1',
    prompt: 'Open vintage metal keepsake collector tin filled with mini polaroid photos, pressed flowers, and souvenirs on sage background',
    gradient: 'from-teal-700/35 via-emerald-800/30 to-stone-700/40',
    accent: '#5EEAD4',
    motif: 'tin',
  },
  {
    id: '80s-flashback',
    title: "'80s flashback",
    style: 'Realistic Photography',
    aspectRatio: '1:1',
    prompt: 'Retro 1980s studio portrait with denim jacket, sunglasses, warm film grain, and nostalgic backdrop',
    gradient: 'from-amber-700/35 via-stone-700/40 to-orange-900/35',
    accent: '#FBBF24',
    motif: 'retro80s',
  },
  {
    id: 'caricature',
    title: 'Caricature',
    style: 'Digital Art',
    aspectRatio: '1:1',
    prompt: 'Charming stylized 3D caricature portrait of a creative explorer holding a sketchbook and paint palette under blue sky',
    gradient: 'from-sky-500/35 via-blue-600/25 to-indigo-700/35',
    accent: '#38BDF8',
    motif: 'caricature',
  },
  {
    id: 'sketch',
    title: 'Sketch',
    style: 'Illustration',
    aspectRatio: '1:1',
    prompt: 'Minimalist hand-drawn ink and watercolor marker sketch of a daisy flower and tiny bumblebee on textured cream paper',
    gradient: 'from-slate-200/20 via-amber-100/15 to-zinc-400/20',
    accent: '#FDE047',
    motif: 'sketch',
  },
  {
    id: 'stickers',
    title: 'Stickers',
    style: 'Illustration',
    aspectRatio: '1:1',
    prompt: 'Cute die-cut vinyl sticker pack sheet featuring a black cat, potted houseplant, and smiling character on bright yellow background',
    gradient: 'from-yellow-500/35 via-amber-500/25 to-orange-500/30',
    accent: '#FACC15',
    motif: 'stickers',
  },
  {
    id: 'photo-booth',
    title: 'Photo booth',
    style: 'Realistic Photography',
    aspectRatio: '1:1',
    prompt: 'Candid black and white vintage photo booth flash portrait with crisp contrast and joyful expressions',
    gradient: 'from-zinc-600/40 via-neutral-700/40 to-stone-900/50',
    accent: '#E4E4E7',
    motif: 'photobooth',
  },
  {
    id: 'y2k-digicam',
    title: 'Y2K digicam',
    style: 'Realistic Photography',
    aspectRatio: '1:1',
    prompt: 'Early 2000s Y2K digital camera flash snapshot with silver headphones, pastel velour jacket, and retro aesthetic',
    gradient: 'from-fuchsia-600/35 via-pink-500/25 to-slate-700/35',
    accent: '#F472B6',
    motif: 'y2k',
  },
  {
    id: 'anime',
    title: 'Anime',
    style: 'Anime',
    aspectRatio: '1:1',
    prompt: 'Classic 90s cel-shaded anime hero pointing confidently against a dramatic twilight city gradient',
    gradient: 'from-indigo-600/40 via-blue-700/30 to-amber-500/25',
    accent: '#818CF8',
    motif: 'anime',
  },
  {
    id: '70s-portrait',
    title: '70s portrait',
    style: 'Cinematic',
    aspectRatio: '1:1',
    prompt: 'Warm golden-hour 1970s 35mm film portrait with aviator glasses, corduroy jacket, and soft bokeh',
    gradient: 'from-orange-700/40 via-amber-800/35 to-stone-800/40',
    accent: '#FB923C',
    motif: 'portrait70s',
  },
  {
    id: 'impressionist',
    title: 'Impressionist painting',
    style: 'Digital Art',
    aspectRatio: '1:1',
    prompt: 'Luminous oil impasto impressionist painting overlooking a sunlit Mediterranean cliffside sea at sunset',
    gradient: 'from-blue-600/35 via-amber-500/30 to-orange-600/35',
    accent: '#60A5FA',
    motif: 'impressionist',
  },
  {
    id: 'pin-collection',
    title: 'Pin collection',
    style: 'Illustration',
    aspectRatio: '1:1',
    prompt: 'Flat lay collection of colorful enamel lapel pins on a textured violet fabric board',
    gradient: 'from-purple-600/40 via-violet-700/35 to-indigo-800/40',
    accent: '#C084FC',
    motif: 'pins',
  },
  {
    id: 'underwater',
    title: 'Underwater',
    style: 'Cinematic',
    aspectRatio: '1:1',
    prompt: 'Dreamy underwater sunlight caustics shimmering across clear turquoise water and floating bubbles',
    gradient: 'from-cyan-600/40 via-teal-700/35 to-sky-900/40',
    accent: '#22D3EE',
    motif: 'underwater',
  },
  {
    id: '3d-avatar',
    title: '3D avatar',
    style: '3D Rendering',
    aspectRatio: '1:1',
    prompt: 'Stylized glossy 3D character avatar wearing orange translucent sunglasses with vibrant sky backdrop',
    gradient: 'from-blue-500/40 via-cyan-500/30 to-indigo-600/35',
    accent: '#38BDF8',
    motif: 'avatar3d',
  },
];

const TEMPLATE_PRESETS: PresetCardItem[] = [
  {
    id: 'tpl-logo',
    title: 'Modern Brand Logo',
    style: 'Logo Design',
    aspectRatio: '1:1',
    prompt: 'Minimalist geometric emblem logo for a next-generation AI technology company, indigo and electric violet gradient on dark obsidian background',
    gradient: 'from-violet-600/40 via-purple-700/35 to-indigo-900/45',
    accent: '#A78BFA',
    motif: 'logo',
  },
  {
    id: 'tpl-product',
    title: 'Studio Product Shot',
    style: 'Product Photography',
    aspectRatio: '4:3',
    prompt: 'Luxury commercial product photography of matte black wireless headphones floating over dark reflective slate with soft rim lighting',
    gradient: 'from-slate-700/40 via-indigo-900/35 to-zinc-900/50',
    accent: '#818CF8',
    motif: 'product',
  },
  {
    id: 'tpl-social',
    title: 'Social Media Poster',
    style: 'Social Media Graphics',
    aspectRatio: '9:16',
    prompt: 'High-impact modern launch poster with bold geometric 3D glass shapes, neon purple glow, and clean negative space for typography',
    gradient: 'from-fuchsia-600/40 via-purple-700/35 to-blue-800/40',
    accent: '#E879F9',
    motif: 'social',
  },
  {
    id: 'tpl-cinematic',
    title: 'Cinematic Film Still',
    style: 'Cinematic',
    aspectRatio: '16:9',
    prompt: 'Anamorphic widescreen sci-fi scene of a lone traveler overlooking a glowing futuristic megacity through misty rain',
    gradient: 'from-cyan-700/35 via-indigo-900/45 to-purple-900/45',
    accent: '#22D3EE',
    motif: 'cinematic',
  },
  {
    id: 'tpl-3d',
    title: '3D Isometric Scene',
    style: '3D Rendering',
    aspectRatio: '1:1',
    prompt: 'Cute isometric 3D render of a cozy night-time developer desk with glowing dual monitors, plants, and warm desk lamp',
    gradient: 'from-indigo-600/40 via-blue-800/35 to-purple-900/40',
    accent: '#60A5FA',
    motif: 'avatar3d',
  },
  {
    id: 'tpl-photo',
    title: 'Editorial Portrait',
    style: 'Realistic Photography',
    aspectRatio: '4:3',
    prompt: 'Natural-light 85mm editorial photography of an architect in a sunlit modern glass studio, shallow depth of field',
    gradient: 'from-amber-600/30 via-stone-700/35 to-slate-800/45',
    accent: '#FBBF24',
    motif: 'portrait70s',
  },
  {
    id: 'tpl-digital',
    title: 'Fantasy Concept Art',
    style: 'Digital Art',
    aspectRatio: '16:9',
    prompt: 'Epic digital concept art of floating crystal islands linked by glowing light bridges above clouds at twilight',
    gradient: 'from-purple-600/40 via-indigo-700/35 to-teal-700/30',
    accent: '#C084FC',
    motif: 'impressionist',
  },
  {
    id: 'tpl-anime',
    title: 'Anime Key Visual',
    style: 'Anime',
    aspectRatio: '16:9',
    prompt: 'Detailed anime movie key visual of cherry blossoms drifting past a hillside train station overlooking the ocean at dusk',
    gradient: 'from-pink-500/35 via-purple-600/30 to-indigo-800/40',
    accent: '#F472B6',
    motif: 'anime',
  },
  {
    id: 'tpl-illust',
    title: 'Book Illustration',
    style: 'Illustration',
    aspectRatio: '4:3',
    prompt: 'Storybook gouache illustration of a cozy woodland library inside an ancient oak tree lit by hanging lanterns',
    gradient: 'from-emerald-700/35 via-amber-700/25 to-stone-800/40',
    accent: '#34D399',
    motif: 'sketch',
  },
  {
    id: 'tpl-sticker-pack',
    title: 'Sticker & Icon Pack',
    style: 'Illustration',
    aspectRatio: '1:1',
    prompt: 'Clean vector badge and sticker pack featuring rockets, coffee cups, lightning bolts, and headphones on dark backdrop',
    gradient: 'from-yellow-500/30 via-rose-500/25 to-purple-700/35',
    accent: '#FDE047',
    motif: 'pins',
  },
];

const PresetArtwork: React.FC<{ item: PresetCardItem }> = ({ item }) => {
  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${item.gradient} overflow-hidden`}>
      {/* Ambient glow */}
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl opacity-50"
        style={{ background: item.accent }}
      />
      <div className="absolute -bottom-8 -left-6 w-28 h-28 rounded-full blur-2xl opacity-25 bg-purple-600" />

      {/* Custom crisp vector artwork per motif */}
      <svg
        viewBox="0 0 200 240"
        className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={item.accent} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#7547FF" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {item.motif === 'anime-heart' && (
          <>
            <circle cx="100" cy="95" r="48" fill="#FFE4D6" />
            <path d="M52 92 C52 46, 148 46, 148 92 C142 66, 58 66, 52 92 Z" fill="#F97316" />
            <path d="M76 88 C72 80, 62 84, 68 94 L76 102 L84 94 C90 84, 80 80, 76 88 Z" fill="#EC4899" />
            <path d="M124 88 C120 80, 110 84, 116 94 L124 102 L132 94 C138 84, 128 80, 124 88 Z" fill="#EC4899" />
            <path d="M84 114 Q100 130 116 114 Z" fill="#FB7185" />
            <path d="M48 190 C54 148, 146 148, 152 190 Z" fill="#2563EB" />
          </>
        )}

        {item.motif === 'aerial' && (
          <>
            <rect width="200" height="240" fill="#14532D" opacity="0.4" />
            <circle cx="40" cy="50" r="35" fill="#22C55E" opacity="0.22" />
            <circle cx="155" cy="140" r="45" fill="#4ADE80" opacity="0.18" />
            <ellipse cx="100" cy="122" rx="20" ry="26" fill="#D97706" />
            <circle cx="100" cy="96" r="15" fill="#F59E0B" />
            <ellipse cx="86" cy="94" rx="5" ry="9" fill="#92400E" />
            <ellipse cx="114" cy="94" rx="5" ry="9" fill="#92400E" />
          </>
        )}

        {item.motif === 'tin' && (
          <>
            <rect x="44" y="42" width="112" height="72" rx="14" fill="#E2E8F0" opacity="0.88" />
            <rect x="52" y="50" width="96" height="56" rx="10" fill="#334155" />
            <rect x="44" y="118" width="112" height="76" rx="14" fill="#CBD5E1" opacity="0.92" />
            <rect x="54" y="128" width="42" height="52" rx="6" fill="#0EA5E9" opacity="0.7" />
            <circle cx="126" cy="154" r="18" fill="#F59E0B" opacity="0.8" />
          </>
        )}

        {(item.motif === 'retro80s' || item.motif === 'portrait70s' || item.motif === 'y2k' || item.motif === 'photobooth') && (
          <>
            <circle cx="100" cy="86" r="34" fill={`url(#grad-${item.id})`} />
            <rect x="74" y="76" width="22" height="12" rx="4" fill="#0B0B16" opacity="0.85" />
            <rect x="104" y="76" width="22" height="12" rx="4" fill="#0B0B16" opacity="0.85" />
            <line x1="96" y1="81" x2="104" y2="81" stroke="#0B0B16" strokeWidth="2.5" />
            <path d="M46 196 C54 140, 146 140, 154 196 Z" fill={item.accent} opacity="0.65" />
            <circle cx="152" cy="52" r="16" stroke={item.accent} strokeWidth="2" fill="none" opacity="0.45" />
          </>
        )}

        {(item.motif === 'caricature' || item.motif === 'avatar3d') && (
          <>
            <circle cx="100" cy="100" r="46" fill={`url(#grad-${item.id})`} />
            <rect x="64" y="88" width="32" height="18" rx="7" fill="#FB923C" opacity="0.9" />
            <rect x="104" y="88" width="32" height="18" rx="7" fill="#FB923C" opacity="0.9" />
            <path d="M84 124 Q100 136 116 124" stroke="#FFF" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <circle cx="62" cy="56" r="10" fill="#FDE047" opacity="0.7" />
            <circle cx="144" cy="60" r="8" fill="#F472B6" opacity="0.7" />
          </>
        )}

        {item.motif === 'sketch' && (
          <>
            <rect x="20" y="20" width="160" height="190" rx="14" fill="#F8FAFC" opacity="0.88" />
            <line x1="100" y1="120" x2="100" y2="178" stroke="#16A34A" strokeWidth="3.5" />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <ellipse
                key={deg}
                cx="100"
                cy="74"
                rx="12"
                ry="24"
                fill="#FFFFFF"
                stroke="#1E293B"
                strokeWidth="2"
                transform={`rotate(${deg} 100 98)`}
              />
            ))}
            <circle cx="100" cy="98" r="14" fill="#FACC15" stroke="#1E293B" strokeWidth="2" />
          </>
        )}

        {(item.motif === 'stickers' || item.motif === 'pins') && (
          <>
            <circle cx="66" cy="76" r="28" fill="#FFFFFF" opacity="0.9" />
            <circle cx="66" cy="76" r="21" fill="#1E293B" />
            <circle cx="136" cy="72" r="24" fill="#FFFFFF" opacity="0.9" />
            <circle cx="136" cy="72" r="17" fill="#10B981" />
            <rect x="74" y="114" width="60" height="60" rx="16" fill="#FFFFFF" opacity="0.92" />
            <rect x="82" y="122" width="44" height="44" rx="12" fill={item.accent} />
          </>
        )}

        {(item.motif === 'anime' || item.motif === 'cinematic') && (
          <>
            <polygon points="0,180 65,110 120,160 165,95 200,180 200,240 0,240" fill="#0F172A" opacity="0.65" />
            <circle cx="144" cy="64" r="24" fill={item.accent} opacity="0.7" />
            <line x1="25" y1="54" x2="88" y2="54" stroke="#FFF" strokeWidth="2" opacity="0.35" />
            <line x1="35" y1="68" x2="74" y2="68" stroke="#FFF" strokeWidth="2" opacity="0.25" />
          </>
        )}

        {item.motif === 'impressionist' && (
          <>
            <path d="M0 140 Q60 110 120 138 T200 128 L200 240 L0 240 Z" fill="#1D4ED8" opacity="0.55" />
            <circle cx="140" cy="72" r="28" fill="#F59E0B" opacity="0.7" />
            <path d="M20 170 Q90 155 180 175" stroke="#FDE047" strokeWidth="5" fill="none" opacity="0.55" />
          </>
        )}

        {item.motif === 'underwater' && (
          <>
            <ellipse cx="100" cy="40" rx="75" ry="18" fill="#67E8F9" opacity="0.35" />
            <circle cx="64" cy="96" r="10" stroke="#A5F3FC" strokeWidth="2" fill="none" opacity="0.7" />
            <circle cx="132" cy="120" r="16" stroke="#A5F3FC" strokeWidth="2" fill="none" opacity="0.6" />
            <circle cx="96" cy="148" r="7" fill="#ECFEFF" opacity="0.6" />
          </>
        )}

        {item.motif === 'logo' && (
          <>
            <polygon points="100,44 152,74 152,134 100,164 48,134 48,74" fill="none" stroke={item.accent} strokeWidth="6" />
            <polygon points="100,66 132,84 132,124 100,142 68,124 68,84" fill={`url(#grad-${item.id})`} />
          </>
        )}

        {item.motif === 'product' && (
          <>
            <ellipse cx="100" cy="166" rx="58" ry="12" fill="#000" opacity="0.5" />
            <path d="M56 120 C56 68, 144 68, 144 120" stroke="#E2E8F0" strokeWidth="10" fill="none" strokeLinecap="round" />
            <rect x="46" y="108" width="22" height="40" rx="10" fill={item.accent} />
            <rect x="132" y="108" width="22" height="40" rx="10" fill={item.accent} />
          </>
        )}

        {item.motif === 'social' && (
          <>
            <rect x="42" y="42" width="116" height="148" rx="18" fill="#1E1B4B" stroke={item.accent} strokeWidth="2" />
            <circle cx="100" cy="96" r="30" fill={`url(#grad-${item.id})`} />
            <rect x="62" y="140" width="76" height="10" rx="5" fill="#E2E8F0" opacity="0.85" />
            <rect x="74" y="158" width="52" height="8" rx="4" fill={item.accent} opacity="0.7" />
          </>
        )}
      </svg>

      {/* Bottom dark gradient scrim + title overlay matching screenshot 2 */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
        <span className="text-xs font-bold text-white tracking-tight drop-shadow-sm">
          {item.title}
        </span>
      </div>
    </div>
  );
};

export const ImagesView: React.FC<ImagesViewProps> = ({
  imageHistory,
  isGeneratingImage,
  lastImageError,
  onClearError,
  onGenerateImage,
  onDeleteImageHistory,
  offlineStrict,
  onDisableOfflineMode,
  userId,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'trending' | 'templates' | 'my_images'>('trending');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('Realistic Photography');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [quality, setQuality] = useState<ImageQuality>('standard');
  const [count, setCount] = useState<number>(1);
  const [provider, setProvider] = useState<'gemini' | 'local' | 'openai'>('gemini');
  const [showOptions, setShowOptions] = useState(false);
  const [referenceImage, setReferenceImage] = useState<ValidatedReferenceImage | null>(null);
  const [refError, setRefError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<ImageCapabilities | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalImageStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formatMap, setFormatMap] = useState<Record<string, 'png' | 'jpeg'>>({});
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lightbox, setLightbox] = useState<{
    isOpen: boolean;
    imageUrl: string;
    prompt: string;
    style?: string;
    aspectRatio?: string;
    modelUsed?: string;
    createdAt?: string;
    onRegenerate?: () => void;
  }>({ isOpen: false, imageUrl: '', prompt: '' });

  const promptInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    fetchImageCapabilities(userId).then((c) => {
      if (c) setCapabilities(c);
    });
    fetchLocalImageStatus().then((st) => {
      if (st) setLocalStatus(st);
    });
  }, [userId, isGeneratingImage]);

  const handleSelectPreset = (item: PresetCardItem) => {
    setStyle(item.style);
    setAspectRatio(item.aspectRatio);
    setPrompt(item.prompt);
    setShowOptions(true);
    setTimeout(() => promptInputRef.current?.focus(), 50);
  };

  const handleReferenceUpload = async (file: File) => {
    setRefError(null);
    try {
      const validated = await validateAndReadReferenceImage(file);
      setReferenceImage(validated);
    } catch (err: unknown) {
      setRefError((err as Error).message || 'Invalid reference image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGeneratingImage) return;
    setRefError(null);
    onClearError();
    setActiveSubTab('my_images');
    await onGenerateImage(
      {
        prompt: prompt.trim(),
        style,
        aspectRatio,
        quality,
        count,
        provider,
        referenceImage: referenceImage || undefined,
      },
      false
    );
    setPrompt('');
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isCloudBlockedOffline = provider === 'gemini' && (!isOnline || offlineStrict);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0B16] relative overflow-hidden min-w-0">
      {/* Scrollable Main Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-48 sm:pb-40 space-y-4 sm:space-y-5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Images</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30 font-semibold">
              Offnex AI Studio
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {capabilities?.quota && (
              <span className="px-2.5 py-1 rounded-full bg-[#14172B] border border-[#242A48] text-gray-300">
                Quota: <strong className="text-purple-300">{capabilities.quota.remaining}</strong>/{capabilities.quota.limit}
              </span>
            )}
            <span
              className={`px-2.5 py-1 rounded-full border font-medium ${
                isCloudBlockedOffline
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : capabilities?.cloudConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-[#14172B] border-[#242A48] text-gray-300'
              }`}
            >
              {provider === 'local'
                ? capabilities?.localAvailable
                  ? 'Local SD Ready'
                  : 'Local SD Offline'
                : isCloudBlockedOffline
                ? 'Offline Mode Active'
                : capabilities?.cloudConfigured
                ? 'Cloud Gemini Ready'
                : 'API Key Needed'}
            </span>
          </div>
        </div>

        {/* Sub-tabs matching Screenshot 2 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('trending')}
            className={`px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'trending'
                ? 'bg-[#20243C] text-white border border-purple-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#14172B]'
            }`}
          >
            Trending
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('templates')}
            className={`px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeSubTab === 'templates'
                ? 'bg-[#20243C] text-white border border-purple-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#14172B]'
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('my_images')}
            className={`px-4 py-2 sm:py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === 'my_images'
                ? 'bg-[#20243C] text-white border border-purple-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#14172B]'
            }`}
          >
            <span>My images</span>
            {imageHistory.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-600/40 text-purple-200 font-bold">
                {imageHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Error Banner (visible across all Images sub-tabs) */}
        {lastImageError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start justify-between gap-3 max-w-3xl">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="leading-relaxed break-words">{lastImageError}</p>
                {isOnline && offlineStrict && onDisableOfflineMode && (
                  <button
                    type="button"
                    onClick={onDisableOfflineMode}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold border border-amber-400/30 transition-colors cursor-pointer"
                  >
                    Enable Online Mode
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClearError}
              className="text-rose-300 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TRENDING GRID */}
        {activeSubTab === 'trending' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5">
            {TRENDING_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item)}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-[#232846] hover:border-purple-500/60 bg-[#121528] text-left shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              >
                <PresetArtwork item={item} />
              </button>
            ))}
          </div>
        )}

        {/* TEMPLATES GRID */}
        {activeSubTab === 'templates' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5">
            {TEMPLATE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPreset(item)}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden border border-[#232846] hover:border-purple-500/60 bg-[#121528] text-left shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
              >
                <PresetArtwork item={item} />
                <span className="absolute top-2.5 left-2.5 text-[10px] px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-purple-200 border border-white/10">
                  {item.aspectRatio}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* MY IMAGES TAB */}
        {activeSubTab === 'my_images' && (
          <div className="space-y-4">
            {/* Active Generation Loading Animation */}
            {isGeneratingImage && (
              <div className="glass-panel rounded-2xl p-5 border border-purple-500/35 space-y-3 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm font-bold text-white">Creating your image...</span>
                </div>
                <div className="relative h-52 w-full rounded-xl bg-gradient-to-br from-[#161932] via-[#221C4A] to-[#121528] border border-purple-500/20 overflow-hidden flex flex-col items-center justify-center gap-2">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent animate-pulse" />
                  <Sparkles className="w-8 h-8 text-purple-400 animate-bounce" />
                  <span className="text-xs text-purple-200 font-medium">
                    {style} • {aspectRatio} • {count > 1 ? `${count} images` : '1 image'}
                  </span>
                </div>
              </div>
            )}

            {imageHistory.length === 0 && !isGeneratingImage ? (
              <div className="h-72 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[#111426] border border-dashed border-[#262C4A]">
                <ImageIcon className="w-10 h-10 text-gray-500 mb-3" />
                <h3 className="text-sm font-bold text-white">No generated images yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  Pick any Trending style or describe a new image in the prompt bar below to create your first visual.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageHistory.map((rec) => {
                  const fmt = formatMap[rec.id] || 'png';
                  const primaryImg = rec.images[0];
                  return (
                    <div
                      key={rec.id}
                      className="glass-panel rounded-2xl p-3.5 border border-[#242A48] hover:border-purple-500/40 transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className={`grid gap-2 ${rec.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {rec.images.map((img) => (
                          <div
                            key={img.id}
                            onClick={() =>
                              setLightbox({
                                isOpen: true,
                                imageUrl: img.dataUrl,
                                prompt: rec.prompt,
                                style: rec.style,
                                aspectRatio: rec.aspectRatio,
                                modelUsed: rec.modelUsed,
                                createdAt: rec.createdAt,
                                onRegenerate: () =>
                                  onGenerateImage(
                                    {
                                      prompt: rec.prompt,
                                      style: rec.style,
                                      aspectRatio: rec.aspectRatio,
                                      quality: rec.quality,
                                      count: rec.count,
                                      provider: rec.provider,
                                    },
                                    false
                                  ),
                              })
                            }
                            className="relative group rounded-xl overflow-hidden bg-[#070812] border border-white/10 cursor-pointer"
                          >
                            <img
                              src={img.dataUrl}
                              alt={rec.prompt}
                              className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            />
                            <div className="absolute top-2 right-2 p-2 rounded-lg bg-black/70 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Maximize2 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-gray-200 font-medium line-clamp-2">{rec.prompt}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                          <span className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-300 border border-purple-500/20">
                            {rec.style}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#181D35] text-gray-300">
                            {rec.aspectRatio}
                          </span>
                          <span className="truncate max-w-[130px]">{rec.modelUsed}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(rec.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1F243D]">
                          <div className="flex items-center gap-1.5">
                            {primaryImg && (
                              <div className="flex items-center bg-[#14182E] border border-purple-500/30 rounded-lg overflow-hidden">
                                <select
                                  value={fmt}
                                  onChange={(e) =>
                                    setFormatMap((prev) => ({
                                      ...prev,
                                      [rec.id]: e.target.value as 'png' | 'jpeg',
                                    }))
                                  }
                                  aria-label="Download format"
                                  className="bg-transparent text-[10px] text-gray-200 px-1.5 py-1 focus:outline-none cursor-pointer"
                                >
                                  <option value="png" className="bg-[#14172B]">PNG</option>
                                  <option value="jpeg" className="bg-[#14172B]">JPG</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadGeneratedImage(
                                      primaryImg.dataUrl,
                                      rec.prompt.slice(0, 32),
                                      fmt
                                    )
                                  }
                                  className="px-2.5 py-1 bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                onGenerateImage(
                                  {
                                    prompt: rec.prompt,
                                    style: rec.style,
                                    aspectRatio: rec.aspectRatio,
                                    quality: rec.quality,
                                    count: rec.count,
                                    provider: rec.provider,
                                  },
                                  false
                                )
                              }
                              disabled={isGeneratingImage}
                              title="Regenerate"
                              className="p-1.5 rounded-lg bg-[#181D35] hover:bg-[#232A4A] text-purple-200 border border-purple-500/25 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyPrompt(rec.id, rec.prompt)}
                              title="Copy Prompt"
                              className="p-1.5 rounded-lg bg-[#181D35] hover:bg-[#232A4A] text-gray-200 border border-[#272D4D] cursor-pointer"
                            >
                              {copiedId === rec.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onDeleteImageHistory(rec.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden reference image input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleReferenceUpload(file);
          e.target.value = '';
        }}
      />

      {/* Floating Bottom Prompt Bar matching Screenshot 2 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5 sm:p-5 pb-safe bg-gradient-to-t from-[#0B0B16] via-[#0B0B16]/90 to-transparent flex flex-col items-center">
        <div className="pointer-events-auto w-full max-w-3xl space-y-2 sm:space-y-2.5">
          {/* Expandable Settings Popover */}
          {showOptions && (
            <div className="glass-panel rounded-2xl p-3 border border-purple-500/35 shadow-2xl space-y-2.5 max-h-[48dvh] overflow-y-auto">
              {isCloudBlockedOffline && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      {!isOnline
                        ? 'Device offline. Cloud image generation requires internet access.'
                        : 'Offline Mode is ON in Settings. Turn it OFF for Cloud API or choose Local.'}
                    </span>
                  </div>
                  {isOnline && offlineStrict && onDisableOfflineMode && (
                    <button
                      type="button"
                      onClick={onDisableOfflineMode}
                      className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold border border-amber-400/30 cursor-pointer shrink-0"
                    >
                      Enable Online Mode
                    </button>
                  )}
                </div>
              )}

              {provider === 'local' && localStatus && !localStatus.available && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                  <span>
                    Local SD offline at <strong>{localStatus.endpoint}</strong>
                    {localStatus.error ? ` (${localStatus.error})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchLocalImageStatus().then((st) => st && setLocalStatus(st))}
                    className="px-2 py-0.5 rounded-lg bg-[#1C213D] hover:bg-[#252C50] text-gray-200 border border-[#2F3764] cursor-pointer shrink-0"
                  >
                    Recheck
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as ImageStyle)}
                  aria-label="Image Style"
                  className="w-full min-w-0 bg-[#0B0B16] border border-[#272D4D] text-gray-200 text-sm sm:text-xs rounded-xl px-2.5 py-2 sm:py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {IMAGE_STYLES.map((st) => (
                    <option key={st} value={st} className="bg-[#14172B]">
                      {st}
                    </option>
                  ))}
                </select>

                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as ImageAspectRatio)}
                  aria-label="Aspect Ratio"
                  className="w-full min-w-0 bg-[#0B0B16] border border-[#272D4D] text-gray-200 text-sm sm:text-xs rounded-xl px-2.5 py-2 sm:py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {IMAGE_ASPECT_RATIOS.map((ar) => (
                    <option key={ar.value} value={ar.value} className="bg-[#14172B]">
                      {ar.label}
                    </option>
                  ))}
                </select>

                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as ImageQuality)}
                  aria-label="Quality"
                  className="w-full min-w-0 bg-[#0B0B16] border border-[#272D4D] text-gray-200 text-sm sm:text-xs rounded-xl px-2.5 py-2 sm:py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="standard" className="bg-[#14172B]">Standard</option>
                  <option value="high" className="bg-[#14172B]">High</option>
                </select>

                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  aria-label="Image Count"
                  className="w-full min-w-0 bg-[#0B0B16] border border-[#272D4D] text-gray-200 text-sm sm:text-xs rounded-xl px-2.5 py-2 sm:py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n} className="bg-[#14172B]">
                      {n} {n === 1 ? 'Image' : 'Images'}
                    </option>
                  ))}
                </select>

                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'gemini' | 'local' | 'openai')}
                  aria-label="Image Provider"
                  className="col-span-2 sm:col-span-1 w-full min-w-0 bg-[#0B0B16] border border-[#272D4D] text-gray-200 text-sm sm:text-xs rounded-xl px-2.5 py-2 sm:py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="gemini" className="bg-[#14172B]">Gemini (Primary)</option>
                  <option value="openai" className="bg-[#14172B]">OpenAI DALL-E 3{capabilities?.openaiConfigured ? ' ✓' : ''}</option>
                  <option value="local" className="bg-[#14172B]">
                    Local SD{capabilities?.localAvailable ? ' ✓' : ''}
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Reference Image / Error Pills */}
          {refError && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-200">
              <span>{refError}</span>
              <button type="button" onClick={() => setRefError(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {referenceImage && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#14172B]/95 border border-purple-500/30 w-fit shadow-lg">
              <img
                src={referenceImage.previewUrl}
                alt="Reference"
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="text-[11px] text-white font-medium truncate max-w-[160px]">
                {referenceImage.fileName}
              </span>
              <button
                type="button"
                onClick={() => setReferenceImage(null)}
                className="p-1 text-gray-400 hover:text-rose-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Main Floating Pill Prompt Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-1.5 sm:gap-2 bg-[#16192E]/95 backdrop-blur-xl border border-purple-500/35 rounded-full px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-2xl shadow-black/60 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Reference Image"
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>

            <input
              ref={promptInputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a new image"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none min-w-0 px-1"
            />

            <button
              type="button"
              onClick={() => setShowOptions((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                showOptions
                  ? 'bg-purple-600/25 text-purple-200 border border-purple-500/40'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title="Style, Aspect Ratio, Quality & Count"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{style.split(' ')[0]} • {aspectRatio}</span>
            </button>

            <button
              type="submit"
              disabled={!prompt.trim() || isGeneratingImage}
              title="Generate Image"
              className="w-9 h-9 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white flex items-center justify-center shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95 cursor-pointer shrink-0"
            >
              {isGeneratingImage ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightbox.isOpen}
        onClose={() => setLightbox((prev) => ({ ...prev, isOpen: false }))}
        imageUrl={lightbox.imageUrl}
        prompt={lightbox.prompt}
        style={lightbox.style}
        aspectRatio={lightbox.aspectRatio}
        modelUsed={lightbox.modelUsed}
        createdAt={lightbox.createdAt}
        onRegenerate={lightbox.onRegenerate}
      />
    </div>
  );
};
