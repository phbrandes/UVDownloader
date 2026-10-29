import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroCapture } from './components/HeroCapture';
import { MediaResultCard } from './components/MediaResultCard';
import { HistoryDashboard } from './components/HistoryDashboard';
import { FeaturesSection } from './components/FeaturesSection';
import { HomelabModal } from './components/HomelabModal';
import {
  extractMedia,
  fetchHistory,
  removeHistoryItem,
  clearAllHistory,
  fetchServerInfo,
} from './services/api';
import { MediaResult, HistoryRecord, ServerInfo } from './types';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentMedia, setCurrentMedia] = useState<MediaResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isHomelabModalOpen, setIsHomelabModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load initial history and server diagnostics in parallel
  useEffect(() => {
    Promise.all([fetchHistory(), fetchServerInfo()]).then(([hist, info]) => {
      setHistory(hist);
      if (info) setServerInfo(info);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExtract = async (url: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const media = await extractMedia(url);
      setCurrentMedia(media);
      showToast('Mídia analisada com sucesso! Escolha o formato desejado.');
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Não foi possível extrair este link. Certifique-se de que a publicação seja pública e a URL esteja correta.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCompleted = (item: HistoryRecord) => {
    setHistory((prev) => [item, ...prev.filter((h) => h.id !== item.id)]);
    showToast(`Download de "${item.title.slice(0, 30)}..." iniciado!`);
    fetchServerInfo().then((info) => {
      if (info) setServerInfo(info);
    });
  };

  const handleRemoveHistoryItem = async (id: string) => {
    const updated = await removeHistoryItem(id);
    setHistory(updated);
    showToast('Item removido do histórico.');
  };

  const handleClearHistory = async () => {
    await clearAllHistory();
    setHistory([]);
    showToast('Histórico completamente limpo.');
  };

  const handleReloadHistory = async () => {
    const hist = await fetchHistory();
    setHistory(hist);
    showToast('Histórico sincronizado com o servidor.');
  };

  const scrollToHistory = () => {
    document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-sky-500/50 text-slate-100 text-xs font-medium rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Header
        serverInfo={serverInfo}
        onOpenHomelabModal={() => setIsHomelabModalOpen(true)}
        onScrollToHistory={scrollToHistory}
        onScrollToTop={scrollToTop}
      />

      <main className="flex-1">
        <HeroCapture onExtract={handleExtract} isLoading={isLoading} />

        {errorMessage && (
          <div className="max-w-3xl mx-auto px-4 mb-8">
            <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-start gap-3 text-rose-200 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Aviso de Extração</span>
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentMedia && (
          <MediaResultCard
            media={currentMedia}
            onDownloadCompleted={handleDownloadCompleted}
            onClear={() => setCurrentMedia(null)}
          />
        )}

        <HistoryDashboard
          history={history}
          onRemoveItem={handleRemoveHistoryItem}
          onClearHistory={handleClearHistory}
          onReloadHistory={handleReloadHistory}
        />

        <FeaturesSection />
      </main>

      <HomelabModal
        isOpen={isHomelabModalOpen}
        onClose={() => setIsHomelabModalOpen(false)}
        serverInfo={serverInfo}
      />

      <footer className="w-full bg-slate-950 border-t border-slate-900 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">UV Downloader</span>
            <span>·</span>
            <span>Self-Hosted Media Downloader para Homelab</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setIsHomelabModalOpen(true)}
              className="hover:text-slate-200 transition-colors"
            >
              Docker & Homelab
            </button>
            <span>·</span>
            <button
              onClick={scrollToHistory}
              className="hover:text-slate-200 transition-colors"
            >
              Histórico
            </button>
            <span>·</span>
            <button
              onClick={scrollToTop}
              className="hover:text-slate-200 transition-colors"
            >
              Voltar ao Topo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
