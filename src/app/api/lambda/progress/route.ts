import { ProgressResponse, ProgressRequest } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";
import path from "path";
import fs from "fs/promises";

export const POST = executeApi<ProgressResponse, typeof ProgressRequest>(
  ProgressRequest,
  async (req, body) => {
    // For local rendering, check if the file exists
    const filePath = path.join(process.cwd(), "public", body.id);
    
    try {
      const stats = await fs.stat(filePath);
      
      // File exists, rendering is done
      return {
        type: "done",
        url: `/${body.id}`,
        size: stats.size,
      };
    } catch (error) {
      // File doesn't exist yet, still rendering
      return {
        type: "progress",
        progress: 0.5, // Simple progress indicator for local rendering
      };
    }
  },
);
