import React, { useState, useMemo } from 'react';
import {
  History,
  Download,
  Trash2,
  Search,
  Filter,
  Check,
  Video,
  Music,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  FolderDown,
} from 'lucide-react';
import { HistoryRecord, Platform } from '../types';

interface HistoryDashboardProps {
  history: HistoryRecord[];
  onRemoveItem: (id: string) => void;
  onClearHistory: () => void;
  onReloadHistory: () => void;
}

export const HistoryDashboard: React.FC<HistoryDashboardProps> = ({
  history,
  onRemoveItem,
  onClearHistory,
  onReloadHistory,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Platform count stats
  const stats = useMemo(() => {
    return {
      all: history.length,
      youtube: history.filter((h) => h.platform === 'youtube').length,
      instagram: history.filter((h) => h.platform === 'instagram').length,
      tiktok: history.filter((h) => h.platform === 'tiktok').length,
      pinterest: history.filter((h) => h.platform === 'pinterest').length,
    };
  }, [history]);

  // Filtered items
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesPlatform =
        selectedPlatform === 'all' || item.platform === selectedPlatform;
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        item.format.toLowerCase().includes(query);
      return matchesPlatform && matchesQuery;
    });
  }, [history, selectedPlatform, searchQuery]);

  const handleRedownload = async (item: HistoryRecord) => {
    setDownloadingId(item.id);
    try {
      const response = await fetch(item.downloadUrl, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo (${response.status})`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.setAttribute('download', `${item.title || 'media'}.${item.format}`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 10000);
    } catch (e) {
      console.error('Erro ao rebaixar arquivo:', e);
    } finally {
      setTimeout(() => setDownloadingId(null), 1000);
    }
  };

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(timestamp));
    } catch (e) {
      return 'Recentemente';
    }
  };

  const platformBadgeStyles: Record<string, string> = {
    youtube: 'bg-red-950/60 border-red-800/50 text-red-400',
    instagram: 'bg-pink-950/60 border-pink-800/50 text-pink-400',
    tiktok: 'bg-cyan-950/60 border-cyan-800/50 text-cyan-400',
    pinterest: 'bg-rose-950/60 border-rose-800/50 text-rose-400',
    generic: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <section id="history-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        {/* Header row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FolderDown className="w-5 h-5 text-sky-400" />
              <h2 className="text-xl font-bold text-white">
                Histórico de Downloads Organizado
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Registros persistentes armazenados no servidor homelab com suporte a download instantâneo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onReloadHistory}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Recarregar do servidor"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {history.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Deseja realmente limpar todo o histórico de downloads?')) {
                    onClearHistory();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/50 rounded-lg transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 my-6">
          {/* Platform Segmented Tabs */}
          <div className="flex items-center overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
            {[
              { id: 'all', label: 'Todos', count: stats.all },
              { id: 'instagram', label: 'Instagram', count: stats.instagram },
              { id: 'tiktok', label: 'TikTok', count: stats.tiktok },
              { id: 'youtube', label: 'YouTube', count: stats.youtube },
              { id: 'pinterest', label: 'Pinterest', count: stats.pinterest },
            ].map((tab) => {
              const isActive = selectedPlatform === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedPlatform(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono tabular-nums text-[10px] px-1 py-0.2 rounded bg-slate-900 text-slate-400">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título, autor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* History Grid */}
        {filteredHistory.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-800/80 rounded-2xl">
            <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300 mb-1">
              Nenhum download registrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cole um link acima de YouTube, Instagram, TikTok ou Pinterest e clique em Baixar para salvar no seu histórico.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map((item) => {
              const isDownloading = downloadingId === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all group"
                >
                  <div className="flex gap-3 mb-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-slate-900 overflow-hidden shrink-0 relative border border-slate-800">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          {item.mediaType === 'audio' ? (
                            <Music className="w-6 h-6" />
                          ) : (
                            <Video className="w-6 h-6" />
                          )}
                        </div>
                      )}
                      <div className="absolute top-1 left-1">
                        <span
                          className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase ${
                            platformBadgeStyles[item.platform] || platformBadgeStyles.generic
                          }`}
                        >
                          {item.platform.slice(0, 2)}
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white truncate mb-1">
                        {item.title}
                      </h4>
                      <div className="text-[11px] text-slate-400 truncate mb-1.5">
                        {item.author}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="font-mono text-sky-400 uppercase">
                          {item.format}
                        </span>
                        <span>·</span>
                        <span className="truncate">{item.qualityLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono tabular-nums">
                      {formatDate(item.timestamp)}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRedownload(item)}
                        disabled={isDownloading}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-800 hover:bg-sky-600 rounded-lg transition-colors"
                        title="Baixar novamente este arquivo"
                      >
                        {isDownloading ? (
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>Baixar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Excluir do histórico"
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
    </section>
  );
};
