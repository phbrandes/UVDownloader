import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

app.use(express.json());

// ================= PERSISTENT STORAGE (./data) ================= //
const DATA_DIR = path.resolve(__dirname, 'data');
const HISTORY_FILE = path.resolve(DATA_DIR, 'history.json');
const COOKIES_FILE = path.resolve(DATA_DIR, 'cookies.txt');
const SETTINGS_FILE = path.resolve(DATA_DIR, 'settings.json');
const TEMP_DIR = fs.existsSync('/tmp') ? '/tmp' : os.tmpdir();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL for metadata & temp MP4/MP3 cache

interface HomelabSettings {
  tunnelMode: 'custom' | 'quick' | 'off';
  publicDomain: string;
  tunnelToken: string;
}

interface QualityOptionItem {
  id: string;
  label: string;
  resolution?: string;
  format: 'mp4' | 'mp3' | 'jpg' | 'jpeg' | 'png' | 'webp';
  type: 'video' | 'audio' | 'image';
  size?: string;
  url: string;
  hasWatermark: boolean;
}

// ================= 10-MINUTE SMART CACHE (/tmp + RAM) ================= //
const extractCache = new Map<string, { platform: string; data: any; expiresAt: number }>();
const mediaFileCache = new Map<string, { file: string; expiresAt: number }>();
const inFlightDownloads = new Map<string, Promise<{ ok: boolean; file: string; err: string }>>();

function normalizeCacheUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch?.[1]) {
    return trimmed.includes('/shorts/')
      ? `https://www.youtube.com/shorts/${ytMatch[1]}`
      : `https://www.youtube.com/watch?v=${ytMatch[1]}`;
  }
  if (/instagram\.com|instagr\.am/i.test(trimmed)) {
    return trimmed.split('?')[0].replace(/\/+$/, '');
  }
  return trimmed;
}

// Periodic Garbage Collector (every 60s) for expired metadata & /tmp media files
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of extractCache.entries()) {
    if (now > entry.expiresAt) extractCache.delete(key);
  }
  for (const [key, entry] of mediaFileCache.entries()) {
    if (now > entry.expiresAt) {
      mediaFileCache.delete(key);
      try {
        if (fs.existsSync(entry.file)) fs.unlinkSync(entry.file);
      } catch {}
    }
  }
}, 60_000).unref();

function ensureDataStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaults: HomelabSettings = {
      tunnelMode: process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'custom' : 'off',
      publicDomain: process.env.PUBLIC_DOMAIN || '',
      tunnelToken: process.env.CLOUDFLARE_TUNNEL_TOKEN || '',
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    ensureDataStorage();
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  try {
    ensureDataStorage();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

const readHistory = () => readJson<any[]>(HISTORY_FILE, []);
const writeHistory = (items: any[]) => writeJson(HISTORY_FILE, items);

function readSettings(): HomelabSettings {
  const parsed = readJson<Partial<HomelabSettings>>(SETTINGS_FILE, {});
  return {
    tunnelMode: parsed.tunnelMode || (process.env.CLOUDFLARE_TUNNEL_TOKEN ? 'custom' : 'off'),
    publicDomain: parsed.publicDomain || process.env.PUBLIC_DOMAIN || '',
    tunnelToken: parsed.tunnelToken || process.env.CLOUDFLARE_TUNNEL_TOKEN || '',
  };
}

function getCookiesInfo() {
  if (!fs.existsSync(COOKIES_FILE)) return { exists: false, domains: [] };
  try {
    const stats = fs.statSync(COOKIES_FILE);
    const lines = fs.readFileSync(COOKIES_FILE, 'utf-8').split('\n');
    const domains = new Set<string>();
    for (const line of lines) {
      const t = line.trim();
      if (!t || (t.startsWith('#') && !t.startsWith('#HttpOnly_'))) continue;
      const host = t.replace('#HttpOnly_', '').split('\t')[0]?.replace(/^\./, '');
      if (host) domains.add(host);
    }
    return {
      exists: true,
      size: `${(stats.size / 1024).toFixed(1)} KB`,
      domains: Array.from(domains).slice(0, 8),
      lastModified: stats.mtime.toLocaleDateString('pt-BR'),
    };
  } catch {
    return { exists: false, domains: [] };
  }
}

ensureDataStorage();

// ================= CLOUDFLARE TUNNEL MANAGER ================= //
let tunnelProc: ReturnType<typeof spawn> | null = null;
let tunnelStatus: 'connected' | 'starting' | 'disconnected' | 'error' = 'disconnected';
let quickTunnelUrl = '';
let lastTunnelError = '';

function cleanTokenInput(raw: string): string {
  const match = raw.trim().match(/eyJ[A-Za-z0-9_\-=]+/);
  return match ? match[0] : raw.trim();
}

function normalizeDomainInput(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

async function resolveCloudflaredBin(): Promise<string> {
  if (fs.existsSync('/usr/local/bin/cloudflared')) return '/usr/local/bin/cloudflared';
  const tmpBin = '/tmp/cloudflared';
  if (fs.existsSync(tmpBin)) return tmpBin;
  try {
    const res = await fetch(
      'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
      { redirect: 'follow' }
    );
    if (res.ok) {
      fs.writeFileSync(tmpBin, Buffer.from(await res.arrayBuffer()));
      fs.chmodSync(tmpBin, 0o755);
      return tmpBin;
    }
  } catch {}
  return 'cloudflared';
}

function stopTunnelProcess() {
  if (tunnelProc) {
    try {
      tunnelProc.kill('SIGTERM');
    } catch {}
    tunnelProc = null;
  }
  tunnelStatus = 'disconnected';
  quickTunnelUrl = '';
}

async function startOrRestartTunnel() {
  stopTunnelProcess();
  lastTunnelError = '';
  const settings = readSettings();
  if (settings.tunnelMode === 'off') return;
  if (settings.tunnelMode === 'custom' && !settings.tunnelToken) {
    tunnelStatus = 'error';
    lastTunnelError = 'Token do Cloudflare Zero Trust não informado.';
    return;
  }

  tunnelStatus = 'starting';
  const bin = await resolveCloudflaredBin();
  const args =
    settings.tunnelMode === 'custom'
      ? ['tunnel', '--no-autoupdate', 'run', '--token', settings.tunnelToken]
      : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`];

  try {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProc = proc;

    const onLog = (chunk: Buffer) => {
      const text = chunk.toString();
      const tryMatch = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (tryMatch) {
        quickTunnelUrl = tryMatch[0];
        tunnelStatus = 'connected';
      }
      if (text.includes('Registered tunnel connection') || (text.includes('Connection') && text.includes('registered'))) {
        tunnelStatus = 'connected';
        lastTunnelError = '';
      }
      if (text.includes('Provided Tunnel token is not valid')) {
        tunnelStatus = 'error';
        lastTunnelError = 'O Token Cloudflare informado é inválido.';
      }
    };

    proc.stdout.on('data', onLog);
    proc.stderr.on('data', onLog);
    proc.on('error', (err) => {
      if (tunnelProc === proc) {
        tunnelStatus = 'error';
        lastTunnelError = `Falha ao iniciar cloudflared: ${err.message}`;
      }
    });
    proc.on('close', (code) => {
      if (tunnelProc === proc) {
        tunnelProc = null;
        if (tunnelStatus !== 'error') tunnelStatus = 'disconnected';
        if (code && code !== 0 && !lastTunnelError) {
          tunnelStatus = 'error';
          lastTunnelError = `Túnel encerrado (código ${code}).`;
        }
      }
    });
  } catch (err: any) {
    tunnelStatus = 'error';
    lastTunnelError = err?.message || 'Erro ao iniciar cloudflared.';
  }
}

function getTunnelInfo() {
  const s = readSettings();
  return {
    mode: s.tunnelMode,
    status: tunnelStatus,
    publicDomain: s.publicDomain,
    quickTunnelUrl,
    activeUrl: s.tunnelMode === 'custom' ? s.publicDomain : s.tunnelMode === 'quick' ? quickTunnelUrl : '',
    hasToken: Boolean(s.tunnelToken),
    lastError: lastTunnelError || undefined,
  };
}

// ================= MEDIA EXTRACTORS ================= //
function detectPlatform(urlStr: string): 'youtube' | 'instagram' | 'tiktok' | 'pinterest' | 'generic' {
  const u = urlStr.trim().toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('tiktok.com') || u.includes('douyin.com')) return 'tiktok';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
  return 'generic';
}

function sanitizeFilename(name: string, maxLen = 45): string {
  return (name || 'media').replace(/[\\/:*?"<>|]/g, '_').slice(0, maxLen).trim();
}

async function runYtDlpJson(targetUrl: string): Promise<any | null> {
  return new Promise((resolve) => {
    const args = ['--dump-single-json', '--no-warnings', '--no-playlist'];
    if (fs.existsSync(COOKIES_FILE)) args.push('--cookies', COOKIES_FILE);
    args.push(targetUrl);

    let stdout = '';
    const proc = spawn('yt-dlp', args);
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {}
      resolve(null);
    }, 15000);

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        try {
          return resolve(JSON.parse(stdout.trim()));
        } catch {}
      }
      resolve(null);
    });
  });
}

// 1. YouTube
async function extractYouTube(rawUrl: string) {
  const match = rawUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = match?.[1] || '';
  const isShorts = rawUrl.includes('/shorts/');
  const canonicalUrl = normalizeCacheUrl(rawUrl);

  let title = 'YouTube Video';
  let author = 'YouTube Creator';
  let authorUrl = '';
  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`);
    if (res.ok) {
      const data = await res.json();
      title = data.title || title;
      author = data.author_name || author;
      authorUrl = data.author_url || '';
    }
  } catch {}

  const cleanTitle = sanitizeFilename(title);
  const makeDlUrl = (q: string, ext: string, type: 'video' | 'audio') =>
    `/api/download?url=${encodeURIComponent(canonicalUrl)}&type=${type}&quality=${q}&filename=${encodeURIComponent(`${cleanTitle}_${q}.${ext}`)}&platform=youtube`;

  const qualities: QualityOptionItem[] = [
    {
      id: 'yt-1080p',
      label: '1080p Full HD (MP4)',
      resolution: '1920x1080',
      format: 'mp4',
      type: 'video',
      size: '~45 MB',
      url: makeDlUrl('1080', 'mp4', 'video'),
      hasWatermark: false,
    },
    {
      id: 'yt-720p',
      label: '720p HD Rápido (MP4)',
      resolution: '1280x720',
      format: 'mp4',
      type: 'video',
      size: '~22 MB',
      url: makeDlUrl('720', 'mp4', 'video'),
      hasWatermark: false,
    },
    {
      id: 'yt-480p',
      label: '480p SD Leve (MP4)',
      resolution: '854x480',
      format: 'mp4',
      type: 'video',
      size: '~12 MB',
      url: makeDlUrl('480', 'mp4', 'video'),
      hasWatermark: false,
    },
    {
      id: 'yt-audio',
      label: 'Áudio MP3 (320 kbps)',
      resolution: 'Áudio Estéreo',
      format: 'mp3',
      type: 'audio',
      size: '~5 MB',
      url: makeDlUrl('mp3', 'mp3', 'audio'),
      hasWatermark: false,
    },
    {
      id: 'yt-thumb',
      label: 'Capa Miniatura HD (JPG)',
      resolution: '1280x720',
      format: 'jpg',
      type: 'image',
      size: '~350 KB',
      url: `/api/download?url=${encodeURIComponent(thumbnail)}&type=image&filename=${encodeURIComponent(`${cleanTitle}_cover.jpg`)}&platform=youtube`,
      hasWatermark: false,
    },
  ];

  return {
    id: videoId || `yt-${Date.now()}`,
    originalUrl: rawUrl,
    platform: 'youtube' as const,
    mediaType: 'video' as const,
    title,
    author,
    authorUrl,
    thumbnail,
    duration: isShorts ? '0:58' : '3:45',
    description: 'Vídeo do YouTube com download paralelo (-N 8) e cache inteligente de 10 min.',
    qualities,
  };
}

// 2. TikTok
async function extractTikTok(url: string) {
  let title = 'TikTok Vídeo';
  let author = 'tiktok_user';
  let authorAvatar = '';
  let thumbnail = '';
  let videoNoWatermark = '';
  let videoHd = '';
  let musicUrl = '';
  let duration = '0:30';

  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) {
      const { data: item } = await res.json();
      if (item) {
        title = item.title || title;
        author = item.author?.unique_id ? `@${item.author.unique_id}` : item.author?.nickname || author;
        authorAvatar = item.author?.avatar || '';
        thumbnail = item.cover || item.origin_cover || '';
        videoNoWatermark = item.play || '';
        videoHd = item.hdplay || item.play || '';
        musicUrl = item.music || '';
        if (item.duration) {
          duration = `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}`;
        }
      }
    }
  } catch {}

  const cleanTitle = sanitizeFilename(title, 50);
  const qualities: QualityOptionItem[] = [
    {
      id: 'tt-hd',
      label: "Vídeo HD Sem Marca d'Água (MP4)",
      resolution: '1080p HD',
      format: 'mp4',
      type: 'video',
      size: '~18 MB',
      url: `/api/download?url=${encodeURIComponent(videoHd || videoNoWatermark || url)}&filename=${encodeURIComponent(`${cleanTitle}_HD.mp4`)}&platform=tiktok`,
      hasWatermark: false,
    },
    {
      id: 'tt-sd',
      label: "Vídeo Sem Marca d'Água Padrão (MP4)",
      resolution: '720p',
      format: 'mp4',
      type: 'video',
      size: '~9 MB',
      url: `/api/download?url=${encodeURIComponent(videoNoWatermark || url)}&filename=${encodeURIComponent(`${cleanTitle}_SD.mp4`)}&platform=tiktok`,
      hasWatermark: false,
    },
  ];

  if (musicUrl) {
    qualities.push({
      id: 'tt-audio',
      label: 'Áudio Original TikTok (MP3)',
      resolution: 'Áudio MP3',
      format: 'mp3',
      type: 'audio',
      size: '~3 MB',
      url: `/api/download?url=${encodeURIComponent(musicUrl)}&filename=${encodeURIComponent(`${cleanTitle}_audio.mp3`)}&platform=tiktok`,
      hasWatermark: false,
    });
  }

  if (thumbnail) {
    qualities.push({
      id: 'tt-cover',
      label: 'Capa / Thumbnail (JPG)',
      resolution: 'Original',
      format: 'jpg',
      type: 'image',
      size: '~250 KB',
      url: `/api/download?url=${encodeURIComponent(thumbnail)}&filename=${encodeURIComponent(`${cleanTitle}_cover.jpg`)}&platform=tiktok`,
      hasWatermark: false,
    });
  }

  return {
    id: `tiktok-${Date.now()}`,
    originalUrl: url,
    platform: 'tiktok' as const,
    mediaType: 'video' as const,
    title,
    author,
    authorAvatar,
    thumbnail,
    duration,
    description: "Vídeo do TikTok extraído sem marca d'água.",
    qualities,
  };
}

// 3. Instagram
async function extractInstagram(url: string) {
  const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
  const shortcode = cleanUrl.match(/\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/)?.[1] || '';
  const isReel = /\/(reel|reels|tv)\//.test(cleanUrl);
  const canonicalUrl = shortcode
    ? `https://www.instagram.com/${cleanUrl.includes('/p/') ? 'p' : 'reel'}/${shortcode}/`
    : cleanUrl;

  let title = isReel ? 'Instagram Reel' : 'Instagram Publicação';
  let author = '@instagram_creator';
  let rawThumbnail = '';
  let imageUrl = '';
  let duration = isReel ? '0:30' : undefined;

  const ytInfo = await runYtDlpJson(canonicalUrl);
  if (ytInfo) {
    title = (ytInfo.title || ytInfo.description || title).split('\n')[0].slice(0, 70).trim() || title;
    const rawAuthor = ytInfo.channel || ytInfo.uploader || ytInfo.uploader_id;
    if (rawAuthor) author = `@${String(rawAuthor).replace(/^@/, '')}`;
    if (typeof ytInfo.duration === 'number' && ytInfo.duration > 0) {
      duration = `${Math.floor(ytInfo.duration / 60)}:${Math.floor(ytInfo.duration % 60).toString().padStart(2, '0')}`;
    }
    rawThumbnail =
      ytInfo.thumbnail ||
      ytInfo.thumbnails?.[ytInfo.thumbnails.length - 1]?.url ||
      ytInfo.entries?.[0]?.thumbnail ||
      '';
    if (ytInfo.ext === 'jpg' || ytInfo.ext === 'jpeg' || (!ytInfo.duration && ytInfo.url && !ytInfo.url.includes('.mp4'))) {
      imageUrl = ytInfo.url;
    } else if (Array.isArray(ytInfo.entries)) {
      imageUrl = ytInfo.entries.find((e: any) => e.ext === 'jpg' || e.ext === 'jpeg' || !e.duration)?.url || '';
    }
    if (!imageUrl && rawThumbnail) imageUrl = rawThumbnail;
  }

  if (!rawThumbnail && shortcode) {
    try {
      const embedRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (embedRes.ok) {
        const html = await embedRes.text();
        const imgMatch =
          html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i) ||
          html.match(/"display_url"\s*:\s*"([^"]+)"/i);
        if (imgMatch?.[1]) {
          rawThumbnail = imgMatch[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          imageUrl = rawThumbnail;
        }
        const userMatch = html.match(/class="UsernameText"[^>]*>([^<]+)</i);
        if (userMatch?.[1]) author = `@${userMatch[1].trim().replace(/^@/, '')}`;
      }
    } catch {}
  }

  const displayThumbnail = rawThumbnail
    ? `/api/download?url=${encodeURIComponent(rawThumbnail)}&type=image&filename=thumbnail.jpeg&platform=instagram&inline=1`
    : '';
  const cleanTitle = sanitizeFilename(title);

  return {
    id: `ig-${shortcode || Date.now()}`,
    originalUrl: url,
    platform: 'instagram' as const,
    mediaType: isReel ? ('video' as const) : ('image' as const),
    title,
    author,
    thumbnail: displayThumbnail,
    duration,
    description: isReel ? 'Reel do Instagram extraído via yt-dlp em MP4.' : 'Publicação do Instagram em alta definição.',
    qualities: [
      {
        id: 'ig-video-hd',
        label: isReel ? "Vídeo Reel Sem Marca d'Água (MP4 HD)" : 'Vídeo MP4 Alta Qualidade',
        resolution: '1080p HD',
        format: 'mp4' as const,
        type: 'video' as const,
        size: '~12 MB',
        url: `/api/download?url=${encodeURIComponent(canonicalUrl)}&type=video&quality=1080&filename=${encodeURIComponent(`${cleanTitle}.mp4`)}&platform=instagram`,
        hasWatermark: false,
      },
      {
        id: 'ig-image-jpeg',
        label: 'Imagem / Foto em Resolução Máxima (JPEG)',
        resolution: 'Original 1080p',
        format: 'jpeg' as const,
        type: 'image' as const,
        size: '~1.5 MB',
        url: `/api/download?url=${encodeURIComponent(imageUrl || rawThumbnail || canonicalUrl)}&type=image&filename=${encodeURIComponent(`${cleanTitle}.jpeg`)}&platform=instagram`,
        hasWatermark: false,
      },
      {
        id: 'ig-audio',
        label: 'Áudio Extraído do Reel / Vídeo (MP3)',
        resolution: 'Áudio Estéreo',
        format: 'mp3' as const,
        type: 'audio' as const,
        size: '~2.8 MB',
        url: `/api/download?url=${encodeURIComponent(canonicalUrl)}&type=audio&filename=${encodeURIComponent(`${cleanTitle}_audio.mp3`)}&platform=instagram`,
        hasWatermark: false,
      },
    ],
  };
}

// 4. Pinterest
async function extractPinterest(url: string) {
  let title = 'Pinterest Pin';
  let author = 'Pinterest Creator';
  let description = 'Imagem original em altíssima definição extraída diretamente do CDN do Pinterest.';
  let highResImage = '';
  let videoUrl = '';
  let thumbnail = '';

  const decodeEntities = (s: string) =>
    s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  const extractMeta = (html: string, prop: string): string => {
    const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m =
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'));
    return m?.[1] ? decodeEntities(m[1].trim()) : '';
  };

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const rawTitle = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
      if (rawTitle) title = decodeEntities(rawTitle).replace(/\s*\|\s*Pinterest$/i, '').trim();

      const rawDesc = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description');
      if (rawDesc) description = rawDesc;

      const pinnerMatch =
        html.match(/"pinner"\s*:\s*\{[^}]*"full_name"\s*:\s*"([^"]+)"/i) ||
        html.match(/"pinner"\s*:\s*\{[^}]*"username"\s*:\s*"([^"]+)"/i);
      if (pinnerMatch?.[1]) {
        author = pinnerMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)));
      }

      const metaImage = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image:src') || extractMeta(html, 'twitter:image');
      if (metaImage) {
        thumbnail = metaImage;
        const hashPath = metaImage.match(/pinimg\.com\/(?:[^/]+)\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]+)/i)?.[1];
        if (hashPath) {
          const origMatch = html.match(
            new RegExp(`https:\\/\\/i\\.pinimg\\.com\\/originals\\/${hashPath.replace(/\//g, '\\/')}\\.(?:jpg|jpeg|png|gif|webp)`, 'i')
          );
          if (origMatch?.[0]) highResImage = origMatch[0];
        }
        if (!highResImage) {
          const candidate = metaImage.replace(/\/(236x|474x|564x|736x|1200x|600x315)\//, '/originals/');
          try {
            const head = await fetch(candidate, { method: 'HEAD' });
            highResImage = head.ok ? candidate : metaImage;
          } catch {
            highResImage = candidate;
          }
        }
      }

      const metaVideo = extractMeta(html, 'og:video') || extractMeta(html, 'og:video:secure_url') || extractMeta(html, 'twitter:player:stream');
      const v1Video = html.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\s<>\\]+\.mp4/i)?.[0];
      if (metaVideo?.includes('.mp4')) videoUrl = metaVideo;
      else if (v1Video) videoUrl = v1Video.replace(/\\u002F|\\\//g, '/');
    }
  } catch {}

  if (!thumbnail) throw new Error('Não foi possível localizar a imagem ou vídeo deste Pin do Pinterest.');

  const cleanTitle = sanitizeFilename(title);
  const qualities: QualityOptionItem[] = [];

  if (videoUrl) {
    qualities.push({
      id: 'pin-video-hd',
      label: 'Vídeo do Pin HD (MP4)',
      resolution: 'Original HD',
      format: 'mp4',
      type: 'video',
      size: '~12 MB',
      url: `/api/download?url=${encodeURIComponent(videoUrl)}&type=video&filename=${encodeURIComponent(`${cleanTitle}.mp4`)}&platform=pinterest`,
      hasWatermark: false,
    });
  }

  qualities.push(
    {
      id: 'pin-image-original',
      label: 'Imagem Original Full Resolution (JPEG)',
      resolution: 'Original (4K/HD)',
      format: 'jpeg',
      type: 'image',
      size: '~3.2 MB',
      url: `/api/download?url=${encodeURIComponent(highResImage || thumbnail)}&type=image&filename=${encodeURIComponent(`${cleanTitle}_original.jpeg`)}&platform=pinterest`,
      hasWatermark: false,
    },
    {
      id: 'pin-image-standard',
      label: 'Imagem Otimizada Web (736p JPEG)',
      resolution: '736x Padrão',
      format: 'jpeg',
      type: 'image',
      size: '~850 KB',
      url: `/api/download?url=${encodeURIComponent(thumbnail)}&type=image&filename=${encodeURIComponent(`${cleanTitle}_736x.jpeg`)}&platform=pinterest`,
      hasWatermark: false,
    }
  );

  return {
    id: `pin-${Date.now()}`,
    originalUrl: url,
    platform: 'pinterest' as const,
    mediaType: videoUrl ? ('video' as const) : ('image' as const),
    title,
    author,
    thumbnail: highResImage || thumbnail,
    description,
    qualities,
  };
}

// 5. Generic
async function extractGeneric(url: string) {
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const isAudio = /\.(mp3|m4a|wav)(\?|$)/i.test(url);
  const filename = url.split('/').pop()?.split('?')[0] || 'media_download';
  const format = (isVideo ? 'mp4' : isAudio ? 'mp3' : 'jpg') as 'mp4' | 'mp3' | 'jpg';
  const type = (isVideo ? 'video' : isAudio ? 'audio' : 'image') as 'video' | 'audio' | 'image';

  return {
    id: `generic-${Date.now()}`,
    originalUrl: url,
    platform: 'generic' as const,
    mediaType: type,
    title: filename,
    author: new URL(url).hostname,
    thumbnail: type === 'image' ? url : '',
    description: 'Link direto analisado e pronto para download.',
    qualities: [
      {
        id: 'generic-file',
        label: `Download Direto (${type.toUpperCase()})`,
        resolution: 'Original',
        format,
        type,
        size: 'Direto',
        url: `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&platform=generic`,
        hasWatermark: false,
      },
    ],
  };
}

// ================= API ENDPOINTS ================= //

app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Informe uma URL válida para extração de mídia.' });
    }

    const cacheKey = normalizeCacheUrl(url);
    const cached = extractCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json({ success: true, platform: cached.platform, data: cached.data, cached: true });
    }

    const platform = detectPlatform(url);
    const extractors = {
      youtube: extractYouTube,
      tiktok: extractTikTok,
      instagram: extractInstagram,
      pinterest: extractPinterest,
      generic: extractGeneric,
    };
    const data = await extractors[platform](url);
    extractCache.set(cacheKey, { platform, data, expiresAt: Date.now() + CACHE_TTL_MS });

    return res.json({ success: true, platform, data });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Não foi possível extrair a mídia desse link. Verifique se o link é público ou válido.',
      details: error?.message,
    });
  }
});

app.get('/api/download', async (req: Request, res: Response) => {
  try {
    const { url, filename = 'download', platform = 'generic', quality } = req.query as Record<string, string>;
    if (!url) return res.status(400).send('URL de download ausente.');

    let targetUrl = decodeURIComponent(url);
    const isInline = req.query.inline === '1';
    const isVideoOrAudio = /\.(mp4|webm|mp3)$/i.test(filename) || req.query.type === 'video' || req.query.type === 'audio';
    const isYtDlpPlatform = /(youtube\.com\/(watch|shorts)|youtu\.be\/|instagram\.com\/|instagr\.am\/)/i.test(targetUrl);

    // 1. Accelerated YouTube & Instagram video/audio download via yt-dlp (-N 8) + 10-min /tmp cache
    if (isYtDlpPlatform && isVideoOrAudio && !isInline) {
      const isAudio = filename.endsWith('.mp3') || req.query.type === 'audio';
      const ext = isAudio ? 'mp3' : 'mp4';
      const cleanFilename = filename.replace(/\.(webm|mp4|m4a|mp3|jpeg|jpg)$/i, '') + '.' + ext;
      const targetRes = quality && ['1080', '720', '480'].includes(quality) ? quality : '1080';

      const canonicalTarget = normalizeCacheUrl(targetUrl);
      const cacheKey = `${canonicalTarget}|${isAudio ? 'mp3' : targetRes}`;
      const cacheHash = crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 14);
      const cachedFilePath = path.join(TEMP_DIR, `uv-cache-${cacheHash}.${ext}`);

      const streamCachedFile = (filePath: string) => {
        const stat = fs.statSync(filePath);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(cleanFilename)}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`
        );
        fs.createReadStream(filePath, { highWaterMark: 256 * 1024 }).pipe(res);
      };

      // Instant cache hit (0.01s) if downloaded within the last 10 minutes
      const existingCache = mediaFileCache.get(cacheKey);
      if (existingCache && Date.now() < existingCache.expiresAt && fs.existsSync(existingCache.file)) {
        existingCache.expiresAt = Date.now() + CACHE_TTL_MS;
        streamCachedFile(existingCache.file);
        return;
      }

      // Deduplicate concurrent downloads of the same video + quality
      let downloadPromise = inFlightDownloads.get(cacheKey);
      if (!downloadPromise) {
        const isInstagram = /instagram\.com|instagr\.am/i.test(canonicalTarget);

        const runAttempt = (
          useCookies: boolean,
          useFormatSort: boolean
        ): Promise<{ ok: boolean; file: string; err: string }> =>
          new Promise((resolve) => {
            try {
              if (fs.existsSync(cachedFilePath)) fs.unlinkSync(cachedFilePath);
            } catch {}

            const args = [
              '--no-warnings',
              '--no-playlist',
              '--no-mtime',
              '--concurrent-fragments',
              '8',
              '--buffer-size',
              '64K',
            ];

            if (!isInstagram && !useCookies) {
              args.push('--extractor-args', 'youtube:player_client=ios,android_vr,web');
            }
            if (useCookies && fs.existsSync(COOKIES_FILE)) {
              args.push('--cookies', COOKIES_FILE);
            }

            if (isAudio) {
              args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
            } else {
              if (useFormatSort) {
                args.push('-f', 'bv*+ba/b', '-S', `res:${targetRes},ext:mp4:m4a,vcodec:h264,acodec:aac`);
              } else {
                args.push('--remux-video', 'mp4');
              }
              args.push('--merge-output-format', 'mp4');
            }

            args.push('-o', cachedFilePath, canonicalTarget);

            let errStr = '';
            const proc = spawn('yt-dlp', args);
            proc.stderr.on('data', (d) => (errStr += d.toString()));
            proc.on('error', (err) => resolve({ ok: false, file: '', err: err.message }));
            proc.on('close', (code) => {
              if (code === 0 && fs.existsSync(cachedFilePath)) {
                resolve({ ok: true, file: cachedFilePath, err: '' });
              } else {
                resolve({ ok: false, file: '', err: errStr });
              }
            });
          });

        downloadPromise = (async () => {
          let r = await runAttempt(isInstagram, true);
          if (!r.ok && !isInstagram && fs.existsSync(COOKIES_FILE)) {
            r = await runAttempt(true, true);
          }
          if (!r.ok) {
            r = await runAttempt(fs.existsSync(COOKIES_FILE), false);
          }
          if (r.ok && r.file) {
            mediaFileCache.set(cacheKey, { file: r.file, expiresAt: Date.now() + CACHE_TTL_MS });
          }
          return r;
        })().finally(() => {
          inFlightDownloads.delete(cacheKey);
        });

        inFlightDownloads.set(cacheKey, downloadPromise);
      }

      const result = await downloadPromise;
      if (res.writableEnded || res.destroyed) return;

      if (result.ok && result.file && fs.existsSync(result.file)) {
        streamCachedFile(result.file);
      } else if (!res.headersSent) {
        res.status(403).send(
          result.err || 'Não foi possível baixar o vídeo em MP4. Verifique os cookies na aba Homelab.'
        );
      }
      return;
    }

    // Resolve Instagram post URL to CDN image if needed
    if (
      (req.query.type === 'image' || /\.(jpeg|jpg)$/i.test(filename)) &&
      /instagram\.com|instagr\.am/i.test(targetUrl) &&
      !/cdninstagram\.com|fbcdn\.net/i.test(targetUrl)
    ) {
      const info = await runYtDlpJson(targetUrl);
      const resolved = info?.thumbnail || info?.thumbnails?.[info.thumbnails.length - 1]?.url || info?.url;
      if (resolved) targetUrl = resolved;
    }

    // 2. Direct CDN stream proxy
    if (/^https?:\/\//i.test(targetUrl)) {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer:
            platform === 'tiktok'
              ? 'https://www.tiktok.com/'
              : platform === 'instagram'
              ? 'https://www.instagram.com/'
              : 'https://www.google.com/',
        },
      });

      if (!response.ok || !response.body) {
        return res.status(response.status).send(`Falha ao obter mídia externa: ${response.statusText}`);
      }

      let contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');

      if (contentType.includes('text/html') && /\.(mp4|mp3|jpeg|jpg)$/i.test(filename)) {
        return res.status(403).send('A plataforma exigiu autenticação adicional. Salve os cookies na aba Homelab.');
      }
      if (/\.(jpeg|jpg)$/i.test(filename) || req.query.type === 'image') {
        contentType = 'image/jpeg';
      }

      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        isInline
          ? 'inline'
          : `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      if (contentLength) res.setHeader('Content-Length', contentLength);

      Readable.fromWeb(response.body as any).pipe(res);
      return;
    }

    return res.status(400).send('Formato de URL inválido.');
  } catch (error: any) {
    return res.status(500).send('Erro ao realizar proxy do download: ' + error.message);
  }
});

// History & Server Endpoints
app.get('/api/history', (_req: Request, res: Response) => {
  return res.json({ success: true, data: readHistory() });
});

app.post('/api/history', (req: Request, res: Response) => {
  const item = req.body;
  if (!item?.id || !item?.title) return res.status(400).json({ error: 'Dados incompletos.' });
  const updated = [item, ...readHistory().filter((h: any) => h.id !== item.id)].slice(0, 200);
  writeHistory(updated);
  return res.json({ success: true, count: updated.length });
});

app.delete('/api/history/:id', (req: Request, res: Response) => {
  const updated = readHistory().filter((h: any) => h.id !== req.params.id);
  writeHistory(updated);
  return res.json({ success: true, data: updated });
});

app.delete('/api/history', (_req: Request, res: Response) => {
  writeHistory([]);
  return res.json({ success: true });
});

app.get('/api/server-info', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  return res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    memoryUsage: { rss: mb(mem.rss), heapTotal: mb(mem.heapTotal), heapUsed: mb(mem.heapUsed) },
    homelabReady: true,
    nodeVersion: process.version,
    historyCount: readHistory().length,
    environment: process.env.NODE_ENV || 'development',
    cookies: getCookiesInfo(),
    tunnel: getTunnelInfo(),
  });
});

app.get('/api/cookies', (_req: Request, res: Response) => res.json(getCookiesInfo()));

app.post('/api/cookies', (req: Request, res: Response) => {
  const { content } = req.body;
  if (typeof content !== 'string') return res.status(400).json({ error: 'Conteúdo inválido.' });
  ensureDataStorage();
  fs.writeFileSync(COOKIES_FILE, content.trim(), 'utf-8');
  return res.json(getCookiesInfo());
});

app.delete('/api/cookies', (_req: Request, res: Response) => {
  if (fs.existsSync(COOKIES_FILE)) fs.unlinkSync(COOKIES_FILE);
  return res.json({ success: true });
});

app.get('/api/tunnel', (_req: Request, res: Response) => res.json(getTunnelInfo()));

app.post('/api/tunnel', async (req: Request, res: Response) => {
  try {
    const { mode, publicDomain, tunnelToken } = req.body as {
      mode?: 'custom' | 'quick' | 'off';
      publicDomain?: string;
      tunnelToken?: string;
    };
    const current = readSettings();
    const updatedMode = mode || 'custom';
    const updatedDomain = typeof publicDomain === 'string' ? normalizeDomainInput(publicDomain) : current.publicDomain;
    const cleanedToken =
      typeof tunnelToken === 'string' && tunnelToken.trim() ? cleanTokenInput(tunnelToken) : current.tunnelToken;

    if (updatedMode === 'custom' && !cleanedToken) {
      return res.status(400).json({ error: 'Cole o Token do seu túnel Cloudflare Zero Trust.' });
    }

    writeJson(SETTINGS_FILE, {
      tunnelMode: updatedMode,
      publicDomain: updatedDomain,
      tunnelToken: cleanedToken,
    });
    await startOrRestartTunnel();
    await new Promise((r) => setTimeout(r, 1200));
    return res.json(getTunnelInfo());
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao configurar túnel: ' + error.message });
  }
});

app.delete('/api/tunnel', (_req: Request, res: Response) => {
  writeJson(SETTINGS_FILE, { ...readSettings(), tunnelMode: 'off' });
  stopTunnelProcess();
  return res.json(getTunnelInfo());
});

async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[UV Downloader] Servidor Homelab ativo em http://0.0.0.0:${PORT}`);
    if (readSettings().tunnelMode !== 'off') {
      startOrRestartTunnel().catch(() => {});
    }
  });
}

startServer();
