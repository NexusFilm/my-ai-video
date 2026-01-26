import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { NextResponse } from "next/server";
import { RenderRequest } from "../../../../types/schema";
import { executeApi } from "../../../helpers/api-response";
import path from "path";
import os from "os";
import fs from "fs/promises";

export const POST = executeApi<{ url: string }, typeof RenderRequest>(
  RenderRequest,
  async (req, body) => {
    try {
      // Bundle the Remotion project
      const bundleLocation = await bundle({
        entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
        webpackOverride: (config) => config,
      });

      // Get composition
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "DynamicComp",
        inputProps: body.inputProps,
      });

      // Create temp output file
      const outputLocation = path.join(
        os.tmpdir(),
        `remotion-${Date.now()}.mp4`
      );

      // Render the video
      await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation,
        inputProps: body.inputProps,
      });

      // Read the file and convert to base64 or upload to storage
      const videoBuffer = await fs.readFile(outputLocation);
      const base64Video = videoBuffer.toString("base64");

      // Clean up
      await fs.unlink(outputLocation);

      // Return data URL (for small videos) or upload to S3/storage
      return {
        url: `data:video/mp4;base64,${base64Video}`,
      };
    } catch (error) {
      throw new Error(
        `Rendering failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);
