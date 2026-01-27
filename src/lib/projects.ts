// Project management for saved videos
export interface ProjectVersion {
  id: string;
  code: string;
  prompt: string;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  versions: ProjectVersion[];
  currentVersionIndex: number;
  createdAt: number;
  updatedAt: number;
}

const PROJECTS_KEY = "remotion_projects";

export const generateId = () => Math.random().toString(36).substring(2, 15);

export const getProjects = (): Project[] => {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(PROJECTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveProjects = (projects: Project[]) => {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
};

export const createProject = (name: string, code: string, prompt: string): Project => {
  const project: Project = {
    id: generateId(),
    name,
    versions: [{
      id: generateId(),
      code,
      prompt,
      timestamp: Date.now(),
    }],
    currentVersionIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  const projects = getProjects();
  projects.unshift(project);
  saveProjects(projects);
  return project;
};

export const addVersionToProject = (projectId: string, code: string, prompt: string): Project | null => {
  const projects = getProjects();
  const projectIndex = projects.findIndex(p => p.id === projectId);
  
  if (projectIndex === -1) return null;
  
  const newVersion: ProjectVersion = {
    id: generateId(),
    code,
    prompt,
    timestamp: Date.now(),
  };
  
  projects[projectIndex].versions.push(newVersion);
  projects[projectIndex].currentVersionIndex = projects[projectIndex].versions.length - 1;
  projects[projectIndex].updatedAt = Date.now();
  
  saveProjects(projects);
  return projects[projectIndex];
};

export const getProject = (projectId: string): Project | null => {
  const projects = getProjects();
  return projects.find(p => p.id === projectId) || null;
};

export const deleteProject = (projectId: string) => {
  const projects = getProjects().filter(p => p.id !== projectId);
  saveProjects(projects);
};

export const updateProjectName = (projectId: string, name: string) => {
  const projects = getProjects();
  const project = projects.find(p => p.id === projectId);
  if (project) {
    project.name = name;
    project.updatedAt = Date.now();
    saveProjects(projects);
  }
};
