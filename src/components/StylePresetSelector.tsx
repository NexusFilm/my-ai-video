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
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Select style presets to enhance your prompt:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STYLE_PRESETS.map((preset) => {
          const isSelected = selectedPresets.includes(preset.id);
          return (
            <Button
              key={preset.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => togglePreset(preset.id)}
              className="flex flex-col items-start h-auto py-2 px-3 relative"
            >
              {isSelected && (
                <Check className="w-3 h-3 absolute top-1 right-1" />
              )}
              <div className="flex items-center gap-2 w-full">
                <span className="text-lg">{preset.icon}</span>
                <span className="text-xs font-medium text-left flex-1">
                  {preset.name}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground text-left mt-1 line-clamp-2">
                {preset.description}
              </span>
            </Button>
          );
        })}
      </div>
      {selectedPresets.length > 0 && (
        <p className="text-xs text-primary">
          {selectedPresets.length} style{selectedPresets.length > 1 ? "s" : ""}{" "}
          selected - will enhance your prompt
        </p>
      )}
    </div>
  );
};
