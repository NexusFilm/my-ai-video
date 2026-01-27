import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Store assets in-memory (for Vercel serverless, alternatives: Supabase, S3, etc.)
const assetStore = new Map<string, { data: Buffer; type: string; name: string }>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG allowed." },
        { status: 400 }
      );
    }

    // Convert file to buffer and generate ID
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const assetId = crypto.randomBytes(16).toString('hex');
    
    // Store in memory map
    assetStore.set(assetId, {
      data: buffer,
      type: file.type,
      name: file.name,
    });

    // Return a proper HTTP URL that can be accessed from anywhere
    const assetUrl = `/api/assets/${assetId}`;

    return NextResponse.json({
      url: assetUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Asset upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload asset" },
      { status: 500 }
    );
  }
}

// GET endpoint to serve stored assets
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const assetId = pathParts[pathParts.length - 1];

  const asset = assetStore.get(assetId);
  if (!asset) {
    return NextResponse.json(
      { error: "Asset not found" },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.type,
      'Content-Length': asset.data.length.toString(),
      'Cache-Control': 'public, max-age=86400', // 24 hour cache
    },
  });
}
