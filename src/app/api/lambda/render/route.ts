import { RenderRequest } from "../../../../../types/schema";
import { executeApi } from "../../../../helpers/api-response";

type LocalRenderOutput = {
  renderId: string;
  bucketName: string;
  url: string;
};

export const POST = executeApi<LocalRenderOutput, typeof RenderRequest>(
  RenderRequest,
  async (req, body) => {
    // For local rendering, return a message that rendering must be done via CLI
    // This avoids complex server-side bundling issues
    throw new Error(
      "Local rendering is not available in the web UI. To render videos:\n\n" +
      "1. Copy the generated code from the preview\n" +
      "2. Save it to your Remotion project\n" +
      "3. Run: npx remotion render\n\n" +
      "Or use the browser's download feature to save the preview as a video."
    );
  },
);
