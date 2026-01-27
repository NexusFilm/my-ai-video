"use client";

import { useState, useEffect } from "react";
import {
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  X,
  Cloud,
  CloudOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { supabaseProjectStorage, type Project } from "@/lib/supabase-storage";

interface ProjectsPanelProps {
  currentCode: string;
  currentPrompt: string;
  currentSettings: {
    durationInFrames: number;
    fps: number;
    aspectRatio: "16:9" | "9:16";
    motionBlur: number;
    selectedPresets?: string[];
  };
  onLoadProject: (project: Project) => void;
  onClose: () => void;
}

export function ProjectsPanel({
  currentCode,
  currentPrompt,
  currentSettings,
  onLoadProject,
  onClose,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initStorage();
  }, []);

  const initStorage = async () => {
    try {
      await supabaseProjectStorage.init();
      setIsInitialized(true);
      await loadProjects();
    } catch (err) {
      console.error("Failed to initialize storage:", err);
      setError("Failed to connect to cloud storage");
    }
  };

  const loadProjects = async () => {
    if (!supabaseProjectStorage.isConfigured()) {
      setError("Cloud storage not configured");
      return;
    }

    try {
      setIsLoading(true);
      const allProjects = await supabaseProjectStorage.getAllProjects();
      setProjects(allProjects);
      setError(null);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) return;

    setIsLoading(true);
    try {
      await supabaseProjectStorage.saveProject({
        name: projectName,
        code: currentCode,
        prompt: currentPrompt,
        settings: currentSettings,
      });

      setSaveDialogOpen(false);
      setProjectName("");
      await loadProjects();
    } catch (err) {
      console.error("Failed to save project:", err);
      alert("Failed to save project to cloud");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (project: Project) => {
    onLoadProject(project);
    onClose();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      await supabaseProjectStorage.deleteProject(id);
      await loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project");
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const json = await supabaseProjectStorage.exportProject(id);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export project:", err);
      alert("Failed to export project");
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await supabaseProjectStorage.importProject(text);
        await loadProjects();
      } catch (err) {
        console.error("Failed to import project:", err);
        alert("Failed to import project");
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (!confirm("Delete ALL projects? This cannot be undone.")) return;

    try {
      await supabaseProjectStorage.clearAll();
      await loadProjects();
    } catch (err) {
      console.error("Failed to clear projects:", err);
      alert("Failed to clear projects");
    }
  };

  const isCloudConnected =
    isInitialized && supabaseProjectStorage.isConfigured();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-background-elevated rounded-xl border border-border w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              My Projects
            </h2>
            {isCloudConnected ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <Cloud className="w-3 h-3" />
                <span className="hidden sm:inline">Cloud</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <CloudOff className="w-3 h-3" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-3 sm:px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-border flex-wrap">
          <Button
            onClick={() => setSaveDialogOpen(true)}
            size="sm"
            disabled={!currentCode || !isCloudConnected}
            className="flex-1 sm:flex-none"
          >
            <Save className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Save Current</span>
          </Button>
          <Button
            onClick={handleImport}
            size="sm"
            variant="outline"
            disabled={!isCloudConnected}
          >
            <Upload className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            onClick={handleClearAll}
            size="sm"
            variant="outline"
            disabled={projects.length === 0 || !isCloudConnected}
            className="ml-auto"
          >
            <span className="hidden sm:inline">Clear All</span>
            <Trash2 className="w-4 h-4 sm:hidden" />
          </Button>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-12">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <FolderOpen className="w-12 sm:w-16 h-12 sm:h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm sm:text-base">
                No saved projects yet
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground-dim mt-1">
                Create and save your first project
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="border border-border rounded-lg p-3 sm:p-4 hover:border-muted-foreground/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-foreground line-clamp-1 text-sm sm:text-base">
                      {project.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2 sm:mb-3">
                    {project.prompt || "No description"}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground-dim mb-2 sm:mb-3">
                    <span>
                      {new Date(project.updated_at).toLocaleDateString()}
                    </span>
                    <span>
                      {project.settings.aspectRatio} • {project.settings.fps}fps
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Button
                      onClick={() => handleLoad(project)}
                      size="sm"
                      variant="default"
                      className="flex-1"
                    >
                      <FolderOpen className="w-3 h-3 mr-1" />
                      Load
                    </Button>
                    <Button
                      onClick={() => handleExport(project.id, project.name)}
                      size="sm"
                      variant="outline"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(project.id, project.name)}
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Dialog */}
        {saveDialogOpen && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background-elevated rounded-lg border border-border p-4 sm:p-6 max-w-md w-full mx-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">
                Save Project
              </h3>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary mb-4 text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setSaveDialogOpen(false);
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!projectName.trim() || isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Saving..." : "Save to Cloud"}
                </Button>
                <Button
                  onClick={() => setSaveDialogOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
