"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import type { NextPage } from "next";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  FolderOpen,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
} from "lucide-react";
import { CodeEditor } from "../../components/CodeEditor";
import { AnimationPlayer } from "../../components/AnimationPlayer";
import { PageLayout } from "../../components/PageLayout";
import {
  PromptInput,
  type StreamPhase,
  type PromptInputRef,
  type GenerationErrorType,
} from "../../components/PromptInput";
import { type UploadedImage } from "../../components/ImageUploader";
import { ProjectsPanel } from "../../components/ProjectsPanel";
import {
  type Project,
  supabaseProjectStorage,
} from "../../lib/supabase-storage";
import { Button } from "../../components/ui/button";
import { examples } from "../../examples/code";
import { useAnimationState } from "../../hooks/useAnimationState";

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || "";

  // If we have an initial prompt from URL, start in streaming state
  // so syntax highlighting is disabled from the beginning
  const willAutoStart = Boolean(initialPrompt);

  // Get settings from URL params
  const urlAspectRatio = searchParams.get("aspectRatio") as
    | "16:9"
    | "9:16"
    | null;
  const urlMotionBlur = searchParams.get("motionBlur");
  const urlPresets = searchParams.get("presets");

  // Get images from sessionStorage
  const [uploadedImages] = useState<UploadedImage[]>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("uploadedImages");
      if (stored) {
        sessionStorage.removeItem("uploadedImages"); // Clear after reading
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [durationInFrames, setDurationInFrames] = useState(
    examples[0]?.durationInFrames || 150,
  );
  const [fps, setFps] = useState(examples[0]?.fps || 30);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">(
    urlAspectRatio || "16:9",
  );
  const [motionBlur, setMotionBlur] = useState(
    urlMotionBlur ? parseInt(urlMotionBlur, 10) : 0,
  );
  const [isStreaming, setIsStreaming] = useState(willAutoStart);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(
    willAutoStart ? "reasoning" : "idle",
  );
  const [generationProgress, setGenerationProgress] = useState<{
    percent: number;
    current: number;
    total: number;
  } | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [generationError, setGenerationError] = useState<{
    message: string;
    type: GenerationErrorType;
  } | null>(null);
  const [isRefineMode, setIsRefineMode] = useState(false);
  const selectedPresets = urlPresets ? urlPresets.split(",") : [];
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);

  // Agent Brain state - now shows suggestions instead of auto-fixing
  const [suggestedFix, setSuggestedFix] = useState<{
    fixedCode: string;
    explanation: string;
    linesChanged: number[];
  } | null>(null);
  const [isAnalyzingError, setIsAnalyzingError] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    currentUsage: number;
    dailyLimit: number;
    percentUsed: number;
    warning?: string;
    overLimit: boolean;
  } | null>(null);

  const { code, Component, error, isCompiling, setCode, compileCode } =
    useAnimationState(examples[0]?.code || "");

  // Debounce compilation
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStreamingRef = useRef(isStreaming);
  const codeRef = useRef(code);
  const justFinishedGenerationRef = useRef(false);

  // Fetch token usage on mount and after generation
  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setTokenUsage(data);
      }
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Refresh usage after streaming ends
  useEffect(() => {
    if (!isStreaming && hasGeneratedOnce) {
      fetchUsage();
    }
  }, [isStreaming, hasGeneratedOnce, fetchUsage]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;

    // Clear suggested fix when starting new generation
    if (isStreaming) {
      setSuggestedFix(null);
    }

    // Compile when streaming ends
    if (wasStreaming && !isStreaming) {
      compileCode(codeRef.current);
      justFinishedGenerationRef.current = true;

      // Check for errors after a brief delay to allow compilation to finish
      setTimeout(() => {
        if (justFinishedGenerationRef.current) {
          justFinishedGenerationRef.current = false;
        }
      }, 2000);
    }
  }, [isStreaming, compileCode]);

  // Analyze error and get suggestion (but don't auto-apply)
  const analyzeError = useCallback(
    async (errorMessage: string) => {
      if (isAnalyzingError || !errorMessage) return;

      setIsAnalyzingError(true);
      setSuggestedFix(null);

      try {
        const response = await fetch("/api/quick-fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, error: errorMessage }),
        });

        if (response.status === 429) {
          const errorData = await response.json();
          setIsRateLimited(true);
          setGenerationError({
            message: `Rate limited: ${errorData.error}`,
            type: "api",
          });
          setTimeout(() => setIsRateLimited(false), 10000);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to analyze error");
        }

        const result = await response.json();

        if (result.fixedCode && result.linesChanged?.length > 0) {
          setSuggestedFix({
            fixedCode: result.fixedCode,
            explanation: result.explanation,
            linesChanged: result.linesChanged,
          });
        } else {
          setSuggestedFix({
            fixedCode: "",
            explanation:
              result.explanation || "Unable to suggest a fix for this error.",
            linesChanged: [],
          });
        }
      } catch (err) {
        console.error("Error analyzing:", err);
        setSuggestedFix({
          fixedCode: "",
          explanation:
            "Failed to analyze the error. Try manually fixing or regenerating.",
          linesChanged: [],
        });
      } finally {
        setIsAnalyzingError(false);
      }
    },
    [code, isAnalyzingError],
  );

  // Apply the suggested fix
  const applySuggestedFix = useCallback(() => {
    if (suggestedFix?.fixedCode) {
      setCode(suggestedFix.fixedCode);
      compileCode(suggestedFix.fixedCode);
      setSuggestedFix(null);
      setGenerationError(null);
    }
  }, [suggestedFix, setCode, compileCode]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setHasGeneratedOnce(true);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // If user edits manually, stop auto-fixing logic for this session
      if (!isStreamingRef.current) {
        justFinishedGenerationRef.current = false;
      }

      // Skip compilation while streaming - will compile when streaming ends
      if (isStreamingRef.current) {
        return;
      }

      // Set new debounce
      debounceRef.current = setTimeout(() => {
        compileCode(newCode);
      }, 500);
    },
    [setCode, compileCode],
  );

  // Cleanup debounce on unmount and cancel all pending requests
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Cancel all pending API requests when leaving page
      promptInputRef.current?.cancelAll();
    };
  }, []);

  const handleStreamingChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
    if (!streaming) {
      setGenerationProgress(null);
    }
    // Clear errors and reset state when starting a new generation
    if (streaming) {
      setGenerationError(null);
      setIsRateLimited(false);
      setSuggestedFix(null);
    }
  }, []);

  // Handle user clicking cancel button
  const handleCancel = useCallback(() => {
    setIsRateLimited(false);
    setSuggestedFix(null);
    justFinishedGenerationRef.current = false;
    promptInputRef.current?.cancelAll();
  }, []);

  const handleError = useCallback(
    (message: string, type: GenerationErrorType) => {
      setGenerationError({ message, type });

      // If this is a rate limit error, disable auto-heal
      if (message.includes("Rate limit") || message.includes("rate limit")) {
        setIsRateLimited(true);
        // Auto-clear rate limit flag after 10 seconds so user can try again
        setTimeout(() => {
          setIsRateLimited(false);
        }, 10000);
      }
    },
    [],
  );

  const handleProgressChange = useCallback(
    (percent: number, total: number, current: number) => {
      setGenerationProgress({ percent, total, current });
    },
    [],
  );

  // Auto-trigger generation if prompt came from URL
  const promptInputRef = useRef<PromptInputRef>(null);

  useEffect(() => {
    if (initialPrompt && !hasAutoStarted && promptInputRef.current) {
      setHasAutoStarted(true);
      // Small delay to ensure component is mounted
      setTimeout(() => {
        promptInputRef.current?.triggerGeneration();
      }, 100);
    }
  }, [initialPrompt, hasAutoStarted]);

  const handleLoadProject = useCallback(
    (project: Project) => {
      setCode(project.code);
      setPrompt(project.prompt);
      setDurationInFrames(project.settings.durationInFrames);
      setFps(project.settings.fps);
      setAspectRatio(project.settings.aspectRatio);
      setMotionBlur(project.settings.motionBlur);
      setHasGeneratedOnce(true);
      compileCode(project.code);
    },
    [setCode, compileCode],
  );

  // Initialize storage on mount
  useEffect(() => {
    supabaseProjectStorage.init().catch(console.error);
  }, []);

  // Status Indicator - shows when analyzing errors
  const StatusIndicator = isAnalyzingError ? (
    <div className="rounded-full px-3 py-1 flex items-center gap-2 text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
      <RefreshCw className="w-3 h-3 animate-spin" />
      <span>Analyzing Error...</span>
    </div>
  ) : null;

  // Token Usage Indicator
  const UsageIndicator = tokenUsage && (
    <div
      className={`rounded-full px-3 py-1 flex items-center gap-2 text-xs font-medium ${
        tokenUsage.overLimit
          ? "bg-red-500/10 text-red-500 border border-red-500/20"
          : tokenUsage.percentUsed >= 80
            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
      }`}
      title={
        tokenUsage.warning ||
        `${tokenUsage.currentUsage.toLocaleString()} / ${tokenUsage.dailyLimit.toLocaleString()} tokens used today`
      }
    >
      <span>
        {tokenUsage.overLimit ? "⚠️ " : ""}
        {Math.round(tokenUsage.percentUsed)}% tokens
      </span>
    </div>
  );

  return (
    <PageLayout
      showLogoAsLink
      rightContent={
        <div className="flex items-center gap-3">
          {/* Token Usage Indicator */}
          {UsageIndicator}

          {/* Status Indicator - shows when analyzing */}
          {StatusIndicator}

          <Button
            onClick={() => setProjectsPanelOpen(true)}
            variant="outline"
            size="sm"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Projects
          </Button>
        </div>
      }
    >
      <div className="flex flex-col min-w-0 px-4 md:px-8 lg:px-12 pb-8 gap-6">
        {/* Main content area with editor and player */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
          {/* Code Editor */}
          <div className="flex-1 lg:flex-[3] h-[500px] lg:h-[600px]">
            <CodeEditor
              code={hasGeneratedOnce && !generationError ? code : ""}
              onChange={handleCodeChange}
              isStreaming={isStreaming}
              streamPhase={streamPhase}
              generationProgress={generationProgress}
            />
          </div>

          {/* Video Player */}
          <div className="flex-1 lg:flex-[2.5] min-h-[400px]">
            <AnimationPlayer
              Component={generationError ? null : Component}
              durationInFrames={durationInFrames}
              fps={fps}
              aspectRatio={aspectRatio}
              motionBlur={motionBlur}
              onDurationChange={setDurationInFrames}
              onFpsChange={setFps}
              onAspectRatioChange={setAspectRatio}
              onMotionBlurChange={setMotionBlur}
              isCompiling={isCompiling}
              isStreaming={isStreaming}
              error={generationError?.message || error}
              errorType={generationError?.type || "compilation"}
              code={code}
            />
          </div>
        </div>

        {/* Prompt Input at bottom */}
        <div className="mt-4 relative">
          <PromptInput
            ref={promptInputRef}
            onCodeGenerated={handleCodeChange}
            onStreamingChange={handleStreamingChange}
            onStreamPhaseChange={setStreamPhase}
            onProgressChange={handleProgressChange}
            onError={handleError}
            onCancel={handleCancel}
            prompt={prompt}
            onPromptChange={setPrompt}
            currentCode={hasGeneratedOnce ? code : undefined}
            isRefineMode={isRefineMode}
            onRefineModeChange={setIsRefineMode}
            aspectRatio={aspectRatio}
            motionBlur={motionBlur}
            uploadedImages={uploadedImages}
            selectedPresets={selectedPresets}
          />

          {/* Error Fix Suggestion UI */}
          {(generationError || error) && !isStreaming && (
            <div className="mt-4 bg-background-elevated border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-400 font-medium mb-2">
                    Error Detected
                  </p>
                  <p className="text-xs text-muted-foreground mb-3 font-mono break-all">
                    {generationError?.message || error}
                  </p>

                  {/* Show suggestion if available */}
                  {suggestedFix && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm text-emerald-400 font-medium">
                          AI Suggestion
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {suggestedFix.explanation}
                      </p>
                      {suggestedFix.linesChanged.length > 0 && (
                        <p className="text-xs text-muted-foreground-dim">
                          Lines to fix: {suggestedFix.linesChanged.join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    {!suggestedFix && !isAnalyzingError && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                        onClick={() =>
                          analyzeError(generationError?.message || error || "")
                        }
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Get AI Suggestion
                      </Button>
                    )}

                    {isAnalyzingError && (
                      <Button size="sm" variant="outline" disabled>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Analyzing...
                      </Button>
                    )}

                    {suggestedFix?.fixedCode && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={applySuggestedFix}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Apply Fix
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setGenerationError(null);
                        setSuggestedFix(null);
                      }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projects Panel */}
      {projectsPanelOpen && (
        <ProjectsPanel
          currentCode={code}
          currentPrompt={prompt}
          currentSettings={{
            durationInFrames,
            fps,
            aspectRatio,
            motionBlur,
            selectedPresets,
          }}
          onLoadProject={handleLoadProject}
          onClose={() => setProjectsPanelOpen(false)}
        />
      )}
    </PageLayout>
  );
}

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-foreground" />
    </div>
  );
}

const GeneratePage: NextPage = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GeneratePageContent />
    </Suspense>
  );
};

export default GeneratePage;
