import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, userDescription } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert motion graphics designer analyzing reference images.
Your job is to extract key visual elements, style, composition, and animation ideas from the image.

Focus on:
- Color palette (specific hex codes if possible)
- Typography style (font weight, spacing, hierarchy)
- Layout and composition (positioning, alignment, spacing)
- Visual style (modern, retro, minimal, bold, etc.)
- Motion suggestions (how elements should animate)
- Lighting and atmosphere
- Any text or key elements visible

Return a detailed description that will help generate a similar animation in Remotion.`;

    const userPrompt = userDescription
      ? `Analyze this reference image. User notes: "${userDescription}"\n\nProvide detailed visual analysis for motion graphics generation.`
      : "Analyze this reference image and provide detailed visual analysis for motion graphics generation.";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Reference analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze reference image" },
      { status: 500 }
    );
  }
}
