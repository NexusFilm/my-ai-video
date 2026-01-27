import { NextRequest } from "next/server";
import { cacheImage } from "@/lib/image-cache";

export async function POST(request: NextRequest) {
  try {
    const { imageData, name } = await request.json();

    if (!imageData || !name) {
      return Response.json(
        { error: "Missing required fields: imageData and name" },
        { status: 400 }
      );
    }

    // Cache the image server-side and get an ID
    const imageId = cacheImage(imageData, name);

    return Response.json({
      imageId,
      cached: true,
      message: `Image "${name}" cached with ID: ${imageId}`,
    });
  } catch (err) {
    console.error("Error caching image:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to cache image" },
      { status: 500 }
    );
  }
}
