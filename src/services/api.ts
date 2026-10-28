import { HistoryRecord, MediaResult, ServerInfo } from '../types';

const LOCAL_STORAGE_HISTORY_KEY = 'uv_downloader_history_backup';

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
      // Sync to localStorage
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(serverHistory));
      } catch (e) {
        // ignore quota errors
      }
      return serverHistory;
    }
  } catch (err) {
    console.warn('Servidor inacessível, recuperando histórico do cache local:', err);
  }

  // Fallback to local storage
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    return local ? JSON.parse(local) : [];
  } catch (e) {
    return [];
  }
}

export async function saveHistoryItem(item: HistoryRecord): Promise<void> {
  // Save to local storage first
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    const existing: HistoryRecord[] = local ? JSON.parse(local) : [];
    const updated = [item, ...existing.filter((h) => h.id !== item.id)].slice(0, 200);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }

  // Push to server
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch (err) {
    console.warn('Falha ao salvar no servidor homelab:', err);
  }
}

export async function removeHistoryItem(id: string): Promise<HistoryRecord[]> {
  // Update local storage
  let updated: HistoryRecord[] = [];
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    const existing: HistoryRecord[] = local ? JSON.parse(local) : [];
    updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }

  try {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.warn('Erro ao deletar no servidor:', err);
  }

  return updated;
}

export async function clearAllHistory(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    await fetch('/api/history', { method: 'DELETE' });
  } catch (err) {
    console.warn('Erro ao limpar histórico no servidor:', err);
  }
}

export async function fetchServerInfo(): Promise<ServerInfo | null> {
  try {
    const res = await fetch('/api/server-info');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // homelab offline or booting
  }
  return null;
}

export async function fetchCookiesInfo(): Promise<import('../types').CookiesInfo> {
  try {
    const res = await fetch('/api/cookies');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // homelab offline
  }
  return { exists: false, domains: [] };
}

export async function saveCookiesContent(content: string): Promise<import('../types').CookiesInfo> {
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
