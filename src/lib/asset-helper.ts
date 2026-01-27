/**
 * Helper utilities for working with asset data URLs in Remotion animations
 * These are injected into the compiler context so generated code can use them
 */

export const AssetHelper = {
  /**
   * Validate if a string is a valid data URL
   */
  isDataUrl: (src: string): boolean => {
    return typeof src === "string" && src.startsWith("data:");
  },

  /**
   * Get MIME type from data URL
   */
  getMimeType: (src: string): string | null => {
    if (!src.startsWith("data:")) return null;
    const match = src.match(/^data:([^;]+)/);
    return match ? match[1] : null;
  },

  /**
   * Check if asset is an image
   */
  isImage: (src: string): boolean => {
    const mime = AssetHelper.getMimeType(src);
    return mime ? mime.startsWith("image/") : false;
  },

  /**
   * Default style for asset images
   */
  defaultImageStyle: {
    width: "100%" as const,
    height: "100%" as const,
    objectFit: "contain" as const,
  },

  /**
   * Get cover style for asset images (fills container, may crop)
   */
  coverImageStyle: {
    width: "100%" as const,
    height: "100%" as const,
    objectFit: "cover" as const,
  },

  /**
   * Get contain style for asset images (fully visible)
   */
  containImageStyle: {
    width: "100%" as const,
    height: "100%" as const,
    objectFit: "contain" as const,
  },
};

export type AssetStyle = "contain" | "cover" | "fill";

export const getAssetStyle = (type: AssetStyle = "contain") => {
  switch (type) {
    case "cover":
      return AssetHelper.coverImageStyle;
    case "fill":
      return { width: "100%", height: "100%" };
    case "contain":
    default:
      return AssetHelper.containImageStyle;
  }
};

export default AssetHelper;
