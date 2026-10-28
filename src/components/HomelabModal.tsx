import React, { useState, useEffect } from 'react';
import {
  Server,
  X,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Clock,
  ShieldCheck,
  Terminal,
  KeyRound,
  FileText,
  Trash2,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { ServerInfo, CookiesInfo } from '../types';
import { fetchCookiesInfo, saveCookiesContent, deleteCookiesFile } from '../services/api';

interface HomelabModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverInfo: ServerInfo | null;
}

export const HomelabModal: React.FC<HomelabModalProps> = ({
  isOpen,
  onClose,
  serverInfo,
}) => {
  const [activeTab, setActiveTab] = useState<'server' | 'cookies'>('server');
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Cookies state
  const [cookiesInfo, setCookiesInfo] = useState<CookiesInfo | null>(null);
  const [cookieInput, setCookieInput] = useState('');
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookieFeedback, setCookieFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCookiesInfo().then((info) => setCookiesInfo(info));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dockerComposeSnippet = `version: "3.8"
services:
  uv-downloader:
    image: uv-downloader:latest
    container_name: uv-downloader
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./data:/app/data
    restart: unless-stopped`;

  const dockerRunSnippet = `docker run -d \\
  --name uv-downloader \\
  -p 3000:3000 \\
  -v $(pwd)/data:/app/data \\
  --restart unless-stopped \\
  uv-downloader:latest`;

  const handleCopy = (text: string, type: 'compose' | 'command') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'compose') {
        setCopiedDocker(true);
        setTimeout(() => setCopiedDocker(false), 2000);
      } else {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      }
    }
  };

  const handleSaveCookies = async () => {
    if (!cookieInput.trim()) return;
    setIsSavingCookies(true);
    try {
      const updated = await saveCookiesContent(cookieInput.trim());
      setCookiesInfo(updated);
      setCookieInput('');
      setCookieFeedback('cookies.txt salvo com sucesso no servidor homelab!');
      setTimeout(() => setCookieFeedback(null), 3000);
    } catch (err: any) {
      setCookieFeedback('Erro ao salvar cookies: ' + err.message);
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleDeleteCookies = async () => {
    if (confirm('Deseja realmente remover o arquivo cookies.txt do servidor?')) {
      await deleteCookiesFile();
      setCookiesInfo({ exists: false, domains: [] });
      setCookieFeedback('Arquivo cookies.txt removido.');
      setTimeout(() => setCookieFeedback(null), 3000);
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configurações do Homelab & yt-dlp</h3>
              <p className="text-xs text-slate-400">Servidor self-hosted e autenticação com cookies</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-800/80">
          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'server'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Servidor & Docker</span>
          </button>
          <button
            onClick={() => setActiveTab('cookies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'cookies'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Injeção de Cookies (yt-dlp)</span>
            {cookiesInfo?.exists && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-4 space-y-6 pr-1 flex-1">
          {activeTab === 'server' ? (
            <>
              {/* Server status cards */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Métricas do Servidor Atual
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Status</span>
                    </div>
                    <div className="text-sm font-semibold text-emerald-400 capitalize">
                      {serverInfo?.status || 'Online'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>Uptime</span>
                    </div>
                    <div className="text-sm font-semibold text-white font-mono tabular-nums">
                      {formatUptime(serverInfo?.uptime)}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Memória RAM</span>
                    </div>
                    <div className="text-sm font-semibold text-white font-mono tabular-nums">
                      {serverInfo?.memoryUsage?.heapUsed || '32.4 MB'}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span>Downloads</span>
                    </div>
                    <div className="text-sm font-semibold text-white font-mono tabular-nums">
                      {serverInfo?.historyCount || 0} itens
                    </div>
                  </div>
                </div>
              </div>

              {/* Docker Compose Configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      docker-compose.yml (Recomendado para Homelab)
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopy(dockerComposeSnippet, 'compose')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors"
                  >
                    {copiedDocker ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar Compose</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                  {dockerComposeSnippet}
                </pre>
              </div>

              {/* Docker Run Single Line */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Comando Docker CLI Rápido
                  </h4>
                  <button
                    onClick={() => handleCopy(dockerRunSnippet, 'command')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors"
                  >
                    {copiedCommand ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar CLI</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                  {dockerRunSnippet}
                </pre>
              </div>
            </>
          ) : (
            /* Cookies Tab */
            <div className="space-y-5">
              {/* Status Card */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-white">Status do Arquivo cookies.txt</span>
                  </div>
                  {cookiesInfo?.exists ? (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ativo no Homelab ({cookiesInfo.size})</span>
                      </div>
                      {cookiesInfo.domains.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cookiesInfo.domains.map((dom) => (
                            <span
                              key={dom}
                              className="text-[10px] font-mono text-slate-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded"
                            >
                              {dom}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Nenhum arquivo cookies.txt configurado no servidor. Vídeos que exigem login podem falhar.
                    </p>
                  )}
                </div>

                {cookiesInfo?.exists && (
                  <button
                    onClick={handleDeleteCookies}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50 rounded-lg transition-colors shrink-0"
                    title="Excluir arquivo de cookies"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remover</span>
                  </button>
                )}
              </div>

              {/* Feedback toast */}
              {cookieFeedback && (
                <div className="p-2.5 bg-sky-950/60 border border-sky-800/60 text-sky-200 text-xs rounded-lg">
                  {cookieFeedback}
                </div>
              )}

              {/* Paste cookies area */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Colar Conteúdo do cookies.txt (Formato Netscape)
                </label>
                <textarea
                  rows={5}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="# Netscape HTTP Cookie File&#10;.youtube.com    TRUE    /    TRUE    1793144000    PREF    ...&#10;.instagram.com  TRUE    /    TRUE    1793144000    sessionid ..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] text-slate-500">
                    Ou coloque o arquivo diretamente em <code className="text-sky-300">./data/cookies.txt</code>
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveCookies}
                    disabled={isSavingCookies || !cookieInput.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar no Homelab</span>
                  </button>
                </div>
              </div>

              {/* Instructions on how to export */}
              <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-2 text-xs text-slate-400">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                  <span>Como exportar os cookies da sua conta:</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Instale a extensão de navegador <strong className="text-slate-300">"Get cookies.txt LOCALLY"</strong> (disponível para Chrome e Firefox).
                  </li>
                  <li>
                    Acesse o site desejado (<strong className="text-slate-300">YouTube</strong> ou <strong className="text-slate-300">Instagram</strong>) e faça login normalmente.
                  </li>
                  <li>
                    Clique no ícone da extensão e clique em <strong className="text-slate-300">Export / Copy</strong>.
                  </li>
                  <li>
                    Cole o texto no campo acima e clique em <strong className="text-slate-300">"Salvar no Homelab"</strong>.
                  </li>
                </ol>
                <p className="text-[11px] text-slate-500 pt-1">
                  O yt-dlp utilizará automaticamente o parâmetro <code className="text-sky-400">--cookies /app/data/cookies.txt</code> para liberar vídeos +18, membros ou feeds com login obrigatório.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
