import { NextRequest } from "next/server";
import { getSystemPromptWithBestPractices } from "@/lib/remotion-best-practices";

const SYSTEM_PROMPT = getSystemPromptWithBestPractices(`
You are an expert Remotion developer. Generate clean, working React/TypeScript code for motion graphics animations.

Output ONLY the component code, no explanations. The code should:
1. Be a complete, working Remotion component
2. Use proper TypeScript types
3. Include all necessary imports
4. Be visually appealing and professional
`);

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = "gemini-1.5-flash" } = await request.json();

    if (!prompt) {
      return Response.json({ error: "No prompt provided" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${SYSTEM_PROMPT}\n\nCreate this animation: ${prompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

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
          
          // Parse Gemini's response format
          try {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (line.trim()) {
                const parsed = JSON.parse(line);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: text })}\n\n`)
                  );
                }
              }
            }
            buffer = "";
          } catch {
            // Keep accumulating if JSON is incomplete
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
    console.error("Gemini generation error:", error);
    return Response.json(
      { error: "Failed to generate with Gemini" },
      { status: 500 }
    );
  }
}
