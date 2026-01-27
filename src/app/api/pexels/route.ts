import { NextRequest, NextResponse } from "next/server";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const type = searchParams.get("type") || "photos"; // photos or videos
  const perPage = searchParams.get("perPage") || "5";
  const orientation = searchParams.get("orientation") || "landscape";

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter required" },
      { status: 400 },
    );
  }

  if (!PEXELS_API_KEY) {
    return NextResponse.json(
      { error: "Pexels API not configured", configured: false },
      { status: 503 },
    );
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: perPage,
      orientation,
    });

    const endpoint =
      type === "videos"
        ? `https://api.pexels.com/videos/search?${params}`
        : `https://api.pexels.com/v1/search?${params}`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();

    // Return simplified data
    if (type === "videos") {
      const videos = (data.videos || []).map((v: any) => ({
        id: v.id,
        url: v.url,
        image: v.image,
        duration: v.duration,
        width: v.width,
        height: v.height,
        videoUrl:
          v.video_files?.find((f: any) => f.quality === "hd")?.link ||
          v.video_files?.[0]?.link,
      }));
      return NextResponse.json({ videos, total: data.total_results });
    } else {
      const photos = (data.photos || []).map((p: any) => ({
        id: p.id,
        url: p.url,
        photographer: p.photographer,
        src: p.src.large,
        srcMedium: p.src.medium,
        alt: p.alt,
      }));
      return NextResponse.json({ photos, total: data.total_results });
    }
  } catch (error) {
    console.error("Pexels search error:", error);
    return NextResponse.json(
      { error: "Failed to search Pexels" },
      { status: 500 },
    );
  }
}
