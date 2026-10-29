import React, { useState } from 'react';
import {
  Download,
  Check,
  Music,
  Video,
  Image as ImageIcon,
  Copy,
  Clock,
  User,
  AlertTriangle,
  X,
} from 'lucide-react';
import { MediaResult, QualityOption, HistoryRecord } from '../types';
import { saveHistoryItem, triggerBrowserDownload } from '../services/api';

interface MediaResultCardProps {
  media: MediaResult;
  onDownloadCompleted: (item: HistoryRecord) => void;
  onClear: () => void;
}

const PLATFORM_BADGE_STYLES: Record<string, string> = {
  youtube: 'bg-red-950/60 border-red-800/60 text-red-400',
  instagram: 'bg-pink-950/60 border-pink-800/60 text-pink-400',
  tiktok: 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400',
  pinterest: 'bg-rose-950/60 border-rose-800/60 text-rose-400',
  generic: 'bg-sky-950/60 border-sky-800/60 text-sky-400',
};

export const MediaResultCard: React.FC<MediaResultCardProps> = ({
  media,
  onDownloadCompleted,
  onClear,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [imgError, setImgError] = useState(false);

  const filteredQualities = media.qualities.filter(
    (q) => activeTab === 'all' || q.type === activeTab
  );

  const handleDownload = async (quality: QualityOption) => {
    setDownloadingId(quality.id);
    setDownloadError(null);

    try {
      const filename = `${media.title || 'media'}_${quality.resolution || quality.format}.${quality.format}`;
      await triggerBrowserDownload(quality.url, filename);

      const historyItem: HistoryRecord = {
        id: `${media.id}-${quality.id}-${Date.now()}`,
        originalUrl: media.originalUrl,
        title: media.title,
        author: media.author,
        thumbnail: media.thumbnail,
        platform: media.platform,
        mediaType: quality.type,
        qualityLabel: quality.label,
        format: quality.format,
        downloadUrl: quality.url,
        fileSize: quality.size,
        timestamp: Date.now(),
      };

      await saveHistoryItem(historyItem);
      onDownloadCompleted(historyItem);
      setDownloadedIds((prev) => new Set(prev).add(quality.id));
    } catch (err: any) {
      setDownloadError(err.message || 'Falha ao baixar o arquivo.');
    } finally {
      setTimeout(() => setDownloadingId(null), 1200);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(media.originalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-16">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded border capitalize ${
                PLATFORM_BADGE_STYLES[media.platform] || PLATFORM_BADGE_STYLES.generic
              }`}
            >
              {media.platform}
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Mídia Pronta para Download
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded transition-colors"
              title="Copiar link original"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>
            <button
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="mx-6 mt-4 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Aviso de Download</span>
              <span>{downloadError}</span>
            </div>
            <button
              onClick={() => setDownloadError(null)}
              className="text-amber-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-5 relative group rounded-xl overflow-hidden bg-slate-950 aspect-video md:aspect-square flex items-center justify-center border border-slate-800">
            {media.thumbnail && !imgError ? (
              <img
                src={media.thumbnail}
                alt={media.title}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                <Video className="w-10 h-10" />
                <span className="text-xs">Prévia da Mídia</span>
              </div>
            )}

            {media.duration && (
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded text-[11px] font-mono tabular-nums text-white flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{media.duration}</span>
              </div>
            )}

            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[11px] text-emerald-400 font-medium">
              Sem marca d'água
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2 leading-snug line-clamp-2">
                {media.title || 'Mídia Detectada'}
              </h2>

              <div className="flex items-center gap-3 text-xs text-slate-400 mb-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-medium text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{media.author}</span>
                </div>
                <span>·</span>
                <span className="capitalize">{media.mediaType}</span>
                <span>·</span>
                <span className="text-emerald-400 font-medium">Original Stream</span>
              </div>

              <div className="flex items-center gap-1 mb-4 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
                {(
                  [
                    { id: 'all', label: 'Todas Opções', icon: null },
                    { id: 'video', label: 'Vídeo', icon: Video },
                    { id: 'audio', label: 'Áudio', icon: Music },
                    { id: 'image', label: 'Fotos', icon: ImageIcon },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
                        activeTab === tab.id
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredQualities.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Nenhum formato disponível nesta categoria.
                  </p>
                ) : (
                  filteredQualities.map((quality) => {
                    const isDownloading = downloadingId === quality.id;
                    const isDownloaded = downloadedIds.has(quality.id);

                    return (
                      <div
                        key={quality.id}
                        className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-300 shrink-0">
                            {quality.type === 'video' ? (
                              <Video className="w-4 h-4 text-sky-400" />
                            ) : quality.type === 'audio' ? (
                              <Music className="w-4 h-4 text-amber-400" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {quality.label}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span className="uppercase font-mono text-[11px] text-slate-300">
                                {quality.format}
                              </span>
                              {quality.resolution && (
                                <>
                                  <span>·</span>
                                  <span>{quality.resolution}</span>
                                </>
                              )}
                              {quality.size && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono tabular-nums">{quality.size}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownload(quality)}
                            disabled={isDownloading}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                              isDownloaded
                                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20'
                            }`}
                          >
                            {isDownloading ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Baixando...</span>
                              </>
                            ) : isDownloaded ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Baixar Novamente</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Download direto com conexões paralelas (-N 8) e cache inteligente de 10 min</span>
              <span className="font-mono text-slate-400">100% Sem Marca d'Água</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
