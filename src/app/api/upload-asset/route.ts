import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG allowed.",
        },
        { status: 400 },
      );
    }

    // Debug: Log environment variable status
    console.log("🔍 Supabase config check:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "NOT SET",
    });

    // If Supabase is configured, upload there and return public URL
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `images/${timestamp}-${randomStr}-${safeFilename}`;

        // Upload to Supabase Storage
        const bytes = await file.arrayBuffer();
        const { data, error } = await supabase.storage
          .from("ai-video-assets")
          .upload(path, bytes, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (error) {
          console.error("Supabase upload error:", error);
          throw error;
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from("ai-video-assets")
          .getPublicUrl(data.path);

        console.log(
          `✓ Uploaded to Supabase: ${file.name} → ${urlData.publicUrl}`,
        );

        return NextResponse.json({
          url: urlData.publicUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          storage: "supabase",
        });
      } catch (supabaseError) {
        console.error(
          "Supabase upload failed, falling back to data URL:",
          supabaseError,
        );
        // Fall through to data URL fallback
      }
    }

    // Fallback: Convert to data URL (if Supabase not configured or upload failed)
    console.log(`⚠️ Supabase not configured, using data URL for: ${file.name}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      storage: "data-url",
    });
  } catch (error) {
    console.error("Asset upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload asset" },
      { status: 500 },
    );
  }
}
