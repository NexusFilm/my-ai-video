"use client";

import { STYLE_PRESETS } from "@/lib/style-presets";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface StylePresetSelectorProps {
  selectedPresets: string[];
  onPresetsChange: (presets: string[]) => void;
}

export const StylePresetSelector: React.FC<StylePresetSelectorProps> = ({
  selectedPresets,
  onPresetsChange,
}) => {
  const togglePreset = (presetId: string) => {
    if (selectedPresets.includes(presetId)) {
      onPresetsChange(selectedPresets.filter((id) => id !== presetId));
    } else {
      onPresetsChange([...selectedPresets, presetId]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-1">
        Select style presets to enhance your prompt
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STYLE_PRESETS.map((preset) => {
          const isSelected = selectedPresets.includes(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => togglePreset(preset.id)}
              className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all hover:scale-[1.02] relative ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-muted-foreground/30"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{preset.icon}</span>
                <span className="text-sm font-semibold text-foreground">
                  {preset.name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2 text-left">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
      {selectedPresets.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-md px-3 py-2">
          <Check className="w-3.5 h-3.5" />
          <span>
            {selectedPresets.length} style{selectedPresets.length > 1 ? "s" : ""} selected
          </span>
        </div>
      )}
    </div>
  );
};
