import { NextRequest, NextResponse } from "next/server";
import { REMOTION_CONSTRAINTS } from "@/lib/remotion-constraints";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    const { prompt, previousPrompts } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "No prompt provided" },
        { status: 400 }
      );
    }

    // Build context from user's previous prompts to learn their style
    const styleContext = previousPrompts?.length > 0
      ? `\n\nUser's previous prompts (learn their style):\n${previousPrompts.slice(-5).join('\n')}`
      : '';

    const systemPrompt = `You are a prompt enhancement assistant for motion graphics generation.

Your job is to take a user's rough prompt and enhance it with:
- Specific animation details (timing, easing, transitions)
- Visual details (colors, sizes, positions)
- Motion graphics best practices
- Clear, actionable descriptions

CRITICAL: The final prompt MUST be achievable in Remotion.
${REMOTION_CONSTRAINTS}

Keep the user's core intent but make it more detailed and specific for better AI generation.
${styleContext}

Return ONLY the enhanced prompt text (no JSON, no markdown), nothing else.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Enhance this prompt: ${prompt}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const enhancedPrompt = data.choices[0].message.content.trim();

    return NextResponse.json({ enhancedPrompt });
  } catch (error) {
    console.error("Prompt enhancement error:", error);
    return NextResponse.json(
      { error: "Failed to enhance prompt" },
      { status: 500 }
    );
  }
}
