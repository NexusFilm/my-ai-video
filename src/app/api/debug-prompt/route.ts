import { NextRequest } from "next/server";
import { getLastPrompt } from "@/lib/prompt-debug";

export async function GET(request: NextRequest) {
  const prompt = getLastPrompt();
  
  return Response.json({
    prompt: prompt.substring(0, 5000), // First 5000 chars
    length: prompt.length,
    hasAssetData: prompt.includes("## ASSET DATA"),
    hasDataUrl: prompt.includes("data:image"),
    tail: prompt.substring(Math.max(0, prompt.length - 2000)), // Last 2000 chars
  });
}
