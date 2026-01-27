"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  X,
  Image as ImageIcon,
  Eye,
  Link2,
  AlertCircle,
  Camera,
  Check,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";

export interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  type: "reference" | "asset";
  name: string;
  description?: string;
  uploadStatus?: "idle" | "uploading" | "success" | "error";
  uploadError?: string;
  publicUrl?: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onImagesChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Use ref to track current images for async operations
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Upload file to server (Supabase)
  const uploadFileToServer = async (image: UploadedImage) => {
    if (!image.file) return;

    console.log(`🚀 Starting upload for: ${image.name}`);

    try {
      const formData = new FormData();
      formData.append("file", image.file, image.name);

      const response = await fetch("/api/upload-asset", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Upload complete for ${image.name}:`, data.url);

      // Update image with success status
      onImagesChange(
        imagesRef.current.map((img) =>
          img.id === image.id
            ? { ...img, uploadStatus: "success" as const, publicUrl: data.url }
            : img,
        ),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      console.error(`❌ Upload failed for ${image.name}:`, errorMessage);

      onImagesChange(
        imagesRef.current.map((img) =>
          img.id === image.id
            ? {
                ...img,
                uploadStatus: "error" as const,
                uploadError: errorMessage,
              }
            : img,
        ),
      );
    }
  };

  // Process and upload files
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Compress files - optimized for mobile
    const compressedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          console.log(
            `📦 Compressing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
          );
          const compressed = await imageCompression(file, {
            maxSizeMB: 0.8, // Smaller for mobile
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.8,
          });
          console.log(
            `✓ Compressed to ${(compressed.size / 1024 / 1024).toFixed(2)}MB`,
          );
          return compressed;
        } catch (error) {
          console.error(`Failed to compress ${file.name}:`, error);
          return file;
        }
      }),
    );

    // Create image objects
    const newImages: UploadedImage[] = compressedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      url: URL.createObjectURL(file),
      file,
      type: "asset" as const,
      name: file.name,
      uploadStatus: "uploading" as const,
    }));

    // Add to state
    const allImages = [...images, ...newImages];
    onImagesChange(allImages);

    // Upload each file
    for (const image of newImages) {
      await uploadFileToServer(image);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );

      await processFiles(files);
    },
    [images, onImagesChange],
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) =>
        file.type.startsWith("image/"),
      );

      await processFiles(files);

      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [images, onImagesChange],
  );

  const handleUrlSubmit = useCallback(() => {
    setUrlError("");
    const raw = urlValue.trim();
    if (!raw) {
      setUrlError("Please enter an image URL.");
      return;
    }
    try {
      const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      const href = parsed.toString();
      const looksLikeImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(
        parsed.pathname,
      );
      if (!looksLikeImage) {
        setUrlError(
          "Use a direct image link ending in .png, .jpg, .gif, .webp, or .svg.",
        );
        return;
      }

      const newImage: UploadedImage = {
        id: Math.random().toString(36).substring(7),
        url: href,
        publicUrl: href, // External URLs are already public
        type: "asset",
        name: parsed.pathname.split("/").pop() || "Image",
        uploadStatus: "success",
      };

      onImagesChange([...images, newImage]);
      setIsUrlModalOpen(false);
      setUrlValue("");
    } catch {
      setUrlError("That URL is not valid.");
    }
  }, [images, onImagesChange, urlValue]);

  const toggleType = useCallback(
    (id: string) => {
      onImagesChange(
        images.map((img) =>
          img.id === id
            ? { ...img, type: img.type === "asset" ? "reference" : "asset" }
            : img,
        ),
      );
    },
    [images, onImagesChange],
  );

  const removeImage = useCallback(
    (id: string) => {
      const image = images.find((img) => img.id === id);
      if (image?.url.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
      onImagesChange(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange],
  );

  const updateDescription = useCallback(
    (id: string, description: string) => {
      onImagesChange(
        images.map((img) => (img.id === id ? { ...img, description } : img)),
      );
    },
    [images, onImagesChange],
  );

  // Check if device has camera (mobile)
  const isMobile =
    typeof window !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="space-y-3">
      {/* Upload Area - Mobile Optimized */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-3 sm:p-4 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-background-elevated"
        }`}
      >
        <Upload className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground mb-3">
          {isMobile
            ? "Tap to upload or take a photo"
            : "Drag & drop images or click to upload"}
        </p>

        {/* Mobile-friendly button grid */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 justify-center">
          {/* Camera button - prominent on mobile */}
          {isMobile && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <Camera className="w-4 h-4 mr-2" />
              Camera
            </Button>
          )}

          <Button
            type="button"
            variant={isMobile ? "outline" : "outline"}
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {isMobile ? "Gallery" : "Choose Files"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setUrlValue("");
              setUrlError("");
              setIsUrlModalOpen(true);
            }}
            className={isMobile ? "col-span-2" : ""}
          >
            <Link2 className="w-4 h-4 mr-2" />
            Add URL
          </Button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        {/* Camera input for mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Images Grid - Mobile Optimized */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Tap to toggle: Reference (style) or Asset (use in video)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group border border-border rounded-lg overflow-hidden bg-background-elevated"
              >
                {/* Image Preview */}
                <div className="relative aspect-square">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Upload Status Overlay */}
                  {image.uploadStatus &&
                    image.uploadStatus !== "idle" &&
                    image.uploadStatus !== "success" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        {image.uploadStatus === "uploading" && (
                          <div className="text-center">
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-1" />
                            <p className="text-xs text-white font-medium">
                              Uploading...
                            </p>
                          </div>
                        )}
                        {image.uploadStatus === "error" && (
                          <div className="text-center px-2">
                            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                            <p className="text-xs text-white font-medium line-clamp-2">
                              {image.uploadError || "Error"}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Success indicator */}
                  {image.uploadStatus === "success" && (
                    <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    disabled={image.uploadStatus === "uploading"}
                    className="absolute top-1 left-1 bg-black/60 hover:bg-black/80 rounded-full p-1 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>

                {/* Controls */}
                <div className="p-2 space-y-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={image.type === "reference" ? "default" : "outline"}
                    onClick={() => toggleType(image.id)}
                    className="w-full text-xs h-7"
                    disabled={image.uploadStatus === "uploading"}
                  >
                    {image.type === "reference" ? (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        Reference
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Asset
                      </>
                    )}
                  </Button>

                  {image.type === "reference" && (
                    <input
                      type="text"
                      placeholder="What to notice?"
                      value={image.description || ""}
                      onChange={(e) =>
                        updateDescription(image.id, e.target.value)
                      }
                      className="w-full px-2 py-1 text-xs rounded border border-border bg-input text-foreground focus:outline-none focus:border-primary"
                    />
                  )}

                  <p className="text-xs text-muted-foreground truncate">
                    {image.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URL Modal - Mobile Optimized */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:px-4">
          <div className="bg-background-elevated border-t sm:border border-border rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md p-4 sm:p-5 space-y-4 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Add image by URL
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Paste a direct image link
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <input
                autoFocus
                type="url"
                inputMode="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUrlSubmit();
                  }
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-3 rounded-lg border border-border bg-input text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {urlError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1.5">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setIsUrlModalOpen(false);
                  setUrlValue("");
                  setUrlError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleUrlSubmit}
              >
                Add Image
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
