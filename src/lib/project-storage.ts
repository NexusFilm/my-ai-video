/**
 * IndexedDB-based project storage system
 * Stores projects locally in the browser with support for export/import
 */

export interface Project {
  id: string;
  name: string;
  code: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string; // base64 encoded thumbnail
  settings: {
    durationInFrames: number;
    fps: number;
    aspectRatio: "16:9" | "9:16";
    motionBlur: number;
    selectedPresets?: string[];
  };
}

const DB_NAME = "remotion-projects";
const DB_VERSION = 1;
const STORE_NAME = "projects";

class ProjectStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("name", "name", { unique: false });
        }
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  async saveProject(project: Omit<Project, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
    const db = await this.ensureDb();
    const now = Date.now();
    
    const fullProject: Project = {
      ...project,
      id: project.id || `project_${now}_${Math.random().toString(36).substring(7)}`,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      // If updating existing project, preserve createdAt
      if (project.id) {
        const getRequest = store.get(project.id);
        getRequest.onsuccess = () => {
          const existing = getRequest.result as Project | undefined;
          if (existing) {
            fullProject.createdAt = existing.createdAt;
          }
          
          const putRequest = store.put(fullProject);
          putRequest.onsuccess = () => resolve(fullProject.id);
          putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
      } else {
        const addRequest = store.add(fullProject);
        addRequest.onsuccess = () => resolve(fullProject.id);
        addRequest.onerror = () => reject(addRequest.error);
      }
    });
  }

  async getProject(id: string): Promise<Project | null> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProjects(): Promise<Project[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("updatedAt");
      const request = index.openCursor(null, "prev"); // Most recent first
      
      const projects: Project[] = [];
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          projects.push(cursor.value);
          cursor.continue();
        } else {
          resolve(projects);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize(): Promise<{ used: number; available: number }> {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0,
      };
    }
    return { used: 0, available: 0 };
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
    } catch (error) {
      throw new Error("Invalid project file");
    }
  }

  async clearAll(): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const projectStorage = new ProjectStorage();

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
