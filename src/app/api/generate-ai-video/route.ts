import { NextRequest, NextResponse } from "next/server";

/**
 * Generate AI video using Runway Gen-3 or similar service
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

    // Check if Runway API key is configured
    if (!process.env.RUNWAY_API_KEY) {
      return NextResponse.json(
        { 
          error: "AI video generation not configured",
          message: "Add RUNWAY_API_KEY to environment variables to enable AI video generation"
        },
        { status: 503 }
      );
    }

    // Generate video using Runway Gen-3 API
    // https://docs.runwayml.com/reference/post_v1_gen3-alpha-turbo
    const response = await fetch("https://api.runwayml.com/v1/gen3/turbo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RUNWAY_API_KEY}`,
      },
      body: JSON.stringify({
        prompt_text: prompt,
        duration: Math.min(duration, 10), // Max 10 seconds
        ...(imageUrl && { prompt_image: imageUrl }), // Optional: image-to-video
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Runway API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Runway returns a task ID - need to poll for completion
    const taskId = data.id;
    
    // Poll for completion (with timeout)
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (!videoUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          "Authorization": `Bearer ${process.env.RUNWAY_API_KEY}`,
        },
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        if (statusData.status === "SUCCEEDED") {
          videoUrl = statusData.output?.[0];
        } else if (statusData.status === "FAILED") {
          throw new Error("Video generation failed");
        }
      }
      
      attempts++;
    }
    
    if (!videoUrl) {
      throw new Error("Video generation timed out");
    }

    return NextResponse.json({
      videoUrl,
      duration: data.duration || duration,
      prompt,
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
