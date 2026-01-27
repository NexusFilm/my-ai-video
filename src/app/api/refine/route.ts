import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { currentCode, refinementPrompt, previousPrompts } = await request.json();

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
        model: "gpt-4o",
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
