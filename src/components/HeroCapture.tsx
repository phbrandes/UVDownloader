import React, { useState, useEffect } from 'react';
import {
  Link2,
  Clipboard,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  Youtube,
  Instagram,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Platform } from '../types';

interface HeroCaptureProps {
  onExtract: (url: string) => Promise<void>;
  isLoading: boolean;
  activePlatform: Platform | null;
  onPlatformSelect?: (platform: Platform) => void;
}

export const HeroCapture: React.FC<HeroCaptureProps> = ({
  onExtract,
  isLoading,
  activePlatform,
}) => {
  const [url, setUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>('generic');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Auto detect platform whenever url changes
  useEffect(() => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      setDetectedPlatform('youtube');
    } else if (trimmed.includes('instagram.com') || trimmed.includes('instagr.am')) {
      setDetectedPlatform('instagram');
    } else if (trimmed.includes('tiktok.com') || trimmed.includes('douyin.com')) {
      setDetectedPlatform('tiktok');
    } else if (trimmed.includes('pinterest.com') || trimmed.includes('pin.it')) {
      setDetectedPlatform('pinterest');
    } else {
      setDetectedPlatform('generic');
    }
  }, [url]);

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text);
          setPasteSuccess(true);
          setTimeout(() => setPasteSuccess(false), 2000);
        }
      }
    } catch (err) {
      console.warn('Erro ao ler área de transferência:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onExtract(url.trim());
  };

  const handleSetExample = (exampleUrl: string) => {
    setUrl(exampleUrl);
  };

  // Platform styling metadata
  const platformMeta: Record<Platform, { name: string; color: string; badge: string }> = {
    instagram: {
      name: 'Instagram',
      color: 'from-pink-500 via-rose-500 to-purple-600',
      badge: 'Instagram (Reels, Fotos, Stories)',
    },
    tiktok: {
      name: 'TikTok',
      color: 'from-cyan-400 to-rose-500',
      badge: 'TikTok (Sem Marca d\'Água & MP3)',
    },
    youtube: {
      name: 'YouTube',
      color: 'from-red-500 to-red-600',
      badge: 'YouTube (Vídeos, Shorts & Áudio 320k)',
    },
    pinterest: {
      name: 'Pinterest',
      color: 'from-red-600 to-rose-700',
      badge: 'Pinterest (Imagens 4K Originais & Vídeos)',
    },
    generic: {
      name: 'Multi-Plataforma',
      color: 'from-sky-500 to-indigo-600',
      badge: 'Auto-Detecção Inteligente Ativa',
    },
  };

  return (
    <section className="relative pt-10 pb-12 sm:pt-16 sm:pb-16 overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-sky-500/10 via-indigo-500/10 to-rose-500/10 blur-[100px] pointer-events-none -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Title and subtitle */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-medium text-sky-400 bg-sky-950/60 border border-sky-800/50 rounded-full">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Extração de Mídia Self-Hosted para Homelab</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 text-balance">
          Baixe Vídeos e Fotos Sem Marca d'Água
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-8 text-balance">
          Cole o link de qualquer post ou vídeo do <strong className="text-slate-200">Instagram</strong>,{' '}
          <strong className="text-slate-200">TikTok</strong>,{' '}
          <strong className="text-slate-200">YouTube</strong> ou{' '}
          <strong className="text-slate-200">Pinterest</strong> e baixe em alta definição diretamente no seu homelab.
        </p>

        {/* Platform Indicator Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {(['instagram', 'tiktok', 'youtube', 'pinterest'] as Platform[]).map((p) => {
            const isCurrent = detectedPlatform === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  if (p === 'youtube') handleSetExample('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                  if (p === 'tiktok') handleSetExample('https://www.tiktok.com/@tiktok/video/7106594312292453678');
                  if (p === 'instagram') handleSetExample('https://www.instagram.com/reel/C-5xZ8tM123/');
                  if (p === 'pinterest') handleSetExample('https://www.pinterest.com/pin/1234567890/');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-slate-800 text-white border border-sky-500/50 shadow-sm shadow-sky-500/10'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {p === 'youtube' && <span className="w-2 h-2 rounded-full bg-red-500" />}
                {p === 'instagram' && <span className="w-2 h-2 rounded-full bg-pink-500" />}
                {p === 'tiktok' && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                {p === 'pinterest' && <span className="w-2 h-2 rounded-full bg-rose-600" />}
                <span className="capitalize">{p}</span>
              </button>
            );
          })}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
            <div className="relative flex-1 flex items-center min-w-0">
              <div className="pl-3.5 pr-2 text-slate-500">
                <Link2 className="w-5 h-5" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link do YouTube, Instagram, TikTok ou Pinterest aqui..."
                className="w-full py-3.5 bg-transparent text-slate-100 placeholder-slate-500 text-sm sm:text-base focus:outline-none"
                disabled={isLoading}
                required
              />

              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors mr-1"
                  title="Limpar link"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handlePaste}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 mr-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 hover:text-white border border-slate-700 rounded-lg transition-colors shrink-0"
                title="Colar da Área de Transferência"
              >
                {pasteSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Colado!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                    <span>Colar</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-sky-500/25 shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Extraindo...</span>
                </>
              ) : (
                <>
                  <span>Baixar Agora</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Quick paste for mobile */}
          <div className="flex sm:hidden justify-center mt-3">
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Colar da área de transferência</span>
            </button>
          </div>

          {/* Platform Auto-Detection Indicator */}
          {url.trim() && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="text-slate-500">Formato identificado:</span>
              <span className="font-medium text-sky-300 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded">
                {platformMeta[detectedPlatform].badge}
              </span>
            </div>
          )}
        </form>
      </div>
    </section>
  );
};
