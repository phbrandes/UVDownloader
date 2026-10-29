import { DownloadCloud, Server, Globe } from 'lucide-react';
import { ServerInfo } from '../types';

interface HeaderProps {
  serverInfo: ServerInfo | null;
  onOpenHomelabModal: () => void;
  onScrollToHistory: () => void;
  onScrollToTop: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serverInfo,
  onOpenHomelabModal,
  onScrollToHistory,
  onScrollToTop,
}) => {
  const isTunnelActive = serverInfo?.tunnel?.status === 'connected';

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={onScrollToTop}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
            <DownloadCloud className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap">
            UV Downloader
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={onScrollToTop}
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Baixar Mídia
          </button>
          <button
            onClick={onScrollToHistory}
            className="hover:text-white transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <span>Histórico de Downloads</span>
            {serverInfo?.historyCount !== undefined && serverInfo.historyCount > 0 && (
              <span className="text-xs font-mono tabular-nums text-sky-400 bg-sky-950/70 border border-sky-800/60 rounded px-1.5 py-0.2">
                {serverInfo.historyCount}
              </span>
            )}
          </button>
          <button
            onClick={onOpenHomelabModal}
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Configurar Homelab
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isTunnelActive && (
            <button
              onClick={onOpenHomelabModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-300 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/70 rounded-lg transition-colors"
              title="Acesso Remoto Online Ativo - Clique para ver QR Code"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span className="hidden sm:inline">Online Remoto</span>
            </button>
          )}

          <button
            onClick={onOpenHomelabModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-700/80 rounded-lg transition-all shadow-sm whitespace-nowrap"
            title="Ver detalhes do servidor local e Docker"
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Servidor Homelab</span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {serverInfo?.status === 'online' ? 'Online' : 'Ativo'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
