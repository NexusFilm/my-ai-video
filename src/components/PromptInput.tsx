"use client";

import { useState, forwardRef, useImperativeHandle, useRef } from "react";
import Link from "next/link";
import {
  ArrowUp,
  SquareArrowOutUpRight,
  Type,
  MessageCircle,
  Hash,
  BarChart3,
  Disc,
  Mic,
  Square,
  Sparkles,
  X,
  Pencil,
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { type UploadedImage } from "./ImageUploader";
import { getPresetEnhancement } from "@/lib/style-presets";
import { getVoxModePrompt } from "@/lib/vox-mode";
import { examplePrompts } from "@/examples/prompts";
import {
  validateGptResponse,
  extractComponentCode,
} from "@/helpers/sanitize-response";

const iconMap: Record<string, LucideIcon> = {
  Type,
  MessageCircle,
  Hash,
  BarChart3,
  Disc,
};

export const MODELS = [
  { id: "gpt-5.2:none", name: "GPT-5.2 (No Reasoning)", provider: "openai" },
  { id: "gpt-5.2:low", name: "GPT-5.2 (Low Reasoning)", provider: "openai" },
  { id: "gpt-5.2:medium", name: "GPT-5.2 (Medium Reasoning)", provider: "openai" },
  { id: "gpt-5.2:high", name: "GPT-5.2 (High Reasoning)", provider: "openai" },
  { id: "gpt-5.2-pro:medium", name: "GPT-5.2 Pro (Medium)", provider: "openai" },
  { id: "gpt-5.2-pro:high", name: "GPT-5.2 Pro (High)", provider: "openai" },
  { id: "gpt-5.2-pro:xhigh", name: "GPT-5.2 Pro (XHigh)", provider: "openai" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google" },
] as const;

// Helper to get provider from model ID
const getModelProvider = (modelId: ModelId): "openai" | "google" => {
  const model = MODELS.find(m => m.id === modelId);
  return model?.provider || "openai";
};

export type ModelId = (typeof MODELS)[number]["id"];

export type StreamPhase = "idle" | "reasoning" | "generating";

export type GenerationErrorType = "validation" | "api";

export interface PromptInputRef {
  triggerGeneration: () => void;
  triggerFix: (code: string, error: string) => void;
}

interface PromptInputProps {
  onCodeGenerated?: (code: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onStreamPhaseChange?: (phase: StreamPhase) => void;
  onProgressChange?: (progress: number, estimatedTotal: number, current: number) => void;
  onError?: (error: string, type: GenerationErrorType) => void;
  variant?: "landing" | "editor";
  prompt?: string;
  onPromptChange?: (prompt: string) => void;
  /** Called when landing variant submits - receives prompt and model for navigation */
  onNavigate?: (prompt: string, model: ModelId) => void;
  /** Whether navigation is in progress (for landing variant) */
  isNavigating?: boolean;
  /** Whether to show the "View Code examples" link (landing variant) */
  showCodeExamplesLink?: boolean;
  /** Current code for refine mode */
  currentCode?: string;
  /** Whether we're in refine mode (editing existing code) */
  isRefineMode?: boolean;
  /** Callback when refine mode changes */
  onRefineModeChange?: (isRefine: boolean) => void;
  /** Aspect ratio for generation context */
  aspectRatio?: "16:9" | "9:16";
  /** Motion blur setting */
  motionBlur?: number;
  /** Uploaded images (references and assets) */
  uploadedImages?: UploadedImage[];
  /** Selected style presets */
  selectedPresets?: string[];
}

export const PromptInput = forwardRef<PromptInputRef, PromptInputProps>(
  function PromptInput(
    {
      onCodeGenerated,
      onStreamingChange,
      onStreamPhaseChange,
      onError,
      variant = "editor",
      prompt: controlledPrompt,
      onPromptChange,
      onNavigate,
      isNavigating = false,
      showCodeExamplesLink = false,
      currentCode,
      isRefineMode = false,
      onRefineModeChange,
      aspectRatio = "16:9",
      motionBlur = 0,
      uploadedImages = [],
      selectedPresets = [],
    },
    ref,
  ) {
    const [uncontrolledPrompt, setUncontrolledPrompt] = useState("");
    const [model, setModel] = useState<ModelId>("gpt-5.2:low");
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Estimate total code length based on prompt complexity
    const estimateCodeLength = (promptText: string): number => {
      const words = promptText.split(/\s+/).length;
      const hasDataViz = /chart|graph|data|visualiz|plot|bar|line|pie/i.test(promptText);
      const hasPhysics = /bounc|fall|grav|physic|collid|velocity/i.test(promptText);
      const hasMultipleElements = /and|with|then|also|multiple|several/gi.test(promptText) && (promptText.match(/and|with|then|also|multiple|several/gi)?.length ?? 0) > 2;
      
      // Base estimate: 150 lines for simple animations
      let estimate = 150;
      
      // Add lines based on complexity factors
      if (words > 20) estimate += 50; // Detailed prompts need more code
      if (hasDataViz) estimate += 80; // Data visualizations are longer
      if (hasPhysics) estimate += 60; // Physics simulations need calculations
      if (hasMultipleElements) estimate += 40; // Multiple elements = more code
      
      // Cap at 350 lines (very complex animations)
      return Math.min(350, estimate);
    };

    // Support both controlled and uncontrolled modes
    const prompt =
      controlledPrompt !== undefined ? controlledPrompt : uncontrolledPrompt;
    const setPrompt = onPromptChange || setUncontrolledPrompt;
    const [isLoading, setIsLoading] = useState(false);

    // Load and save prompt history for style learning
    const savePromptToHistory = (prompt: string) => {
      const history = JSON.parse(localStorage.getItem("promptHistory") || "[]");
      history.push(prompt);
      // Keep last 20 prompts
      const recentHistory = history.slice(-20);
      localStorage.setItem("promptHistory", JSON.stringify(recentHistory));
    };

    const getPromptHistory = (): string[] => {
      return JSON.parse(localStorage.getItem("promptHistory") || "[]");
    };

    const runGeneration = async (overridePrompt?: string, overrideCode?: string) => {
      const activePrompt = overridePrompt || prompt;
      if (!activePrompt.trim() || isLoading) return;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      onStreamingChange?.(true);
      onStreamPhaseChange?.("reasoning");
      
      try {
        const provider = getModelProvider(model);
        
        // Process uploaded images
        const references = uploadedImages.filter(img => img.type === "reference");
        const assets = uploadedImages.filter(img => img.type === "asset");
        
        // Analyze reference images if any
        let referenceContext = "";
        if (references.length > 0) {
          onStreamPhaseChange?.("reasoning");
          const analyses = await Promise.all(
            references.map(async (ref) => {
              try {
                const response = await fetch("/api/analyze-reference", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    imageUrl: ref.url,
                    userDescription: ref.description,
                  }),
                });
                const data = await response.json();
                return `Reference "${ref.name}": ${data.analysis}`;
              } catch (err) {
                console.error("Failed to analyze reference:", err);
                return "";
              }
            })
          );
          referenceContext = analyses.filter(Boolean).join("\n\n");
        }
        
        // Convert asset images to data URLs if needed
        const assetData = await Promise.all(
          assets.map(async (asset) => {
            if (asset.file) {
              const formData = new FormData();
              formData.append("file", asset.file);
              try {
                const response = await fetch("/api/upload-asset", {
                  method: "POST",
                  body: formData,
                });
                const data = await response.json();
                return { name: asset.name, dataUrl: data.dataUrl };
              } catch (err) {
                console.error("Failed to upload asset:", err);
                return { name: asset.name, dataUrl: asset.url };
              }
            }
            return { name: asset.name, dataUrl: asset.url };
          })
        );
        
        // Build enhanced prompt with proper asset/reference prioritization
        // Assets and references come FIRST for higher priority in AI reasoning
        let promptParts: string[] = [];
        
        // Add assets with high priority upfront
        if (assetData.length > 0) {
          const assetDescriptions = assetData.map(a => `- "${a.name}"`).join("\n");
          promptParts.push(
            `## REQUIRED ASSETS TO INTEGRATE:\n\nYou MUST incorporate these image assets into the animation. They are critical components:\n${assetDescriptions}\n\nIMPORTANT: These assets must be visible and actively used in the final animation. Embed each asset using: <img src="[dataUrl]" /> with the corresponding data URL provided below.`
          );
        }
        
        // Add reference analysis
        if (referenceContext) {
          promptParts.push(`## VISUAL REFERENCES:\n${referenceContext}`);
        }
        
        // Add user request
        let userRequestSection = `## YOUR REQUEST:\n${activePrompt}`;
        
        // Apply style preset enhancements to the user request
        if (selectedPresets.length > 0 && !overridePrompt) {
          const presetEnhancement = getPresetEnhancement(selectedPresets);
          userRequestSection = `${presetEnhancement}\n\n${userRequestSection}`;
          
          // If Vox mode is selected, apply Vox specialist system
          if (selectedPresets.includes("vox")) {
            userRequestSection = getVoxModePrompt(activePrompt);
          }
        }
        
        promptParts.push(userRequestSection);
        
        // Combine all parts
        let enhancedPrompt = promptParts.join("\n\n");
        
        // Add asset data URLs for embedding at the end as reference
        if (assetData.length > 0) {
          const assetEmbeds = assetData
            .map(a => `ASSET: ${a.name}\nDATA_URL: ${a.dataUrl}`)
            .join("\n\n");
          enhancedPrompt += `\n\n## ASSET DATA (copy-paste these data URLs into your code):\n\n${assetEmbeds}`;
        }
        
        // Determine which endpoint to use
        let endpoint = "/api/generate";
        let body: Record<string, unknown> = { prompt: enhancedPrompt, model };
        
        // Use the overridden code (for auto-fix) or the current code (for refinement)
        const codeContext = overrideCode || (isRefineMode ? currentCode : undefined);
        
        if (codeContext) {
          // Use refine endpoint for context-aware editing or fixing
          endpoint = "/api/refine";
          body = {
            currentCode: codeContext,
            refinementPrompt: enhancedPrompt,
            previousPrompts: getPromptHistory(),
          };
        } else if (provider === "google") {
          // Use Gemini endpoint
          endpoint = "/api/generate-gemini";
          body = { prompt: enhancedPrompt, model };
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || `API error: ${response.status}`;
          // Check if this is a validation error from the API
          if (errorData.type === "validation") {
            onError?.(errorMessage, "validation");
            return;
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let accumulatedText = "";
        let buffer = "";
        
        // Estimate total lines for progress tracking
        const estimatedTotalLines = estimateCodeLength(enhancedPrompt);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from the buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6); // Remove "data: " prefix

            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);

              // Track phase changes
              if (event.type === "reasoning-start") {
                onStreamPhaseChange?.("reasoning");
              } else if (event.type === "text-start") {
                onStreamPhaseChange?.("generating");
              } else if (event.type === "text-delta") {
                accumulatedText += event.delta;

                // Strip markdown code block markers and show raw code during streaming
                let codeToShow = accumulatedText;
                codeToShow = codeToShow.replace(/^```(?:tsx?|jsx?)?\n?/, "");
                codeToShow = codeToShow.replace(/\n?```\s*$/, "");
                
                // Calculate progress based on accumulated lines
                const currentLines = codeToShow.split('\n').length;
                const progressPercent = Math.min(95, Math.round((currentLines / estimatedTotalLines) * 100));
                onProgressChange?.(progressPercent, estimatedTotalLines, currentLines);

                onCodeGenerated?.(codeToShow.trim());
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseError) {
              // Only re-throw if it's an actual Error we created, not a JSON parse error
              if (parseError instanceof Error && parseError.message !== "Unexpected token") {
                throw parseError;
              }
            }
          }
        }

        // Sanitize the final response (strip markdown code block wrappers and trailing text)
        let finalCode = accumulatedText;
        finalCode = finalCode.replace(/^```(?:tsx?|jsx?)?\n?/, "");
        finalCode = finalCode.replace(/\n?```\s*$/, "");
        finalCode = extractComponentCode(finalCode);

        // Update the editor with the cleaned code
        onCodeGenerated?.(finalCode);
        
        // Report completion
        const finalLines = finalCode.split('\n').length;
        onProgressChange?.(100, estimatedTotalLines, finalLines);

        const validation = validateGptResponse(finalCode);
        if (!validation.isValid && validation.error) {
          onError?.(validation.error, "validation");
        }
      } catch (error) {
        // Don't show error if request was cancelled
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Error generating code:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        onError?.(errorMessage, "api");
      } finally {
        setIsLoading(false);
        onStreamingChange?.(false);
        onStreamPhaseChange?.("idle");
        abortControllerRef.current = null;
      }
    };

    const cancelGeneration = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        onStreamingChange?.(false);
        onStreamPhaseChange?.("idle");
      }
    };

    // Expose triggerGeneration via ref
    useImperativeHandle(ref, () => ({
      triggerGeneration: () => runGeneration(),
      triggerFix: (code: string, error: string) => {
        const fixPrompt = `Fix the following Remotion code which produced this error:\n\nError: ${error}\n\nCode:\n${code}\n\nPlease fix the error while maintaining the original functionality.`;
        // We pass the code as a second argument to runGeneration, which will cause it to use the /api/refine endpoint
        // effectively treating this as a refinement/fix operation
        runGeneration(fixPrompt, code);
      }
    }));

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await transcribeAudio(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error starting recording:", error);
        onError?.("Failed to access microphone", "api");
      }
    };

    const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    };

    const transcribeAudio = async (audioBlob: Blob) => {
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Transcription failed");
        }

        const data = await response.json();
        setPrompt(data.text);
      } catch (error) {
        console.error("Transcription error:", error);
        onError?.("Failed to transcribe audio", "api");
      } finally {
        setIsTranscribing(false);
      }
    };

    const enhancePrompt = async () => {
      if (!prompt.trim() || isEnhancing) return;

      setIsEnhancing(true);
      try {
        const previousPrompts = getPromptHistory();
        
        const response = await fetch("/api/enhance-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, previousPrompts }),
        });

        if (!response.ok) {
          throw new Error("Enhancement failed");
        }

        const data = await response.json();
        setPrompt(data.enhancedPrompt);
      } catch (error) {
        console.error("Enhancement error:", error);
        onError?.("Failed to enhance prompt", "api");
      } finally {
        setIsEnhancing(false);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;

      // Save prompt to history for style learning
      savePromptToHistory(prompt);

      // Landing variant uses navigation instead of API call
      if (isLanding && onNavigate) {
        onNavigate(prompt, model);
        return;
      }

      await runGeneration();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit(e);
      }
    };

    const isLanding = variant === "landing";
    const isDisabled = isLanding ? isNavigating : isLoading;

    return (
      <div
        className={
          isLanding
            ? "flex flex-col items-center w-full"
            : "flex flex-col gap-2"
        }
      >
        <form
          onSubmit={handleSubmit}
          className={isLanding ? "w-full" : ""}
        >
          <div className="bg-background-elevated rounded-xl border border-border p-4">
            {/* Refine mode indicator */}
            {isRefineMode && !isLanding && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                <Pencil className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-500">Refine Mode - Describe what to change</span>
              </div>
            )}
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRefineMode ? "Describe what to change (e.g., 'make the text bigger', 'change color to blue')..." : "Describe your animation..."}
              className={`w-full bg-transparent text-foreground placeholder:text-muted-foreground-dim focus:outline-none resize-none overflow-y-auto ${
                isLanding
                  ? "text-base min-h-[60px] max-h-[300px]"
                  : "text-sm min-h-[40px] max-h-[250px]"
              }`}
              style={{ fieldSizing: "content" }}
              disabled={isDisabled}
            />

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Select
                  value={model}
                  onValueChange={(value) => setModel(value as ModelId)}
                  disabled={isDisabled}
                >
                  <SelectTrigger className="w-auto bg-transparent border-none text-muted-foreground hover:text-foreground transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background-elevated border-border">
                    {MODELS.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        className="text-foreground focus:bg-secondary focus:text-foreground"
                      >
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Refine mode toggle - only show in editor variant when there's code */}
                {!isLanding && currentCode && (
                  <Button
                    type="button"
                    variant={isRefineMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => onRefineModeChange?.(!isRefineMode)}
                    className={isRefineMode 
                      ? "bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 h-7" 
                      : "border-border text-muted-foreground hover:text-foreground text-xs px-2 py-1 h-7"
                    }
                  >
                    {isRefineMode ? (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        New
                      </>
                    ) : (
                      <>
                        <Pencil className="w-3 h-3 mr-1" />
                        Refine
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={enhancePrompt}
                  disabled={!prompt.trim() || isDisabled || isEnhancing}
                  loading={isEnhancing}
                  className="text-purple-500 hover:text-purple-400"
                  title="Enhance prompt with AI"
                >
                  <Sparkles className="w-5 h-5" />
                </Button>

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isDisabled || isTranscribing}
                  className={isRecording ? "text-red-500 hover:text-red-400" : ""}
                  title={isRecording ? "Stop recording" : "Voice input"}
                >
                  {isRecording ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {/* Cancel button - only show when loading */}
                {isLoading && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={cancelGeneration}
                    className="text-red-500 hover:text-red-400"
                    title="Cancel generation"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}

                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={!prompt.trim() || isDisabled}
                  loading={isDisabled}
                  className="bg-foreground text-background hover:bg-gray-200"
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center gap-1.5 mt-3 ${
              isLanding ? "justify-center mt-6 gap-2" : ""
            }`}
          >
            <span className="text-muted-foreground-dim text-xs mr-1">
              Prompt Examples
            </span>
            {examplePrompts.map((example) => {
              const Icon = iconMap[example.icon];
              return (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => setPrompt(example.prompt)}
                  style={{
                    borderColor: `${example.color}40`,
                    color: example.color,
                  }}
                  className={`rounded-full bg-background-elevated border hover:brightness-125 transition-all flex items-center gap-1 px-1.5 py-0.5 text-[11px]`}
                >
                  <Icon className="w-3 h-3" />
                  {example.headline}
                </button>
              );
            })}
          </div>

          {showCodeExamplesLink && (
            <div className="flex justify-center mt-4">
              <Link
                href="/code-examples"
                className="text-muted-foreground-dim hover:text-muted-foreground text-xs transition-colors flex items-center gap-1"
              >
                View Code examples
                <SquareArrowOutUpRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </form>
      </div>
    );
  },
);
