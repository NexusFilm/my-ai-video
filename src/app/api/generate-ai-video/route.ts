import { NextRequest, NextResponse } from "next/server";

/**
 * Generate AI video using Google Veo 3 (Vertex AI)
 * This is called when the system determines AI video is needed
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, duration = 5, imageUrl } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "No prompt provided" },
        { status: 400 }
      );
    }

    // Check if Google API key is configured
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { 
          error: "AI video generation not configured",
          message: "Add GOOGLE_GENERATIVE_AI_API_KEY to environment variables to enable AI video generation"
        },
        { status: 503 }
      );
    }

    // Use Google Imagen 3 for video generation (Veo 3)
    // https://cloud.google.com/vertex-ai/generative-ai/docs/video/generate-video
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-001:generateVideo?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: {
            text: prompt,
            ...(imageUrl && { image: { url: imageUrl } }), // Optional: image-to-video
          },
          videoConfig: {
            duration: Math.min(duration, 8), // Max 8 seconds for Veo
            aspectRatio: "16:9",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Google Veo API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Google returns video data directly or as a generation task
    let videoUrl = null;
    
    if (data.video?.uri) {
      videoUrl = data.video.uri;
    } else if (data.generationId) {
      // Poll for completion if it's async
      const generationId = data.generationId;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (!videoUrl && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/operations/${generationId}?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`
        );
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.done) {
            if (statusData.response?.video?.uri) {
              videoUrl = statusData.response.video.uri;
            } else if (statusData.error) {
              throw new Error(statusData.error.message || "Video generation failed");
            }
          }
        }
        
        attempts++;
      }
      
      if (!videoUrl) {
        throw new Error("Video generation timed out");
      }
    }

    return NextResponse.json({
      videoUrl,
      duration: data.duration || duration,
      prompt,
      provider: "google-veo",
    });
  } catch (error) {
    console.error("AI video generation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate AI video",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
