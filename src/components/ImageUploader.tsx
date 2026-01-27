"use client";

import { useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  type: "reference" | "asset";
  name: string;
  description?: string;
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
      }));

      onImagesChange([...images, ...newImages]);
    },
    [images, onImagesChange]
  );

  const handleUrlAdd = useCallback(() => {
    const url = prompt("Enter image URL:");
    if (!url) return;

    const newImage: UploadedImage = {
      id: Math.random().toString(36).substring(7),
      url,
      type: "asset",
      name: url.split("/").pop() || "Image",
    };

    onImagesChange([...images, newImage]);
  }, [images, onImagesChange]);

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
            onClick={handleUrlAdd}
          >
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
                <div className="p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={image.type === "reference" ? "default" : "outline"}
                      onClick={() => toggleType(image.id)}
                      className="flex-1 text-xs"
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
                  <p className="text-xs text-muted-foreground truncate">
                    {image.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
