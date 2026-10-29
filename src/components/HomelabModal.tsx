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
  Globe,
  ExternalLink,
  QrCode,
  Sparkles,
  Power,
  RefreshCw,
} from 'lucide-react';
import { ServerInfo, CookiesInfo, TunnelInfo } from '../types';
import {
  fetchCookiesInfo,
  saveCookiesContent,
  deleteCookiesFile,
  fetchTunnelInfo,
  saveTunnelConfig,
  stopCloudflareTunnel,
} from '../services/api';

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
  const [activeTab, setActiveTab] = useState<'cloudflare' | 'cookies' | 'server'>('cloudflare');
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Cookies state
  const [cookiesInfo, setCookiesInfo] = useState<CookiesInfo | null>(null);
  const [cookieInput, setCookieInput] = useState('');
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookieFeedback, setCookieFeedback] = useState<string | null>(null);

  // Cloudflare Tunnel state
  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo | null>(null);
  const [tunnelSubTab, setTunnelSubTab] = useState<'quick' | 'custom'>('quick');
  const [domainInput, setDomainInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [isSavingTunnel, setIsSavingTunnel] = useState(false);
  const [tunnelFeedback, setTunnelFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCookiesInfo().then((info) => setCookiesInfo(info));
      fetchTunnelInfo().then((info) => {
        setTunnelInfo(info);
        if (info.mode === 'custom') {
          setTunnelSubTab('custom');
        } else {
          setTunnelSubTab('quick');
        }
        if (info.publicDomain) {
          setDomainInput(info.publicDomain);
        }
      });
    }
  }, [isOpen]);

  // Poll tunnel status while starting
  useEffect(() => {
    if (!isOpen || !tunnelInfo || tunnelInfo.status !== 'starting') return;
    const timer = setInterval(async () => {
      const updated = await fetchTunnelInfo();
      setTunnelInfo(updated);
    }, 2000);
    return () => clearInterval(timer);
  }, [isOpen, tunnelInfo?.status]);

  if (!isOpen) return null;

  const dockerComposeSnippet = `services:
  uv-downloader:
    build: .
    container_name: uv-downloader
    hostname: uv-downloader
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - PUBLIC_DOMAIN=\${PUBLIC_DOMAIN:-}
      - CLOUDFLARE_TUNNEL_TOKEN=\${CLOUDFLARE_TUNNEL_TOKEN:-}
    volumes:
      - ./data:/app/data
    restart: unless-stopped`;

  const dockerRunSnippet = `docker compose up -d --build`;

  const handleCopy = (text: string, type: 'compose' | 'command' | 'domain') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'compose') {
        setCopiedDocker(true);
        setTimeout(() => setCopiedDocker(false), 2000);
      } else if (type === 'command') {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      } else {
        setCopiedDomain(true);
        setTimeout(() => setCopiedDomain(false), 2000);
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
    await deleteCookiesFile();
    setCookiesInfo({ exists: false, domains: [] });
    setCookieFeedback('Arquivo cookies.txt removido.');
    setTimeout(() => setCookieFeedback(null), 3000);
  };

  const handleSaveCustomTunnel = async () => {
    setIsSavingTunnel(true);
    setTunnelFeedback(null);
    try {
      const updated = await saveTunnelConfig({
        mode: 'custom',
        publicDomain: domainInput.trim(),
        tunnelToken: tokenInput.trim() || undefined,
      });
      setTunnelInfo(updated);
      setTokenInput('');
      setTunnelFeedback('Túnel Cloudflare Zero Trust salvo e iniciado com sucesso!');
      setTimeout(() => setTunnelFeedback(null), 4000);
    } catch (err: any) {
      setTunnelFeedback('Erro: ' + err.message);
    } finally {
      setIsSavingTunnel(false);
    }
  };

  const handleStartQuickTunnel = async () => {
    setIsSavingTunnel(true);
    setTunnelFeedback(null);
    try {
      const updated = await saveTunnelConfig({
        mode: 'quick',
      });
      setTunnelInfo(updated);
      setTunnelFeedback('Túnel HTTPS gratuito iniciado! Aguarde alguns segundos se o link ainda estiver gerando.');
      setTimeout(() => setTunnelFeedback(null), 4000);
    } catch (err: any) {
      setTunnelFeedback('Erro: ' + err.message);
    } finally {
      setIsSavingTunnel(false);
    }
  };

  const handleStopTunnel = async () => {
    setIsSavingTunnel(true);
    try {
      const updated = await stopCloudflareTunnel();
      setTunnelInfo(updated);
      setTunnelFeedback('Túnel remoto desligado.');
      setTimeout(() => setTunnelFeedback(null), 3000);
    } catch (err: any) {
      setTunnelFeedback('Erro ao desligar túnel: ' + err.message);
    } finally {
      setIsSavingTunnel(false);
    }
  };

  const handleRefreshTunnel = async () => {
    const updated = await fetchTunnelInfo();
    setTunnelInfo(updated);
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

  const activeRemoteUrl =
    tunnelInfo?.mode === 'custom'
      ? tunnelInfo.publicDomain
      : tunnelInfo?.mode === 'quick'
      ? tunnelInfo.quickTunnelUrl
      : '';

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
              <h3 className="text-base font-bold text-white">Configurações do Homelab & Acesso Online</h3>
              <p className="text-xs text-slate-400">Domínio Cloudflare, autenticação yt-dlp e métricas do container</p>
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
        <div className="flex flex-wrap items-center gap-2 pt-4 pb-2 border-b border-slate-800/80">
          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'cloudflare'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Domínio & Cloudflare</span>
            {tunnelInfo?.status === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
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

          <button
            onClick={() => setActiveTab('server')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'server'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Servidor & Docker</span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-4 space-y-6 pr-1 flex-1">
          {activeTab === 'cloudflare' && (
            <div className="space-y-5">
              {/* Tunnel Active Status Banner */}
              <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-white">Status do Acesso Remoto (Cloudflare Tunnel)</div>
                      <div className="text-xs text-slate-400">
                        {tunnelInfo?.status === 'connected'
                          ? tunnelInfo.mode === 'custom'
                            ? 'Conectado via Conta Cloudflare Zero Trust (Domínio Fixo)'
                            : 'Conectado via Túnel HTTPS Gratuito (TryCloudflare)'
                          : tunnelInfo?.status === 'starting'
                          ? 'Iniciando conexão com a rede da Cloudflare...'
                          : tunnelInfo?.status === 'error'
                          ? tunnelInfo.lastError || 'Erro ao conectar túnel'
                          : 'Túnel remoto desligado no momento'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleRefreshTunnel}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                      title="Atualizar status"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    {tunnelInfo?.mode !== 'off' && (
                      <button
                        onClick={handleStopTunnel}
                        disabled={isSavingTunnel}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/50 rounded-lg transition-colors"
                      >
                        <Power className="w-3 h-3" />
                        <span>Desligar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Active URL + QR Code when available */}
                {activeRemoteUrl && (
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Seu Link Online para Celular e Outros PCs:</span>
                      </div>
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs text-sky-300 break-all">
                        {activeRemoteUrl}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleCopy(activeRemoteUrl, 'domain')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors"
                        >
                          {copiedDomain ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Link Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Endereço</span>
                            </>
                          )}
                        </button>
                        <a
                          href={activeRemoteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Testar Link</span>
                        </a>
                      </div>
                    </div>

                    {/* QR Code for instant mobile scan */}
                    <div className="flex flex-col items-center p-2.5 bg-white rounded-xl shrink-0 self-center sm:self-auto">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                          activeRemoteUrl
                        )}`}
                        alt="QR Code de Acesso Remoto"
                        className="w-24 h-24 rounded"
                      />
                      <span className="text-[10px] font-semibold text-slate-800 mt-1 flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        Abrir no Celular
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {tunnelFeedback && (
                <div className="p-2.5 bg-sky-950/60 border border-sky-800/60 text-sky-200 text-xs rounded-lg">
                  {tunnelFeedback}
                </div>
              )}

              {/* Subtab Switcher: Free Quick Tunnel vs Custom Domain */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTunnelSubTab('quick')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    tunnelSubTab === 'quick'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ Túnel Gratuito (TryCloudflare)</span>
                  {tunnelInfo?.mode === 'quick' && tunnelInfo.status === 'connected' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTunnelSubTab('custom')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    tunnelSubTab === 'custom'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>🌐 Domínio Personalizado (Opcional)</span>
                  {tunnelInfo?.mode === 'custom' && tunnelInfo.status === 'connected' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  )}
                </button>
              </div>

              {/* Subtab 1: Free Quick Tunnel (TryCloudflare) */}
              {tunnelSubTab === 'quick' && (
                <div className="p-5 bg-slate-950/70 border border-slate-800/90 rounded-xl space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Acesso Remoto Gratuito sem Domínio
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
                          Instantâneo
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Cria um link HTTPS seguro temporário (<code className="text-sky-300 font-mono">https://*.trycloudflare.com</code>) diretamente pelos servidores da Cloudflare. Não precisa de cadastro, cartão ou domínio próprio.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="p-2.5 bg-slate-900/80 border border-slate-800/70 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Zero configuração de roteador (dispensa abrir portas)</span>
                    </div>
                    <div className="p-2.5 bg-slate-900/80 border border-slate-800/70 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Acesse do celular fora de casa no 4G/5G</span>
                    </div>
                    <div className="p-2.5 bg-slate-900/80 border border-slate-800/70 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>QR Code instantâneo para escanear com a câmera</span>
                    </div>
                    <div className="p-2.5 bg-slate-900/80 border border-slate-800/70 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Preserva seu histórico persistente e cookies</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/70">
                    <div className="text-xs text-slate-400">
                      {tunnelInfo?.mode === 'quick' && tunnelInfo.status === 'connected' ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Túnel gratuito conectado e pronto para uso!
                        </span>
                      ) : (
                        <span>Pronto para conectar com apenas 1 clique.</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {tunnelInfo?.mode === 'quick' && tunnelInfo.status === 'connected' ? (
                        <button
                          type="button"
                          onClick={handleStartQuickTunnel}
                          disabled={isSavingTunnel}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Gerar Novo Link Gratuito</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartQuickTunnel}
                          disabled={isSavingTunnel}
                          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 rounded-lg shadow-lg shadow-sky-600/25 transition-all transform hover:scale-[1.01]"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>{isSavingTunnel ? 'Conectando à Cloudflare...' : 'Ativar Túnel Gratuito Agora'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Custom Domain via Cloudflare Zero Trust */}
              {tunnelSubTab === 'custom' && (
                <div className="p-5 bg-slate-950/70 border border-slate-800/90 rounded-xl space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Domínio Fixo na sua Conta Cloudflare (Zero Trust)
                        </span>
                        {tunnelInfo?.hasToken && (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
                            Token Cadastrado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Quando você quiser usar um domínio permanente que comprou ou cadastrou na Cloudflare (ex.: <code className="text-sky-300 font-mono">https://uvdownloader.com</code>), configure aqui com o token da sua conta.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Seu Domínio Personalizado (ex.: https://uvdownloader.com)
                      </label>
                      <input
                        type="text"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder="https://uvdownloader.com"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Token do Túnel Cloudflare (ou comando copiado do painel)
                      </label>
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder={
                          tunnelInfo?.hasToken
                            ? '•••••••••••••••••••••••• (Token já salvo — cole outro se quiser trocar)'
                            : 'Cole aqui: eyJhIjoi... ou docker run cloudflare/cloudflared ... --token eyJ...'
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Pode colar o comando inteiro que aparece na tela da Cloudflare — o sistema extrai o código <code className="text-slate-400">eyJ...</code> automaticamente.
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSaveCustomTunnel}
                        disabled={isSavingTunnel || (!tokenInput.trim() && !tunnelInfo?.hasToken)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar e Ativar Meu Domínio</span>
                      </button>
                    </div>
                  </div>

                  {/* Step-by-step instructions for Cloudflare Zero Trust Dashboard */}
                  <div className="p-3.5 bg-slate-900/70 border border-slate-800/80 rounded-xl space-y-2 text-xs text-slate-400">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                      <span>Passo a passo no painel Cloudflare Zero Trust:</span>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                      <li>
                        Entre em <strong className="text-slate-200">one.dash.cloudflare.com</strong> &rarr; menu lateral <strong className="text-slate-200">Networks</strong> &rarr; <strong className="text-slate-200">Tunnels</strong>.
                      </li>
                      <li>
                        Clique em <strong className="text-slate-200">Create a tunnel</strong> &rarr; escolha <strong className="text-slate-200">Cloudflared</strong> &rarr; nomeie como <code className="text-sky-300">uv-downloader</code> &rarr; clique em <strong className="text-slate-200">Save tunnel</strong>.
                      </li>
                      <li>
                        Na tela <strong className="text-slate-200">Install and run a connector</strong>, copie o comando (que termina com o código <code className="text-sky-300">eyJ...</code>) e cole no campo acima.
                      </li>
                      <li>
                        Na aba <strong className="text-slate-200">Public Hostname</strong> da Cloudflare:
                        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-300">
                          <li><strong>Domain</strong>: selecione seu domínio (ex.: <code>uvdownloader.com</code>).</li>
                          <li><strong>Service Type</strong>: escolha <code>HTTP</code>.</li>
                          <li><strong>URL</strong>: digite <code>localhost:3000</code> e salve.</li>
                        </ul>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cookies' && (
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
                    Salvo de forma persistente em <code className="text-sky-300">./data/cookies.txt</code>
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
              </div>
            </div>
          )}

          {activeTab === 'server' && (
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
                      <span>Histórico Salvo</span>
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
                      docker-compose.yml (Persistência em ./data)
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

              {/* Docker Update Command */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Comando para Atualizar e Subir Container
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
                        <span>Copiar Comando</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                  {dockerRunSnippet}
                </pre>
              </div>
            </>
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
