import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query, perPage = 5 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "No search query provided" },
        { status: 400 }
      );
    }

    if (!process.env.PEXELS_API_KEY) {
      return NextResponse.json(
        { error: "Pexels API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      {
        headers: {
          Authorization: process.env.PEXELS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Return simplified image data
    const images = data.photos.map((photo: any) => ({
      id: photo.id,
      url: photo.src.large,
      thumbnail: photo.src.medium,
      photographer: photo.photographer,
      alt: photo.alt || query,
    }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Pexels search error:", error);
    return NextResponse.json(
      { error: "Failed to search Pexels" },
      { status: 500 }
    );
  }
}
