import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-based project storage system
 * Stores projects in Supabase database with cloud sync
 */

export interface Project {
  id: string;
  name: string;
  code: string;
  prompt: string;
  created_at: string;
  updated_at: string;
  thumbnail?: string;
  settings: {
    durationInFrames: number;
    fps: number;
    aspectRatio: "16:9" | "9:16";
    motionBlur: number;
    selectedPresets?: string[];
  };
  // For anonymous users, we use a device ID
  device_id: string;
}

// Get or create a device ID for anonymous users
function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem("device_id", deviceId);
  }
  return deviceId;
}

class SupabaseProjectStorage {
  private supabase: SupabaseClient | null = null;
  private deviceId: string = "";

  async init(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase not configured - projects will not be saved");
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.deviceId = getDeviceId();
  }

  private ensureClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error("Supabase not initialized. Call init() first.");
    }
    return this.supabase;
  }

  async saveProject(
    project: Omit<Project, "id" | "created_at" | "updated_at" | "device_id"> & {
      id?: string;
    },
  ): Promise<string> {
    const supabase = this.ensureClient();
    const now = new Date().toISOString();

    const projectData = {
      ...project,
      id:
        project.id ||
        `project_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      device_id: this.deviceId,
      updated_at: now,
      ...(project.id ? {} : { created_at: now }),
    };

    const { data, error } = await supabase
      .from("projects")
      .upsert(projectData, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Failed to save project:", error);
      throw new Error(`Failed to save project: ${error.message}`);
    }

    return data.id;
  }

  async getProject(id: string): Promise<Project | null> {
    const supabase = this.ensureClient();

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("device_id", this.deviceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      console.error("Failed to get project:", error);
      throw error;
    }

    return data;
  }

  async getAllProjects(): Promise<Project[]> {
    const supabase = this.ensureClient();

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("device_id", this.deviceId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Failed to get projects:", error);
      throw error;
    }

    return data || [];
  }

  async deleteProject(id: string): Promise<void> {
    const supabase = this.ensureClient();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("device_id", this.deviceId);

    if (error) {
      console.error("Failed to delete project:", error);
      throw error;
    }
  }

  async exportProject(id: string): Promise<string> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error("Project not found");
    }
    return JSON.stringify(project, null, 2);
  }

  async importProject(jsonString: string): Promise<string> {
    try {
      const project = JSON.parse(jsonString) as Project;
      // Generate new ID to avoid conflicts
      const newId = `project_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return await this.saveProject({ ...project, id: newId });
    } catch {
      throw new Error("Invalid project file");
    }
  }

  async clearAll(): Promise<void> {
    const supabase = this.ensureClient();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("device_id", this.deviceId);

    if (error) {
      console.error("Failed to clear projects:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.supabase !== null;
  }
}

// Singleton instance
export const supabaseProjectStorage = new SupabaseProjectStorage();

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
