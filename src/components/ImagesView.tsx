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
  Film,
} from 'lucide-react';
import {
  GeneratedImageRecord,
  ImageAspectRatio,
  ImageQuality,
  ImageStyle,
} from '../types';
import {
  DailyImageQuotaStatus,
  DAILY_IMAGE_LIMIT,
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
import { downloadGeneratedVideo } from '../services/offlineVideoEngine';
import { ImageGenerationSubmitPayload, VideoGenerationSubmitPayload } from './ChatView';
import { ImageLightboxModal } from './ImageLightboxModal';
import animeReactionImg from '../assets/images/anime_reaction_card_1794996270764.jpg';
import aerialViewImg from '../assets/images/aerial_view_card_1794996270102.jpg';
import collectorsTinImg from '../assets/images/collectors_tin_card_1794996271680.jpg';
import retro80sImg from '../assets/images/retro_80s_card_1794996272443.jpg';
import caricatureImg from '../assets/images/caricature_card_1794996272953.jpg';
import sketchImg from '../assets/images/sketch_card_1794996272431.jpg';
import stickersImg from '../assets/images/stickers_card_1794996271413.jpg';
import photoBoothImg from '../assets/images/photo_booth_card_1794996272870.jpg';
import y2kDigicamImg from '../assets/images/y2k_digicam_card_1794996273571.jpg';
import animeImg from '../assets/images/anime_card_1794996272850.jpg';
import portrait70sImg from '../assets/images/portrait_70s_card_1794996273531.jpg';
import impressionistImg from '../assets/images/impressionist_card_1794996274336.jpg';
import pinsImg from '../assets/images/pins_card_1794996274078.jpg';
import underwaterImg from '../assets/images/underwater_card_1794996274643.jpg';
import avatar3dImg from '../assets/images/avatar_3d_card_1794996275276.jpg';
import tplLogoImg from '../assets/images/tpl_logo_card_1794996275279.jpg';
import tplProductImg from '../assets/images/tpl_product_card_1794996274952.jpg';
import tplSocialImg from '../assets/images/tpl_social_card_1794996275361.jpg';
import tplCinematicImg from '../assets/images/tpl_cinematic_card_1794996275842.jpg';
import tplIsometricImg from '../assets/images/tpl_isometric_card_1794996275863.jpg';
import tplEditorialImg from '../assets/images/tpl_editorial_card_1794996276890.jpg';
import tplFantasyImg from '../assets/images/tpl_fantasy_card_1794996276673.jpg';
import tplAnimeKeyImg from '../assets/images/tpl_anime_key_card_1794996277292.jpg';
import tplBookIllustImg from '../assets/images/tpl_book_illust_card_1794996277440.jpg';
import tplStickerPackImg from '../assets/images/tpl_sticker_pack_card_1794996278598.jpg';

interface ImagesViewProps {
  imageHistory: GeneratedImageRecord[];
  isGeneratingImage: boolean;
  isGeneratingVideo?: boolean;
  lastImageError: string | null;
  onClearError: () => void;
  onGenerateImage: (payload: ImageGenerationSubmitPayload, addToChat?: boolean) => Promise<void>;
  onGenerateVideo?: (payload: VideoGenerationSubmitPayload, addToChat?: boolean) => Promise<void>;
  onDeleteImageHistory: (id: string) => void;
  offlineStrict: boolean;
  onDisableOfflineMode?: () => void;
  userId?: string;
  dailyQuota?: DailyImageQuotaStatus;
}

interface PresetCardItem {
  id: string;
  title: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  prompt: string;
  imageSrc: string;
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
    imageSrc: animeReactionImg.src,
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
    imageSrc: aerialViewImg.src,
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
    imageSrc: collectorsTinImg.src,
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
    imageSrc: retro80sImg.src,
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
    imageSrc: caricatureImg.src,
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
    imageSrc: sketchImg.src,
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
    imageSrc: stickersImg.src,
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
    imageSrc: photoBoothImg.src,
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
    imageSrc: y2kDigicamImg.src,
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
    imageSrc: animeImg.src,
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
    imageSrc: portrait70sImg.src,
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
    imageSrc: impressionistImg.src,
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
    imageSrc: pinsImg.src,
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
    imageSrc: underwaterImg.src,
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
    imageSrc: avatar3dImg.src,
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
    imageSrc: tplLogoImg.src,
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
    imageSrc: tplProductImg.src,
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
    imageSrc: tplSocialImg.src,
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
    imageSrc: tplCinematicImg.src,
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
    imageSrc: tplIsometricImg.src,
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
    imageSrc: tplEditorialImg.src,
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
    imageSrc: tplFantasyImg.src,
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
    imageSrc: tplAnimeKeyImg.src,
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
    imageSrc: tplBookIllustImg.src,
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
    imageSrc: tplStickerPackImg.src,
    gradient: 'from-yellow-500/30 via-rose-500/25 to-purple-700/35',
    accent: '#FDE047',
    motif: 'pins',
  },
];

const PresetArtwork: React.FC<{ item: PresetCardItem }> = ({ item }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className={`preset-card-overlay relative w-full h-full bg-gradient-to-br ${item.gradient} overflow-hidden`}>
      {!imgFailed ? (
        <img
          src={item.imageSrc}
          alt={item.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center p-4"
          aria-hidden="true"
        >
          <div
            className="w-16 h-16 rounded-2xl opacity-60 blur-md"
            style={{ background: item.accent }}
          />
        </div>
      )}

      {/* Subtle hover ring highlight */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none transition-opacity duration-300" />
      <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
        <span className="text-xs font-bold text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
          {item.title}
        </span>
      </div>
    </div>
  );
};

export const ImagesView: React.FC<ImagesViewProps> = ({
  imageHistory,
  isGeneratingImage,
  isGeneratingVideo = false,
  lastImageError,
  onClearError,
  onGenerateImage,
  onGenerateVideo,
  onDeleteImageHistory,
  offlineStrict,
  onDisableOfflineMode,
  userId,
  dailyQuota,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'trending' | 'templates' | 'my_images'>('trending');
  const [mediaMode, setMediaMode] = useState<'image' | 'video'>('image');
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

  const isBusy = isGeneratingImage || isGeneratingVideo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isBusy) return;
    setRefError(null);
    onClearError();
    setActiveSubTab('my_images');
    if (mediaMode === 'video' && onGenerateVideo) {
      await onGenerateVideo(
        {
          prompt: prompt.trim(),
          style,
          aspectRatio,
          quality,
          durationSec: 4,
          baseImageDataUrl: referenceImage?.previewUrl,
        },
        false
      );
      setPrompt('');
      return;
    }
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
  const dailyLimit = capabilities?.quota?.limit ?? dailyQuota?.limit ?? DAILY_IMAGE_LIMIT;
  const effectiveRemaining = Math.min(
    dailyQuota?.remaining ?? dailyLimit,
    capabilities?.quota?.remaining ?? dailyLimit
  );
  const isDailyLimitReached = effectiveRemaining <= 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0B16] relative overflow-hidden min-w-0">
      {/* Scrollable Main Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-48 sm:pb-40 space-y-4 sm:space-y-5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Media Studio</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30 font-semibold">
              Offnex AI Studio
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-full border font-medium ${
                isDailyLimitReached
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                  : effectiveRemaining <= 2
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  : 'bg-[#14172B] border-[#242A48] text-gray-300'
              }`}
            >
              Today: <strong className={isDailyLimitReached ? 'text-rose-300' : 'text-purple-300'}>{effectiveRemaining}</strong>/{dailyLimit} left
            </span>
            <span
              className={`px-2.5 py-1 rounded-full border font-medium ${
                isCloudBlockedOffline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : capabilities?.cloudConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-[#14172B] border-[#242A48] text-gray-300'
              }`}
            >
              {provider === 'local'
                ? capabilities?.localAvailable
                  ? 'Local SD Ready'
                  : 'Offline Studio Ready'
                : isCloudBlockedOffline
                ? 'Offline Studio Ready'
                : capabilities?.cloudConfigured
                ? 'Cloud Gemini Ready'
                : 'Offline Studio Ready'}
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
            <span>My gallery</span>
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
            {isBusy && (
              <div className="glass-panel rounded-2xl p-5 border border-purple-500/35 space-y-3 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-sm font-bold text-white">
                    {isGeneratingVideo ? 'Rendering your video...' : 'Creating your image...'}
                  </span>
                </div>
                <div className="relative h-52 w-full rounded-xl bg-gradient-to-br from-[#161932] via-[#221C4A] to-[#121528] border border-purple-500/20 overflow-hidden flex flex-col items-center justify-center gap-2">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/15 to-transparent animate-pulse" />
                  {isGeneratingVideo ? (
                    <Film className="w-8 h-8 text-purple-400 animate-bounce" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-purple-400 animate-bounce" />
                  )}
                  <span className="text-xs text-purple-200 font-medium">
                    {isGeneratingVideo
                      ? `${style} • ${aspectRatio} • 4s Video`
                      : `${style} • ${aspectRatio} • ${count > 1 ? `${count} images` : '1 image'}`}
                  </span>
                </div>
              </div>
            )}

            {imageHistory.length === 0 && !isBusy ? (
              <div className="h-72 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[#111426] border border-dashed border-[#262C4A]">
                <ImageIcon className="w-10 h-10 text-gray-500 mb-3" />
                <h3 className="text-sm font-bold text-white">No generated images or videos yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  Pick any Trending style or describe a new image or video in the prompt bar below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageHistory.map((rec) => {
                  const fmt = formatMap[rec.id] || 'png';
                  const primaryImg = rec.images[0];
                  const isVideoRecord = rec.mediaType === 'video' && Boolean(rec.videoUrl);
                  return (
                    <div
                      key={rec.id}
                      className="glass-panel rounded-2xl p-3.5 border border-[#242A48] hover:border-purple-500/40 transition-all space-y-3 flex flex-col justify-between"
                    >
                      {isVideoRecord && rec.videoUrl ? (
                        <div className="relative rounded-xl overflow-hidden bg-[#070812] border border-white/10">
                          <video
                            src={rec.videoUrl}
                            poster={primaryImg?.dataUrl}
                            controls
                            loop
                            playsInline
                            muted
                            className="w-full h-56 object-cover"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-purple-200 text-[10px] font-semibold flex items-center gap-1 border border-purple-500/30 pointer-events-none">
                            <Film className="w-3 h-3" />
                            <span>Video</span>
                          </div>
                        </div>
                      ) : (
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
                      )}

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
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isVideoRecord && rec.videoUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadGeneratedVideo(rec.videoUrl!, rec.prompt.slice(0, 32))
                                }
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>Save Video</span>
                              </button>
                            ) : (
                              primaryImg && (
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
                              )
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                isVideoRecord && onGenerateVideo
                                  ? onGenerateVideo(
                                      {
                                        prompt: rec.prompt,
                                        style: rec.style,
                                        aspectRatio: rec.aspectRatio,
                                        quality: rec.quality,
                                        durationSec: 4,
                                      },
                                      false
                                    )
                                  : onGenerateImage(
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
                              disabled={isBusy}
                              title="Regenerate"
                              className="p-1.5 rounded-lg bg-[#181D35] hover:bg-[#232A4A] text-purple-200 border border-purple-500/25 cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            {!isVideoRecord && onGenerateVideo && primaryImg && (
                              <button
                                type="button"
                                onClick={() =>
                                  onGenerateVideo(
                                    {
                                      prompt: rec.prompt,
                                      style: rec.style,
                                      aspectRatio: rec.aspectRatio,
                                      quality: rec.quality,
                                      durationSec: 4,
                                      baseImageDataUrl: primaryImg.dataUrl,
                                    },
                                    false
                                  )
                                }
                                disabled={isBusy}
                                title="Animate to Video"
                                className="p-1.5 rounded-lg bg-[#181D35] hover:bg-[#232A4A] text-cyan-200 border border-cyan-500/25 cursor-pointer disabled:opacity-50"
                              >
                                <Film className="w-3.5 h-3.5" />
                              </button>
                            )}

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
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {!isOnline
                        ? 'Offline Studio Active — Generating artwork directly on your device (No internet needed).'
                        : 'Offline Mode Active — Generating artwork on-device without internet.'}
                    </span>
                  </div>
                  {isOnline && offlineStrict && onDisableOfflineMode && (
                    <button
                      type="button"
                      onClick={onDisableOfflineMode}
                      className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 font-semibold border border-emerald-400/30 cursor-pointer shrink-0"
                    >
                      Switch to Cloud AI
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
                  <option value="gemini" className="bg-[#14172B]">Gemini / Cloud AI</option>
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

          {isDailyLimitReached && mediaMode === 'image' && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 font-medium">
              <span>
                Aaj ki {dailyLimit} images ki daily limit poori ho chuki hai. Free Chat aur Video Studio bina limit ke available hain — kal dubara {dailyLimit} images bana saktay hain.
              </span>
            </div>
          )}

          {/* Main Floating Prompt Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-1.5 sm:gap-2 bg-[#16192E]/95 backdrop-blur-xl border border-purple-500/35 rounded-full px-2 sm:px-3 py-1.5 sm:py-2 shadow-2xl shadow-black/60 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Reference Image"
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>

            {onGenerateVideo && (
              <div className="flex items-center bg-[#0B0D18] border border-[#272D4D] rounded-full p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMediaMode('image')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    mediaMode === 'image'
                      ? 'bg-[#20243C] text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaMode('video')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    mediaMode === 'video'
                      ? 'bg-gradient-to-r from-[#4435D5] to-[#7547FF] text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  <span className="hidden sm:inline">Video</span>
                </button>
              </div>
            )}

            <input
              ref={promptInputRef}
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={mediaMode === 'image' && isDailyLimitReached}
              placeholder={
                mediaMode === 'video'
                  ? 'Describe a video scene (Online & Offline)...'
                  : isDailyLimitReached
                  ? `Daily limit reached (${dailyLimit}/${dailyLimit} images today)`
                  : 'Describe a new image'
              }
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none min-w-0 px-1 disabled:opacity-60"
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
              disabled={!prompt.trim() || isBusy || (mediaMode === 'image' && isDailyLimitReached)}
              title={
                mediaMode === 'video'
                  ? 'Generate Video'
                  : isDailyLimitReached
                  ? 'Daily limit of 10 images reached'
                  : 'Generate Image'
              }
              className="w-9 h-9 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-[#4435D5] to-[#7547FF] hover:from-[#5140E8] hover:to-[#865CFF] text-white flex items-center justify-center shadow-lg shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform active:scale-95 cursor-pointer shrink-0"
            >
              {isBusy ? (
                <RotateCw className="w-4 h-4 animate-spin" />
              ) : mediaMode === 'video' ? (
                <Film className="w-4 h-4" />
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
