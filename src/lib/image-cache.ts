// Server-side image cache to avoid embedding huge base64 data in prompts
// Images are stored server-side and referenced by ID in API requests

interface CachedImage {
  data: string; // base64 data URL
  timestamp: number;
  name: string;
}

// Simple in-memory cache (cleared on server restart)
// For production, use Redis or a persistent store
const imageCache = new Map<string, CachedImage>();

// Cleanup old cached images after 1 hour
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export function cacheImage(data: string, name: string): string {
  const id = generateImageId();
  imageCache.set(id, {
    data,
    timestamp: Date.now(),
    name,
  });
  
  // Schedule cleanup
  setTimeout(() => {
    imageCache.delete(id);
  }, CACHE_EXPIRY_MS);
  
  return id;
}

export function getCachedImage(id: string): CachedImage | undefined {
  return imageCache.get(id);
}

export function getAllCachedImages(): Map<string, CachedImage> {
  return new Map(imageCache);
}

export function clearImageCache(): void {
  imageCache.clear();
}

// Cleanup periodic old entries
setInterval(() => {
  const now = Date.now();
  const idsToDelete: string[] = [];
  imageCache.forEach((image, id) => {
    if (now - image.timestamp > CACHE_EXPIRY_MS) {
      idsToDelete.push(id);
    }
  });
  idsToDelete.forEach(id => imageCache.delete(id));
}, 5 * 60 * 1000); // Every 5 minutes
