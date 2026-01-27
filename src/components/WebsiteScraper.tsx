"use client";

import { useState } from "react";
import {
  Globe,
  Loader2,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScrapedContent {
  url: string;
  title: string;
  description: string;
  headings: string[];
  keyPoints: string[];
  images: { src: string; alt: string }[];
  colors: string[];
  brandName?: string;
}

interface WebsiteScraperProps {
  onPromptGenerated: (prompt: string) => void;
  onImagesFound?: (images: { src: string; alt: string }[]) => void;
}

export function WebsiteScraper({
  onPromptGenerated,
  onImagesFound,
}: WebsiteScraperProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<ScrapedContent | null>(null);

  const handleScrape = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setScraped(null);

    try {
      const response = await fetch("/api/scrape-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to scrape website");
      }

      setScraped(data.scraped);

      // Auto-generate prompt
      if (data.animationPrompt) {
        onPromptGenerated(data.animationPrompt);
      }

      // Pass found images to parent
      if (data.scraped?.images?.length > 0 && onImagesFound) {
        onImagesFound(data.scraped.images);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scrape website");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScrape();
    }
  };

  return (
    <div className="space-y-3">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter website URL (e.g., example.com)"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
        </div>
        <Button
          onClick={handleScrape}
          disabled={isLoading || !url.trim()}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Generate</span>
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Scraped Preview */}
      {scraped && (
        <div className="bg-background border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium text-foreground text-sm truncate">
                {scraped.brandName || scraped.title}
              </h4>
              {scraped.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {scraped.description}
                </p>
              )}
            </div>
            <a
              href={scraped.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Colors */}
          {scraped.colors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Colors:</span>
              <div className="flex gap-1">
                {scraped.colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded border border-border"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Images Preview */}
          {scraped.images.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ImageIcon className="w-3 h-3" />
                <span>{scraped.images.length} images found</span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {scraped.images.slice(0, 4).map((img, i) => (
                  <img
                    key={i}
                    src={img.src}
                    alt={img.alt || `Image ${i + 1}`}
                    className="w-12 h-12 object-cover rounded border border-border shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Key Points */}
          {scraped.keyPoints.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Key points:</span>
              <ul className="text-xs text-foreground space-y-0.5">
                {scraped.keyPoints.slice(0, 3).map((point, i) => (
                  <li key={i} className="truncate">
                    • {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-emerald-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Prompt generated! Edit below if needed.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground-dim text-center">
        Paste any website URL to auto-generate an animation prompt
      </p>
    </div>
  );
}
