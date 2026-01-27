"use client";

import { useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Eye, Link2, AlertCircle } from "lucide-react";
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
  publicUrl?: string; // The URL returned from the server
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );

      const newImages: UploadedImage[] = files.map((file) => ({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file),
        file,
        type: "asset", // Default to asset
        name: file.name,
      }));

      onImagesChange([...images, ...newImages]);
    },
    [images, onImagesChange]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) =>
        file.type.startsWith("image/")
      );

      const newImages: UploadedImage[] = files.map((file) => ({
        id: Math.random().toString(36).substring(7),
        url: URL.createObjectURL(file),
        file,
        type: "asset",
        name: file.name,
        uploadStatus: "idle",
      }));

      const allImages = [...images, ...newImages];
      onImagesChange(allImages);

      // Auto-upload each file to the server
      newImages.forEach((image) => {
        uploadFileToServer(image, allImages);
      });
    },
    [images, onImagesChange]
  );

  const uploadFileToServer = useCallback(
    async (image: UploadedImage, allImages: UploadedImage[]) => {
      if (!image.file) return;

      // Update status to uploading
      const updatedImages = allImages.map((img) =>
        img.id === image.id ? { ...img, uploadStatus: "uploading" as const } : img
      );
      onImagesChange(updatedImages);

      try {
        // Compress the image before uploading
        console.log(`📦 Compressing image: ${image.name} (original: ${(image.file.size / 1024 / 1024).toFixed(2)}MB)`);
        const compressedFile = await imageCompression(image.file, {
          maxSizeMB: 1, // Max 1MB
          maxWidthOrHeight: 1920, // Max 1920px on longest side
          useWebWorker: true,
        });
        
        const originalSize = (image.file.size / 1024 / 1024).toFixed(2);
        const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
        console.log(`✓ Compressed: ${originalSize}MB → ${compressedSize}MB`);

        const formData = new FormData();
        formData.append("file", compressedFile, image.name);
        const response = await fetch("/api/upload-asset", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        const publicUrl = data.url || data.dataUrl;

        // Update with success status and public URL
        const successImages = updatedImages.map((img) =>
          img.id === image.id
            ? { ...img, uploadStatus: "success" as const, publicUrl }
            : img
        );
        onImagesChange(successImages);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Upload failed";
        const errorImages = updatedImages.map((img) =>
          img.id === image.id
            ? { ...img, uploadStatus: "error" as const, uploadError: errorMessage }
            : img
        );
        onImagesChange(errorImages);
      }
    },
    [onImagesChange]
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
      const looksLikeImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(parsed.pathname);
      if (!looksLikeImage) {
        setUrlError("Use a direct image link ending in .png, .jpg, .gif, .webp, or .svg.");
        return;
      }

      const newImage: UploadedImage = {
        id: Math.random().toString(36).substring(7),
        url: href,
        type: "asset",
        name: parsed.pathname.split("/").pop() || "Image",
      };

      onImagesChange([...images, newImage]);
      setIsUrlModalOpen(false);
      setUrlValue("");
    } catch (err) {
      setUrlError("That URL is not valid.");
    }
  }, [images, onImagesChange, urlValue]);

  const toggleType = useCallback(
    (id: string) => {
      onImagesChange(
        images.map((img) =>
          img.id === id
            ? { ...img, type: img.type === "asset" ? "reference" : "asset" }
            : img
        )
      );
    },
    [images, onImagesChange]
  );

  const removeImage = useCallback(
    (id: string) => {
      const image = images.find((img) => img.id === id);
      if (image?.url.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
      onImagesChange(images.filter((img) => img.id !== id));
    },
    [images, onImagesChange]
  );

  const updateDescription = useCallback(
    (id: string, description: string) => {
      onImagesChange(
        images.map((img) => (img.id === id ? { ...img, description } : img))
      );
    },
    [images, onImagesChange]
  );

  return (
    <div className="space-y-3">
      {/* Upload Area - Compact */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-background-elevated"
        }`}
      >
        <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground mb-2">
          Drag & drop images or click to upload
        </p>
        <div className="flex gap-2 justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Choose Files
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
          >
            <Link2 className="w-4 h-4 mr-2" />
            Add URL
          </Button>
        </div>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Uploaded Images */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Click image type to toggle between Reference (inspiration) and Asset
            (use in video)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group border border-border rounded-lg overflow-hidden bg-background-elevated"
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-24 object-cover"
                />
                
                {/* Upload Status Overlay */}
                {image.uploadStatus && image.uploadStatus !== "idle" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    {image.uploadStatus === "uploading" && (
                      <div className="text-center">
                        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-white font-medium">Uploading...</p>
                      </div>
                    )}
                    {image.uploadStatus === "success" && (
                      <div className="text-center">
                        <div className="text-2xl text-green-500 mb-1">✓</div>
                        <p className="text-xs text-white font-medium">Ready</p>
                      </div>
                    )}
                    {image.uploadStatus === "error" && (
                      <div className="text-center px-2">
                        <div className="text-2xl text-red-500 mb-1">⚠</div>
                        <p className="text-xs text-white font-medium">{image.uploadError || "Error"}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={image.type === "reference" ? "default" : "outline"}
                      onClick={() => toggleType(image.id)}
                      className="flex-1 text-xs"
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
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeImage(image.id)}
                      className="text-destructive"
                      disabled={image.uploadStatus === "uploading"}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {image.type === "reference" && (
                    <input
                      type="text"
                      placeholder="What should I notice? (optional)"
                      value={image.description || ""}
                      onChange={(e) =>
                        updateDescription(image.id, e.target.value)
                      }
                      className="w-full px-2 py-1 text-xs rounded border border-border bg-input text-foreground focus:outline-none focus:border-primary"
                    />
                  )}
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs text-muted-foreground truncate flex-1">
                      {image.name}
                    </p>
                    {image.uploadStatus === "success" && image.publicUrl && (
                      <span className="text-xs text-green-600 bg-green-50 dark:bg-green-950 px-2 py-1 rounded whitespace-nowrap">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isUrlModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-background-elevated border border-border rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Add image by URL</h3>
                <p className="text-xs text-muted-foreground mt-1">Paste a direct image link (must end with .png, .jpg, .gif, .webp, or .svg).</p>
              </div>
            </div>

            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUrlSubmit();
                  }
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {urlError && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{urlError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsUrlModalOpen(false);
                  setUrlValue("");
                  setUrlError("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleUrlSubmit}>
                Add Image
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
