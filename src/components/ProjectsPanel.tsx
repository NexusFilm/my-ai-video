"use client";

import { useState, useEffect } from "react";
import { Save, FolderOpen, Trash2, Download, Upload, X } from "lucide-react";
import { Button } from "./ui/button";
import { projectStorage, type Project, formatBytes } from "@/lib/project-storage";

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
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0 });
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProjects();
    loadStorageInfo();
  }, []);

  const loadProjects = async () => {
    try {
      const allProjects = await projectStorage.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await projectStorage.getStorageSize();
      setStorageInfo(info);
    } catch (error) {
      console.error("Failed to load storage info:", error);
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) return;
    
    setIsLoading(true);
    try {
      await projectStorage.saveProject({
        name: projectName,
        code: currentCode,
        prompt: currentPrompt,
        settings: currentSettings,
      });
      
      setSaveDialogOpen(false);
      setProjectName("");
      await loadProjects();
      await loadStorageInfo();
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Failed to save project");
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
      await projectStorage.deleteProject(id);
      await loadProjects();
      await loadStorageInfo();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project");
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const json = await projectStorage.exportProject(id);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, "_")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export project:", error);
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
        await projectStorage.importProject(text);
        await loadProjects();
        await loadStorageInfo();
      } catch (error) {
        console.error("Failed to import project:", error);
        alert("Failed to import project");
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (!confirm("Delete ALL projects? This cannot be undone.")) return;
    
    try {
      await projectStorage.clearAll();
      await loadProjects();
      await loadStorageInfo();
    } catch (error) {
      console.error("Failed to clear projects:", error);
      alert("Failed to clear projects");
    }
  };

  const storagePercent = storageInfo.available > 0 
    ? (storageInfo.used / storageInfo.available) * 100 
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background-elevated rounded-xl border border-border max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">My Projects</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Info */}
        <div className="px-4 py-3 bg-background border-b border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Storage Used: {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.available)}</span>
            <span>{storagePercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-b border-border flex-wrap">
          <Button
            onClick={() => setSaveDialogOpen(true)}
            size="sm"
            disabled={!currentCode}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Current
          </Button>
          <Button onClick={handleImport} size="sm" variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button 
            onClick={handleClearAll} 
            size="sm" 
            variant="outline"
            disabled={projects.length === 0}
            className="ml-auto"
          >
            Clear All
          </Button>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-4">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No saved projects yet</p>
              <p className="text-sm text-muted-foreground-dim mt-1">
                Create and save your first project to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="border border-border rounded-lg p-4 hover:border-muted-foreground/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-foreground line-clamp-1">
                      {project.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {project.prompt || "No description"}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground-dim mb-3">
                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    <span>{project.settings.aspectRatio} • {project.settings.fps}fps</span>
                  </div>
                  <div className="flex items-center gap-2">
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
            <div className="bg-background-elevated rounded-lg border border-border p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-foreground mb-4">Save Project</h3>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name..."
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary mb-4"
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
                  {isLoading ? "Saving..." : "Save"}
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
