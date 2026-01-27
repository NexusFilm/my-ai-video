import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";
import { trackTokenUsage, estimateTokens } from "@/lib/token-tracker";

export async function POST(request: NextRequest) {
  try {
    // Emergency kill switch to stop all outbound AI calls
    if (process.env.API_DISABLED === "true") {
      return Response.json(
        { error: "API temporarily disabled", rateLimited: true },
        { status: 503 }
      );
    }

    // Rate limit check
    const clientId = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";
    const rateLimit = checkRateLimit(`refine:${clientId}`);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit hit for refine: ${rateLimit.reason}`);
      return Response.json(
        { error: rateLimit.reason || "Rate limit exceeded", rateLimited: true },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
      );
    }
    
    const { currentCode, refinementPrompt, previousPrompts } = await request.json();

    // Track token usage for refine
    const inputTokens = estimateTokens(currentCode) + estimateTokens(refinementPrompt) + 1500; // +1500 for system prompt
    const outputTokens = estimateTokens(currentCode); // Output is usually similar size to input code
    const tokenUsage = trackTokenUsage(clientId, inputTokens, outputTokens);
    if (tokenUsage.warning) {
      console.log(`Token usage warning: ${tokenUsage.warning}`);
    }

    if (!currentCode || !refinementPrompt) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build style context
    const styleContext = previousPrompts?.length > 0
      ? `\n\nUser's style preferences from previous prompts:\n${previousPrompts.slice(-5).join('\n')}`
      : '';

    const systemPrompt = `You are a Remotion motion graphics code refiner. You have existing code and need to modify it based on user feedback.

RULES:
1. Keep the existing structure and working parts
2. Only modify what the user asks to change
3. Maintain all imports and exports
4. Keep the component name the same
5. Return ONLY the complete modified code, no explanations
6. Use Remotion best practices (useCurrentFrame, interpolate, spring, etc.)
7. If the refinement mentions assets or images, preserve their usage in the code
8. If new assets are provided, incorporate them into the animation

ASSET HANDLING:
- Assets are provided as data URLs (e.g., "data:image/...")
- Create constants: const ASSET_NAME = "data:image/..."
- Display with: <img src={ASSET_NAME} style={getAssetStyle("contain")} />
- Use helpers: AssetHelper.isDataUrl(src), getAssetStyle("cover"|"contain")
- When refining to use new assets, ensure they're positioned and animated appropriately

${styleContext}

CURRENT CODE:
\`\`\`tsx
${currentCode}
\`\`\`

The user wants to refine this code. Make the requested changes while keeping everything else intact.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: refinementPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: content })}\n\n`));
              }
            } catch {}
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Refinement error:", error);
    return Response.json(
      { error: "Failed to refine code" },
      { status: 500 }
    );
  }
}
