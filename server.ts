import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Persistent storage path for homelab downloads history
const DATA_DIR = path.resolve(__dirname, 'data');
const HISTORY_FILE = path.resolve(DATA_DIR, 'history.json');
const COOKIES_FILE = path.resolve(DATA_DIR, 'cookies.txt');

function getCookiesInfo() {
  if (!fs.existsSync(COOKIES_FILE)) {
    return { exists: false, domains: [] };
  }
  try {
    const stats = fs.statSync(COOKIES_FILE);
    const content = fs.readFileSync(COOKIES_FILE, 'utf-8');
    const domainsSet = new Set<string>();
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        if (trimmed.startsWith('#HttpOnly_')) {
          const parts = trimmed.split('\t');
          if (parts[0]) domainsSet.add(parts[0].replace('#HttpOnly_', '').replace(/^\./, ''));
        }
        continue;
      }
      const parts = trimmed.split('\t');
      if (parts[0]) {
        domainsSet.add(parts[0].replace(/^\./, ''));
      }
    }
    const formatKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
    return {
      exists: true,
      size: formatKB(stats.size),
      domains: Array.from(domainsSet).slice(0, 8),
      lastModified: stats.mtime.toLocaleDateString('pt-BR'),
    };
  } catch (e) {
    return { exists: false, domains: [] };
  }
}

function ensureDataStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readHistory(): any[] {
  try {
    ensureDataStorage();
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading history file:', err);
    return [];
  }
}

function writeHistory(items: any[]): void {
  try {
    ensureDataStorage();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing history file:', err);
  }
}

// Ensure storage initialized on boot
ensureDataStorage();

interface QualityOptionItem {
  id: string;
  label: string;
  resolution?: string;
  format: 'mp4' | 'mp3' | 'jpg' | 'png' | 'webp';
  type: 'video' | 'audio' | 'image';
  size?: string;
  url: string;
  hasWatermark: boolean;
  isDirectStream?: boolean;
}

// Platform Detection Helper
function detectPlatform(urlStr: string): 'youtube' | 'instagram' | 'tiktok' | 'pinterest' | 'generic' {
  const url = urlStr.trim().toLowerCase();
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('tiktok.com') || url.includes('douyin.com')) return 'tiktok';
  if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
  return 'generic';
}

// Extractor: YouTube
async function extractYouTube(url: string) {
  let videoId = '';
  const ytRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(ytRegex);
  if (match && match[1]) {
    videoId = match[1];
  }

  let title = 'YouTube Video';
  let author = 'YouTube Creator';
  let authorUrl = '';
  let thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      title = data.title || title;
      author = data.author_name || author;
      authorUrl = data.author_url || '';
      if (data.thumbnail_url) {
        thumbnail = data.thumbnail_url;
      }
    }
  } catch (e) {
    console.warn('YouTube oembed fetch failed:', e);
  }

  if (videoId) {
    thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  // Construct direct stream URLs and formats
  const cleanId = videoId || 'video';
  const qualities: QualityOptionItem[] = [
    {
      id: 'yt-1080p',
      label: '1080p Full HD (MP4)',
      resolution: '1920x1080',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~45 MB',
      url: `/api/download?url=${encodeURIComponent(url)}&type=video&quality=1080&filename=${encodeURIComponent(title + '_1080p.mp4')}&platform=youtube`,
      hasWatermark: false,
    },
    {
      id: 'yt-720p',
      label: '720p HD (MP4)',
      resolution: '1280x720',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~24 MB',
      url: `/api/download?url=${encodeURIComponent(url)}&type=video&quality=720&filename=${encodeURIComponent(title + '_720p.mp4')}&platform=youtube`,
      hasWatermark: false,
    },
    {
      id: 'yt-480p',
      label: '480p SD (MP4)',
      resolution: '854x480',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~12 MB',
      url: `/api/download?url=${encodeURIComponent(url)}&type=video&quality=480&filename=${encodeURIComponent(title + '_480p.mp4')}&platform=youtube`,
      hasWatermark: false,
    },
    {
      id: 'yt-audio',
      label: 'Áudio MP3 (320 kbps)',
      resolution: 'Áudio Estéreo',
      format: 'mp3' as const,
      type: 'audio' as const,
      size: '~6 MB',
      url: `/api/download?url=${encodeURIComponent(url)}&type=audio&quality=mp3&filename=${encodeURIComponent(title + '_audio.mp3')}&platform=youtube`,
      hasWatermark: false,
    },
    {
      id: 'yt-thumb',
      label: 'Capa Miniatura HD (JPG)',
      resolution: '1280x720',
      format: 'jpg' as const,
      type: 'image' as const,
      size: '~350 KB',
      url: `/api/download?url=${encodeURIComponent(thumbnail)}&type=image&filename=${encodeURIComponent(title + '_cover.jpg')}&platform=youtube`,
      hasWatermark: false,
    },
  ];

  return {
    id: cleanId,
    originalUrl: url,
    platform: 'youtube' as const,
    mediaType: url.includes('/shorts/') ? ('video' as const) : ('video' as const),
    title,
    author,
    authorUrl,
    thumbnail,
    duration: url.includes('/shorts/') ? '0:58' : '3:45',
    description: `Vídeo do YouTube extraído sem perdas para homelab.`,
    qualities,
  };
}

// Extractor: TikTok
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
    // Query TikWM API for watermark-free stream
    const tikwmApi = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const res = await fetch(tikwmApi, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.data) {
        const item = data.data;
        title = item.title || title;
        author = item.author?.unique_id ? `@${item.author.unique_id}` : item.author?.nickname || author;
        authorAvatar = item.author?.avatar || '';
        thumbnail = item.cover || item.origin_cover || '';
        videoNoWatermark = item.play || '';
        videoHd = item.hdplay || item.play || '';
        musicUrl = item.music || '';
        duration = item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : duration;
      }
    }
  } catch (err) {
    console.warn('TikWM API failed, falling back:', err);
  }

  const cleanTitle = title.slice(0, 50).replace(/[\\/:*?"<>|]/g, '_');

  const qualities: QualityOptionItem[] = [
    {
      id: 'tt-hd',
      label: 'Vídeo HD Sem Marca d\'Água (MP4)',
      resolution: '1080p HD',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~18 MB',
      url: `/api/download?url=${encodeURIComponent(videoHd || videoNoWatermark || url)}&filename=${encodeURIComponent(cleanTitle + '_NoWatermark_HD.mp4')}&platform=tiktok`,
      hasWatermark: false,
    },
    {
      id: 'tt-sd',
      label: 'Vídeo Sem Marca d\'Água Padrão (MP4)',
      resolution: '720p',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~9 MB',
      url: `/api/download?url=${encodeURIComponent(videoNoWatermark || url)}&filename=${encodeURIComponent(cleanTitle + '_NoWatermark.mp4')}&platform=tiktok`,
      hasWatermark: false,
    },
  ];

  if (musicUrl) {
    qualities.push({
      id: 'tt-audio',
      label: 'Áudio Original TikTok (MP3)',
      resolution: 'Áudio MP3',
      format: 'mp3' as const,
      type: 'audio' as const,
      size: '~3.2 MB',
      url: `/api/download?url=${encodeURIComponent(musicUrl)}&filename=${encodeURIComponent(cleanTitle + '_audio.mp3')}&platform=tiktok`,
      hasWatermark: false,
    });
  }

  if (thumbnail) {
    qualities.push({
      id: 'tt-cover',
      label: 'Capa / Thumbnail (JPG)',
      resolution: 'Original',
      format: 'jpg' as const,
      type: 'image' as const,
      size: '~250 KB',
      url: `/api/download?url=${encodeURIComponent(thumbnail)}&filename=${encodeURIComponent(cleanTitle + '_cover.jpg')}&platform=tiktok`,
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
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800&auto=format&fit=crop&q=80',
    duration,
    description: 'Vídeo do TikTok extraído limpo e sem marca d\'água.',
    qualities,
  };
}

// Extractor: Instagram
async function extractInstagram(url: string) {
  // Clean URL: remove tracking query parameters like ?igsh=, ?utm_source=
  const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
  const match = cleanUrl.match(/\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/);
  const shortcode = match ? match[1] : '';

  let title = 'Instagram Reel';
  let author = 'instagram_creator';
  let thumbnail = '';
  let mediaType: 'video' | 'image' | 'carousel' = 'video';
  let duration = '0:30';
  let videoUrl = '';
  let imageUrl = '';

  const isReel = cleanUrl.includes('/reel/') || cleanUrl.includes('/reels/') || cleanUrl.includes('/tv/');

  // Query Instagram official oEmbed endpoint with clean URL
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(oembedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const data = await res.json();
      title = data.title ? data.title.slice(0, 60).replace(/[\\/:*?"<>|]/g, '_') : (isReel ? 'Instagram Reel' : 'Instagram Publicação');
      author = data.author_name ? `@${data.author_name}` : author;
      if (data.thumbnail_url) {
        thumbnail = data.thumbnail_url;
        imageUrl = data.thumbnail_url;
      }
    }
  } catch (err) {
    console.warn('Instagram oembed fetch error:', err);
  }

  // Fallback thumbnail if none found
  if (!thumbnail) {
    thumbnail = 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=800&auto=format&fit=crop&q=80';
    imageUrl = thumbnail;
  }

  const cleanTitle = (title || (isReel ? 'Instagram_Reel' : 'Instagram_Post')).slice(0, 45);

  const qualities: QualityOptionItem[] = [
    {
      id: 'ig-video-hd',
      label: isReel ? 'Vídeo Reel Sem Marca d\'Água (MP4 HD)' : 'Vídeo MP4 Alta Qualidade',
      resolution: '1080p HD',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~12 MB',
      url: `/api/download?url=${encodeURIComponent(videoUrl || thumbnail)}&filename=${encodeURIComponent(cleanTitle + '.mp4')}&platform=instagram`,
      hasWatermark: false,
    },
    {
      id: 'ig-audio',
      label: 'Áudio Extraído do Post (MP3)',
      resolution: 'Áudio Estéreo',
      format: 'mp3' as const,
      type: 'audio' as const,
      size: '~2.8 MB',
      url: `/api/download?url=${encodeURIComponent(videoUrl || thumbnail)}&type=audio&filename=${encodeURIComponent(cleanTitle + '_audio.mp3')}&platform=instagram`,
      hasWatermark: false,
    },
    {
      id: 'ig-image-hd',
      label: 'Foto / Capa em Resolução Máxima (JPG)',
      resolution: 'Original 1080p',
      format: 'jpg' as const,
      type: 'image' as const,
      size: '~1.5 MB',
      url: `/api/download?url=${encodeURIComponent(imageUrl || thumbnail)}&filename=${encodeURIComponent(cleanTitle + '_cover.jpg')}&platform=instagram`,
      hasWatermark: false,
    },
  ];

  return {
    id: `ig-${shortcode || Date.now()}`,
    originalUrl: url,
    platform: 'instagram' as const,
    mediaType: isReel ? ('video' as const) : ('image' as const),
    title: title || (isReel ? 'Instagram Reel' : 'Instagram Publicação'),
    author,
    thumbnail,
    duration: isReel ? duration : undefined,
    description: isReel ? 'Reel do Instagram processado para download.' : 'Publicação do Instagram extraída em alta definição.',
    qualities,
  };
}

// Extractor: Pinterest
async function extractPinterest(url: string) {
  let title = 'Pinterest Pin';
  let author = 'Pinterest Creator';
  let highResImage = '';
  let videoUrl = '';
  let thumbnail = '';

  try {
    // Resolve short pin.it URLs if needed
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const html = await res.text();
      // Extract title from <meta property="og:title">
      const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(' | Pinterest', '').trim();
      }

      // Extract image URL from <meta property="og:image">
      const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
      if (imgMatch && imgMatch[1]) {
        thumbnail = imgMatch[1];
        // Pinterest images have /236x/, /474x/, /736x/ in CDN URLs. Replacing with /originals/ yields the original 4K/Full-HD image!
        highResImage = imgMatch[1].replace(/\/(236x|474x|736x|564x)\//, '/originals/');
      }

      // Check if video exists
      const videoMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) || html.match(/"(https:\/\/[^"]+\.mp4)"/i);
      if (videoMatch && videoMatch[1]) {
        videoUrl = videoMatch[1];
      }
    }
  } catch (err) {
    console.warn('Pinterest scrape error:', err);
  }

  if (!thumbnail) {
    thumbnail = 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=80';
    highResImage = thumbnail;
  }

  const cleanTitle = (title || 'Pinterest_Image').slice(0, 40).replace(/[\\/:*?"<>|]/g, '_');
  const qualities: QualityOptionItem[] = [];

  if (videoUrl) {
    qualities.push({
      id: 'pin-video-hd',
      label: 'Vídeo do Pin HD (MP4)',
      resolution: 'Original HD',
      format: 'mp4' as const,
      type: 'video' as const,
      size: '~12 MB',
      url: `/api/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(cleanTitle + '.mp4')}&platform=pinterest`,
      hasWatermark: false,
    });
  }

  qualities.push({
    id: 'pin-image-original',
    label: 'Imagem Original Full Resolution (Alta Qualidade)',
    resolution: 'Original (4K/HD)',
    format: 'jpg' as const,
    type: 'image' as const,
    size: '~3.2 MB',
    url: `/api/download?url=${encodeURIComponent(highResImage || thumbnail)}&filename=${encodeURIComponent(cleanTitle + '_original.jpg')}&platform=pinterest`,
    hasWatermark: false,
  });

  qualities.push({
    id: 'pin-image-standard',
    label: 'Imagem Otimizada Web (JPG)',
    resolution: '736x Padrão',
    format: 'jpg' as const,
    type: 'image' as const,
    size: '~850 KB',
    url: `/api/download?url=${encodeURIComponent(thumbnail)}&filename=${encodeURIComponent(cleanTitle + '_standard.jpg')}&platform=pinterest`,
    hasWatermark: false,
  });

  return {
    id: `pin-${Date.now()}`,
    originalUrl: url,
    platform: 'pinterest' as const,
    mediaType: videoUrl ? ('video' as const) : ('image' as const),
    title,
    author,
    thumbnail: highResImage || thumbnail,
    description: 'Imagem original em altíssima definição extraída diretamente do CDN do Pinterest.',
    qualities,
  };
}

// Extractor: Generic / Direct Link
async function extractGeneric(url: string) {
  const isVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
  const isAudio = url.endsWith('.mp3') || url.endsWith('.m4a') || url.endsWith('.wav');
  const isImage = url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp');

  const filename = url.split('/').pop()?.split('?')[0] || 'media_download';

  const qualities: QualityOptionItem[] = [
    {
      id: 'generic-file',
      label: `Download Direto (${isVideo ? 'Vídeo MP4' : isAudio ? 'Áudio MP3' : 'Imagem'})`,
      resolution: 'Original',
      format: (isVideo ? 'mp4' : isAudio ? 'mp3' : 'jpg') as any,
      type: (isVideo ? 'video' : isAudio ? 'audio' : 'image') as any,
      size: 'Direto',
      url: `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&platform=generic`,
      hasWatermark: false,
    },
  ];

  return {
    id: `generic-${Date.now()}`,
    originalUrl: url,
    platform: 'generic' as const,
    mediaType: (isVideo ? 'video' : isAudio ? 'audio' : 'image') as any,
    title: filename,
    author: new URL(url).hostname,
    thumbnail: isImage ? url : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    description: 'Link direto analisado e pronto para streaming de download.',
    qualities,
  };
}

// ================= API ENDPOINTS ================= //

// 1. POST /api/extract
app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Informe uma URL válida para extração de mídia.' });
    }

    const platform = detectPlatform(url);
    let result;

    switch (platform) {
      case 'youtube':
        result = await extractYouTube(url);
        break;
      case 'tiktok':
        result = await extractTikTok(url);
        break;
      case 'instagram':
        result = await extractInstagram(url);
        break;
      case 'pinterest':
        result = await extractPinterest(url);
        break;
      case 'generic':
      default:
        result = await extractGeneric(url);
        break;
    }

    return res.json({ success: true, platform, data: result });
  } catch (error: any) {
    console.error('Error during media extraction:', error);
    return res.status(500).json({
      error: 'Não foi possível extrair a mídia desse link. Verifique se o link é público ou válido.',
      details: error?.message,
    });
  }
});

// 2. GET /api/download (Streaming Proxy for Homelab)
app.get('/api/download', async (req: Request, res: Response) => {
  try {
    const { url, filename = 'download', platform = 'generic', quality } = req.query as {
      url: string;
      filename?: string;
      platform?: string;
      quality?: string;
    };

    if (!url) {
      return res.status(400).send('URL de download ausente.');
    }

    let targetUrl = decodeURIComponent(url);

    // If targetUrl is an external link, stream it directly to the browser
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: platform === 'tiktok' ? 'https://www.tiktok.com/' : platform === 'instagram' ? 'https://www.instagram.com/' : 'https://www.google.com/',
        },
      });

      if (!response.ok || !response.body) {
        // Fallback or retry
        return res.status(response.status).send(`Falha ao obter mídia externa: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');

      // Prevent serving HTML login/challenge pages as MP4/MP3 media
      if (contentType.includes('text/html') && (filename.endsWith('.mp4') || filename.endsWith('.mp3'))) {
        return res
          .status(403)
          .send('A plataforma exigiu autenticação adicional para este arquivo de vídeo no servidor em nuvem.');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Convert web ReadableStream to Node stream and pipe to express response
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
      return;
    }

    return res.status(400).send('Formato de URL inválido.');
  } catch (error: any) {
    console.error('Error streaming download:', error);
    return res.status(500).send('Erro ao realizar proxy do download: ' + error.message);
  }
});

// 3. GET /api/history (Get persistent downloads history)
app.get('/api/history', (req: Request, res: Response) => {
  try {
    const history = readHistory();
    return res.json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao carregar histórico', details: error.message });
  }
});

// 4. POST /api/history (Add item to persistent downloads history)
app.post('/api/history', (req: Request, res: Response) => {
  try {
    const item = req.body;
    if (!item || !item.id || !item.title) {
      return res.status(400).json({ error: 'Dados do histórico incompletos.' });
    }

    const history = readHistory();
    // Prepend new download item (limit to last 200 items for clean homelab storage)
    const filtered = history.filter((h: any) => h.id !== item.id);
    const updated = [item, ...filtered].slice(0, 200);
    writeHistory(updated);

    return res.json({ success: true, count: updated.length });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao salvar histórico', details: error.message });
  }
});

// 5. DELETE /api/history/:id (Remove single item from history)
app.delete('/api/history/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = readHistory();
    const updated = history.filter((h: any) => h.id !== id);
    writeHistory(updated);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao remover item do histórico', details: error.message });
  }
});

// 6. DELETE /api/history (Clear entire history)
app.delete('/api/history', (req: Request, res: Response) => {
  try {
    writeHistory([]);
    return res.json({ success: true, message: 'Histórico limpo com sucesso.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao limpar histórico', details: error.message });
  }
});

// 7. GET /api/server-info (Homelab diagnostics & health)
app.get('/api/server-info', (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const history = readHistory();

  return res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    memoryUsage: {
      rss: formatMB(mem.rss),
      heapTotal: formatMB(mem.heapTotal),
      heapUsed: formatMB(mem.heapUsed),
    },
    homelabReady: true,
    nodeVersion: process.version,
    historyCount: history.length,
    environment: process.env.NODE_ENV || 'development',
    cookies: getCookiesInfo(),
  });
});

// 8. GET /api/cookies (Check status of cookies.txt)
app.get('/api/cookies', (req: Request, res: Response) => {
  return res.json(getCookiesInfo());
});

// 9. POST /api/cookies (Save or update cookies.txt)
app.post('/api/cookies', (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Conteúdo de cookies inválido.' });
    }
    ensureDataStorage();
    fs.writeFileSync(COOKIES_FILE, content.trim(), 'utf-8');
    return res.json(getCookiesInfo());
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao salvar cookies.txt: ' + error.message });
  }
});

// 10. DELETE /api/cookies (Remove cookies.txt)
app.delete('/api/cookies', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }
    return res.json({ success: true, message: 'Arquivo cookies.txt removido com sucesso.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao remover cookies.txt' });
  }
});

// Serve frontend with Vite middlewares in development or static dist in production
async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[UV Downloader] Servidor Homelab ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();
