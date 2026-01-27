"use client";

import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from "react";
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
  { id: "gpt-4o", name: "GPT-4o (Recommended)", provider: "openai" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast)", provider: "openai" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google" },
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
  cancelAll: () => void;
}

interface PromptInputProps {
  onCodeGenerated?: (code: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onStreamPhaseChange?: (phase: StreamPhase) => void;
  onProgressChange?: (progress: number, estimatedTotal: number, current: number) => void;
  onError?: (error: string, type: GenerationErrorType) => void;
  onCancel?: () => void;
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
      onProgressChange,
      onError,
      onCancel,
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
    const [model, setModel] = useState<ModelId>("gpt-4o");
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const quickFixAbortRef = useRef<AbortController | null>(null);
    const isCancelledRef = useRef(false);

    // Estimate total code length based on prompt complexity (more realistic)
    const estimateCodeLength = (promptText: string): number => {
      const words = promptText.split(/\s+/).length;
      
      // Pattern detection for complexity
      const hasDataViz = /chart|graph|data|visualiz|plot|bar|line|pie|axis|scale/i.test(promptText);
      const hasPhysics = /bounc|fall|grav|physic|collid|velocity|spring|easing/i.test(promptText);
      const hasText = /text|word|sentence|type|font|label|title|subtitle/i.test(promptText);
      const hasImage = /image|avatar|logo|picture|photo|icon|element/i.test(promptText);
      const hasAnimation = /animate|transition|fade|slide|zoom|rotate|scale|morph|pulse/i.test(promptText);
      const hasMultiple = (promptText.match(/\+|and|with|also|then|multiple|several/gi) || []).length;
      
      // Base: ~200 lines for average animation
      let estimate = 200;
      
      // Word count modifier (more words = more complexity)
      if (words > 50) estimate += 80;
      else if (words > 30) estimate += 40;
      else if (words < 10) estimate -= 30;
      
      // Add for each feature detected
      if (hasDataViz) estimate += 100;  // Data viz is complex
      if (hasPhysics) estimate += 80;   // Physics/easing calculations
      if (hasText) estimate += 40;      // Text styling and positioning
      if (hasImage) estimate += 50;     // Image handling and layout
      if (hasAnimation) estimate += 60; // Transitions and keyframes
      if (hasMultiple > 2) estimate += 50; // Multiple elements compound complexity
      
      // Realistic range: 150-400 lines
      return Math.max(150, Math.min(400, estimate));
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
        
        // Log detected assets for verification
        if (assets.length > 0) {
          const assetNames = assets.map(a => a.name).join(", ");
          console.log(`📦 Detected ${assets.length} asset(s) for this generation: ${assetNames}`);
        }
        if (references.length > 0) {
          const refNames = references.map(r => r.name).join(", ");
          console.log(`👁️ Detected ${references.length} reference image(s) for style guidance: ${refNames}`);
        }
        
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
        
        // Process asset images - use data URLs that persist across requests
        const assetData = await Promise.all(
          assets.map(async (asset) => {
            console.log(`Processing asset: ${asset.name}, has publicUrl: ${!!asset.publicUrl}`);
            
            // Use the data URL returned from the server (contains full compressed image data)
            if (asset.publicUrl && asset.publicUrl.startsWith("data:")) {
              console.log(`✓ Using data URL for asset: ${asset.name} (size: ${(asset.publicUrl.length / 1024).toFixed(1)}KB)`);
              return { name: asset.name, url: asset.publicUrl, source: "data-url" };
            }
            
            // For remote URLs, use them directly
            if (asset.url?.startsWith("http")) {
              console.log(`✓ Using remote URL for asset: ${asset.name}`);
              return { name: asset.name, url: asset.url, source: "remote" };
            }
            
            // Asset is not usable
            throw new Error(`Could not process asset "${asset.name}". Please re-upload.`);
          })
        );
        
        console.log(`Processed ${assetData.length} assets:`, assetData.map(a => `${a.name} (${a.source})`).join(", "));
        
        // Build enhanced prompt with proper asset/reference prioritization
        // Assets and references come FIRST for higher priority in AI reasoning
        const appRules = `## APP RULES (always apply)
      - Use Remotion/React: generate a single component, keep imports intact
      - CRITICAL: NO trailing commas in import statements. Use: } from "remotion"; NOT }, from "remotion";
      - For images: use standard HTML <img> tags (lowercase), NEVER <Img> or Image components
      - For audio: use 'new Audio()' constructor, NEVER 'Audio()' without new
      - Use provided assets (URLs) visibly in the animation with <img src="..."> syntax
      - Keep structure stable; make minimal edits when refining/fixing
      - Respect timing, easing, and positions requested by the user
      - Prefer lightweight animations; avoid heavy DOM or unnecessary reflows`;
        let promptParts: string[] = [];
        
        // Add assets with high priority upfront
        if (assetData.length > 0) {
          const assetList = assetData
            .map((a, i) => `${i + 1}. "${a.name}" → ${a.url}`)
            .join("\n");
          promptParts.push(
            `## REQUIRED ASSETS TO INTEGRATE (${assetData.length} assets provided):\n\n${assetList}\n\n**CRITICAL - IMAGE SYNTAX RULES:**
- Use ONLY standard HTML <img> tags (lowercase)
- NEVER use <Img>, <Image>, or any component names for images
- MUST use <img src="URL" /> syntax with provided URLs
- Example: <img src="data:image/jpeg;base64,..." style={{width: "200px", borderRadius: "50%"}} />
- Position and animate images prominently in your design
- Do not ignore or mark as "undefined"
- Ensure images are visible and integrated into the animation`
          );
        }

        // Add core app rules so the model always considers platform constraints
        promptParts.push(appRules);
        
        // Add reference analysis
        if (referenceContext) {
          promptParts.push(`## VISUAL REFERENCES:\n${referenceContext}`);
        }
        
        // Add user request (original prompt is preserved here)
        let userRequestSection = `## YOUR REQUEST (user intent):\n${activePrompt}`;
        
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
        
        // Log asset references (no bloat from huge data URLs)
        if (assetData.length > 0) {
          assetData.forEach((a, i) => {
            console.log(`✓ Asset ${i + 1} (${a.name}): ${a.url}`);
          });
          console.log(`Total enhanced prompt length: ${enhancedPrompt.length} characters (images referenced by URL, not embedded as base64)`);
        }
        
        // Determine which endpoint to use
        let endpoint = "/api/generate";
        let body: Record<string, unknown> = { prompt: enhancedPrompt, model };
        
        // Use the overridden code (for auto-fix) or the current code (for refinement)
        const codeContext = overrideCode || (isRefineMode ? currentCode : undefined);
        
        if (codeContext) {
          // Use refine endpoint for context-aware editing or fixing
          endpoint = "/api/refine";
          
          // Log asset names for verification
          if (assetData.length > 0) {
            const assetNames = assetData.map(a => a.name).join(", ");
            console.log(`🎬 Refining with ${assetData.length} asset(s): ${assetNames}`);
            // Show in a UI toast would be nice too
            onStreamingChange?.(true);
            setTimeout(() => console.log(`✓ Asset names logged to help debug asset usage`), 100);
          }
          
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
      // Mark as cancelled to prevent auto-heal from retrying
      isCancelledRef.current = true;
      
      // Abort main generation request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Abort quick-fix request
      if (quickFixAbortRef.current) {
        quickFixAbortRef.current.abort();
        quickFixAbortRef.current = null;
      }
      
      setIsLoading(false);
      onStreamingChange?.(false);
      onStreamPhaseChange?.("idle");
      
      // Notify parent that user cancelled
      onCancel?.();
      
      console.log("All generation requests cancelled");
    };
    
    // Cleanup on unmount - cancel all pending requests
    useEffect(() => {
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        if (quickFixAbortRef.current) {
          quickFixAbortRef.current.abort();
        }
      };
    }, []);

    // Expose triggerGeneration via ref
    useImperativeHandle(ref, () => ({
      triggerGeneration: () => {
        isCancelledRef.current = false; // Reset cancelled state
        runGeneration();
      },
      triggerFix: async (code: string, error: string) => {
        // Check if we were cancelled
        if (isCancelledRef.current) {
          console.log("Fix skipped - user cancelled");
          return;
        }
        
        // Cancel any existing quick-fix request
        if (quickFixAbortRef.current) {
          quickFixAbortRef.current.abort();
        }
        quickFixAbortRef.current = new AbortController();
        
        // Use quick-fix endpoint for targeted fixes (faster, cheaper)
        try {
          onStreamingChange?.(true);
          onStreamPhaseChange?.("reasoning");
          
          const response = await fetch("/api/quick-fix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, error }),
            signal: quickFixAbortRef.current.signal,
          });
          
          // Check again if cancelled during fetch
          if (isCancelledRef.current) {
            console.log("Fix aborted - user cancelled");
            return;
          }
          
          // Handle rate limiting - stop auto-heal, don't fall back
          if (response.status === 429) {
            const errorData = await response.json();
            console.log("Rate limit hit, stopping auto-heal:", errorData.error);
            onError?.(`Rate limited: ${errorData.error}. Please wait before trying again.`, "api");
            return; // Don't fall back to full regeneration when rate limited
          }
          
          if (!response.ok) {
            throw new Error("Quick fix failed");
          }
          
          const result = await response.json();
          
          // Final check before applying
          if (isCancelledRef.current) {
            console.log("Fix result discarded - user cancelled");
            return;
          }
          
          if (result.fixedCode && result.linesChanged?.length > 0) {
            // Success - apply the targeted fix
            onCodeGenerated?.(result.fixedCode);
            console.log(`Auto-fix applied: ${result.explanation} (lines ${result.linesChanged.join(", ")})`);
          } else {
            // No quick fix available, fall back to full regeneration
            if (isCancelledRef.current) return;
            console.log("Quick fix unavailable, falling back to full refine...");
            const fixPrompt = `Fix this specific error in the code:\n\nError: ${error}\n\nDo NOT rewrite the entire code. Only fix the specific lines causing the error.`;
            runGeneration(fixPrompt, code);
            return; // runGeneration handles streaming state
          }
        } catch (err) {
          // Don't log or fallback if it was aborted
          if (err instanceof Error && err.name === "AbortError") {
            console.log("Quick fix aborted");
            return;
          }
          if (isCancelledRef.current) return;
          
          console.error("Quick fix error:", err);
          // Fall back to full regeneration on error
          const fixPrompt = `Fix the following Remotion code which produced this error:\n\nError: ${error}\n\nCode:\n${code}\n\nPlease fix the error while maintaining the original functionality.`;
          runGeneration(fixPrompt, code);
          return;
        } finally {
          quickFixAbortRef.current = null;
          if (!isCancelledRef.current) {
            onStreamingChange?.(false);
            onStreamPhaseChange?.("idle");
          }
        }
      },
      cancelAll: () => {
        cancelGeneration();
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
        // Append transcribed text to existing prompt instead of replacing it
        if (!prompt.trim()) {
          // If prompt is empty, just use the transcribed text
          setPrompt(data.text);
        } else {
          // Otherwise, append with a space
          setPrompt(`${prompt} ${data.text}`);
        }
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
