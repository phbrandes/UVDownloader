import { CookiesInfo, HistoryRecord, MediaResult, ServerInfo, TunnelInfo } from '../types';

const LOCAL_STORAGE_HISTORY_KEY = 'uv_downloader_history_backup';

/**
 * Dispara o download do arquivo usando o gerenciador nativo do navegador no Homelab/Cloudflare
 * (sem acumular o vídeo na memória RAM), ou via Blob dentro do iframe de preview.
 */
export async function triggerBrowserDownload(url: string, rawFilename: string): Promise<void> {
  const filename = rawFilename.replace(/[\\/:*?"<>|]/g, '_');
  const isAiStudioPreview = window.location.hostname.endsWith('.run.app');

  if (!isAiStudioPreview) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 5000);
    return;
  }

  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Erro no servidor (${response.status}).`);
  }
  const blobUrl = window.URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }, 10000);
}

export async function extractMedia(url: string): Promise<MediaResult> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao processar mídia (${res.status})`);
  }

  const json = await res.json();
  return json.data;
}

export async function fetchHistory(): Promise<HistoryRecord[]> {
  try {
    const res = await fetch('/api/history');
    if (res.ok) {
      const json = await res.json();
      const serverHistory = json.data || [];
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(serverHistory));
      } catch {}
      return serverHistory;
    }
  } catch {}

  try {
    const local = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}

export async function saveHistoryItem(item: HistoryRecord): Promise<void> {
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    const existing: HistoryRecord[] = local ? JSON.parse(local) : [];
    const updated = [item, ...existing.filter((h) => h.id !== item.id)].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
  } catch {}

  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch {}
}

export async function removeHistoryItem(id: string): Promise<HistoryRecord[]> {
  let updated: HistoryRecord[] = [];
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    const existing: HistoryRecord[] = local ? JSON.parse(local) : [];
    updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
  } catch {}

  try {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch {}

  return updated;
}

export async function clearAllHistory(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    await fetch('/api/history', { method: 'DELETE' });
  } catch {}
}

export async function fetchServerInfo(): Promise<ServerInfo | null> {
  try {
    const res = await fetch('/api/server-info');
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function fetchCookiesInfo(): Promise<CookiesInfo> {
  try {
    const res = await fetch('/api/cookies');
    if (res.ok) return await res.json();
  } catch {}
  return { exists: false, domains: [] };
}

export async function saveCookiesContent(content: string): Promise<CookiesInfo> {
  const res = await fetch('/api/cookies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar arquivo de cookies');
  }
  return await res.json();
}

export async function deleteCookiesFile(): Promise<void> {
  await fetch('/api/cookies', { method: 'DELETE' });
}

export async function fetchTunnelInfo(): Promise<TunnelInfo> {
  try {
    const res = await fetch('/api/tunnel');
    if (res.ok) return await res.json();
  } catch {}
  return {
    mode: 'off',
    status: 'disconnected',
    publicDomain: '',
    hasToken: false,
  };
}

export async function saveTunnelConfig(payload: {
  mode: 'custom' | 'quick' | 'off';
  publicDomain?: string;
  tunnelToken?: string;
}): Promise<TunnelInfo> {
  const res = await fetch('/api/tunnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar configuração do túnel Cloudflare');
  }
  return await res.json();
}

export async function stopCloudflareTunnel(): Promise<TunnelInfo> {
  const res = await fetch('/api/tunnel', { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Falha ao desligar túnel Cloudflare');
  }
  return await res.json();
}
