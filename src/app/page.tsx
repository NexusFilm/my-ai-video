"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/navigation";
import { PromptInput, type ModelId } from "@/components/PromptInput";
import { PageLayout } from "@/components/PageLayout";
import { StylePresetSelector } from "@/components/StylePresetSelector";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AccordionItem } from "@/components/ui/accordion";

const Home: NextPage = () => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [motionBlur, setMotionBlur] = useState(0);

  const handleNavigate = (prompt: string, model: ModelId) => {
    setIsNavigating(true);
    
    // Encode all settings in URL params
    const params = new URLSearchParams({ 
      prompt, 
      model,
      aspectRatio,
      motionBlur: motionBlur.toString(),
    });
    
    // Add presets if any
    if (selectedPresets.length > 0) {
      params.set("presets", selectedPresets.join(","));
    }
    
    // Store images in sessionStorage since they can't go in URL
    if (uploadedImages.length > 0) {
      sessionStorage.setItem("uploadedImages", JSON.stringify(uploadedImages));
    }
    
    router.push(`/generate?${params.toString()}`);
  };

  return (
    <PageLayout>
      <div className="flex flex-col items-center px-4 py-8 max-w-5xl mx-auto w-full min-h-screen">
        <h1 className="text-5xl font-bold text-white mb-10 text-center">
          What do you want to create?
        </h1>

        <div className="w-full space-y-4 mb-6">
          {/* Style Presets - Collapsible */}
          <AccordionItem title="Style Presets" defaultOpen={false}>
            <p className="text-xs text-muted-foreground mb-3">
              Select style presets to enhance your prompt:
            </p>
            <StylePresetSelector
              selectedPresets={selectedPresets}
              onPresetsChange={setSelectedPresets}
            />
          </AccordionItem>

          {/* Image Upload - Collapsible and Compact */}
          <AccordionItem title="Images" defaultOpen={false}>
            <ImageUploader
              images={uploadedImages}
              onImagesChange={setUploadedImages}
            />
          </AccordionItem>

          {/* Video Settings - Collapsible */}
          <AccordionItem title="Video Settings" defaultOpen={true}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Aspect Ratio */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Aspect Ratio
                </label>
                <Select
                  value={aspectRatio}
                  onValueChange={(value) => setAspectRatio(value as "16:9" | "9:16")}
                >
                  <SelectTrigger className="w-full bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background-elevated border-border">
                    <SelectItem
                      value="16:9"
                      className="text-foreground focus:bg-secondary focus:text-foreground"
                    >
                      16:9 (YouTube)
                    </SelectItem>
                    <SelectItem
                      value="9:16"
                      className="text-foreground focus:bg-secondary focus:text-foreground"
                    >
                      9:16 (TikTok/Instagram)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Motion Blur */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Motion Blur: {motionBlur === 0 ? "Off" : motionBlur}
                </label>
                <Slider
                  value={[motionBlur]}
                  onValueChange={(values) => setMotionBlur(values[0])}
                  min={0}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </AccordionItem>
        </div>

        {/* Prompt Input */}
        <div className="w-full">
          <PromptInput
            variant="landing"
            onNavigate={handleNavigate}
            isNavigating={isNavigating}
            showCodeExamplesLink
            aspectRatio={aspectRatio}
            motionBlur={motionBlur}
            uploadedImages={uploadedImages}
            selectedPresets={selectedPresets}
          />
        </div>
      </div>
    </PageLayout>
  );
};

export default Home;
