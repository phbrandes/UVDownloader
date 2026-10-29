import React from 'react';
import { Youtube, Instagram, Zap, DownloadCloud } from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-900">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
          Como o UV Downloader Funciona no seu Homelab
        </h2>
        <p className="text-sm text-slate-400">
          O servidor processa o link diretamente na sua rede local, contornando bloqueios de navegador e entregando arquivos limpos e organizados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 flex items-center justify-center mb-4">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">TikTok Sem Marca d'Água</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Extrai a fonte direta original em MP4 sem a logotipo flutuante do TikTok e extrai a faixa de áudio MP3 original.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-pink-950/60 text-pink-400 border border-pink-800/40 flex items-center justify-center mb-4">
            <Instagram className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">Instagram Reels & Fotos</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Suporte a Reels em 1080p, publicações com carrossel de fotos em resolução original e stories diretamente pelo shortcode.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-red-950/60 text-red-400 border border-red-800/40 flex items-center justify-center mb-4">
            <Youtube className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">YouTube Vídeos & Shorts</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Escolha entre 1080p Full HD, 720p HD ou extraia a faixa de áudio em MP3 a 320 kbps para salvar no seu servidor.
          </p>
        </div>

        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all">
          <div className="w-10 h-10 rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40 flex items-center justify-center mb-4">
            <DownloadCloud className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">Pinterest Imagens 4K</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Acessa a pasta original de alta resolução no CDN do Pinterest, recuperando a imagem não comprimida e vídeos de pins.
          </p>
        </div>
      </div>
    </section>
  );
};
