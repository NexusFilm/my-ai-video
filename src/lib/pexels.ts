/**
 * Pexels API integration for fetching stock videos and images
 * Used for Vox-style animations that need B-roll footage
 */

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

export interface PexelsVideo {
  id: number;
  url: string;
  image: string; // Preview image
  duration: number;
  width: number;
  height: number;
  video_files: {
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }[];
}

export interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
  };
  alt: string;
}

export interface PexelsSearchResult {
  videos?: PexelsVideo[];
  photos?: PexelsPhoto[];
  total_results: number;
}

/**
 * Search for videos on Pexels
 */
export async function searchPexelsVideos(
  query: string,
  options: {
    perPage?: number;
    orientation?: "landscape" | "portrait" | "square";
  } = {},
): Promise<PexelsVideo[]> {
  if (!PEXELS_API_KEY) {
    console.warn("Pexels API key not configured");
    return [];
  }

  const { perPage = 5, orientation = "landscape" } = options;

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
    });

    const response = await fetch(
      `https://api.pexels.com/videos/search?${params}`,
      {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    return data.videos || [];
  } catch (error) {
    console.error("Failed to search Pexels videos:", error);
    return [];
  }
}

/**
 * Search for photos on Pexels
 */
export async function searchPexelsPhotos(
  query: string,
  options: {
    perPage?: number;
    orientation?: "landscape" | "portrait" | "square";
  } = {},
): Promise<PexelsPhoto[]> {
  if (!PEXELS_API_KEY) {
    console.warn("Pexels API key not configured");
    return [];
  }

  const { perPage = 5, orientation = "landscape" } = options;

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
    });

    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error("Failed to search Pexels photos:", error);
    return [];
  }
}

/**
 * Get the best quality video file URL for a given aspect ratio
 */
export function getBestVideoUrl(
  video: PexelsVideo,
  preferredQuality: "hd" | "sd" = "hd",
): string | null {
  if (!video.video_files || video.video_files.length === 0) {
    return null;
  }

  // Sort by quality (hd first) and resolution
  const sorted = [...video.video_files].sort((a, b) => {
    const aIsHd = a.quality === "hd" ? 1 : 0;
    const bIsHd = b.quality === "hd" ? 1 : 0;

    if (preferredQuality === "hd") {
      if (aIsHd !== bIsHd) return bIsHd - aIsHd;
    } else {
      if (aIsHd !== bIsHd) return aIsHd - bIsHd;
    }

    // Then by resolution
    return b.width * b.height - a.width * a.height;
  });

  return sorted[0]?.link || null;
}

/**
 * Check if Pexels is configured
 */
export function isPexelsConfigured(): boolean {
  return !!PEXELS_API_KEY;
}
