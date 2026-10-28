export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'pinterest' | 'generic';

export type MediaType = 'video' | 'image' | 'carousel' | 'audio';

export interface QualityOption {
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

export interface CarouselItem {
  id: string;
  type: 'image' | 'video';
  thumbnail: string;
  downloadUrl: string;
  filename: string;
  resolution?: string;
}

export interface MediaResult {
  id: string;
  originalUrl: string;
  platform: Platform;
  mediaType: MediaType;
  title: string;
  author: string;
  authorAvatar?: string;
  authorUrl?: string;
  thumbnail: string;
  duration?: string;
  description?: string;
  views?: string;
  likes?: string;
  qualities: QualityOption[];
  carouselItems?: CarouselItem[];
}

export interface HistoryRecord {
  id: string;
  originalUrl: string;
  title: string;
  author: string;
  thumbnail: string;
  platform: Platform;
  mediaType: MediaType;
  qualityLabel: string;
  format: string;
  downloadUrl: string;
  fileSize?: string;
  timestamp: number;
}

export interface ServerInfo {
  status: string;
  uptime: number;
  memoryUsage: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
  homelabReady: boolean;
  nodeVersion: string;
  historyCount: number;
  environment: string;
}

export interface CookiesInfo {
  exists: boolean;
  size?: string;
  domains: string[];
  lastModified?: string;
}
