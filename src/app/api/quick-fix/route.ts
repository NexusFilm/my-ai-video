import { NextRequest } from "next/server";

interface FixResponse {
  fixedCode: string;
  explanation: string;
  linesChanged: number[];
}

export async function POST(request: NextRequest) {
  try {
    const { code, error } = await request.json();

    if (!code || !error) {
      return Response.json(
        { error: "Missing required fields: code and error" },
        { status: 400 }
      );
    }

    // Parse error to find line number if available
    const lineMatch = error.match(/line\s*(\d+)/i) || error.match(/:(\d+):/);
    const errorLine = lineMatch ? parseInt(lineMatch[1], 10) : null;

    // Extract context around the error (5 lines before and after if line number known)
    const codeLines = code.split('\n');
    let contextStart = 0;
    let contextEnd = codeLines.length;
    
    if (errorLine && errorLine > 0 && errorLine <= codeLines.length) {
      contextStart = Math.max(0, errorLine - 6);
      contextEnd = Math.min(codeLines.length, errorLine + 5);
    }

    const systemPrompt = `You are a surgical code fixer. Your job is to fix ONLY the specific error - do not rewrite the entire code.

CRITICAL RULES:
1. Analyze the error message carefully
2. Identify the EXACT line(s) that need fixing
3. Return ONLY a JSON object with the fix - no explanations outside the JSON
4. Preserve ALL other code exactly as-is
5. Make the MINIMUM change needed to fix the error

RESPONSE FORMAT (strict JSON):
{
  "fixes": [
    {
      "lineNumber": <number>,
      "originalLine": "<exact original line>",
      "fixedLine": "<corrected line>"
    }
  ],
  "explanation": "<brief explanation of what was wrong and how you fixed it>"
}

COMMON ERRORS AND FIXES:
- "Cannot find name X" → Check for typos, missing imports, or undefined variables
- "Unexpected token" → Check for syntax errors, missing brackets, commas
- "Type X is not assignable" → Fix type mismatch or add type assertion
- "Property X does not exist" → Check object shape or add optional chaining

If multiple lines need fixing, include all in the fixes array.
If you cannot determine the exact fix, return: { "fixes": [], "explanation": "Unable to determine fix" }`;

    const userPrompt = `Fix this error in the Remotion animation code:

ERROR: ${error}
${errorLine ? `ERROR LINE: ${errorLine}` : ''}

FULL CODE:
\`\`\`tsx
${codeLines.map((line, i) => `${i + 1}: ${line}`).join('\n')}
\`\`\`

${errorLine ? `
CONTEXT AROUND ERROR (lines ${contextStart + 1}-${contextEnd}):
\`\`\`tsx
${codeLines.slice(contextStart, contextEnd).map((line, i) => `${contextStart + i + 1}: ${line}`).join('\n')}
\`\`\`
` : ''}

Return ONLY a valid JSON object with the fixes.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Use faster/cheaper model for quick fixes
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2, // Low temperature for consistent fixes
        max_tokens: 1000, // Much smaller token limit
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const fixData = JSON.parse(data.choices[0].message.content);

    // Apply the fixes to the code
    if (fixData.fixes && fixData.fixes.length > 0) {
      let fixedLines = [...codeLines];
      const changedLineNumbers: number[] = [];

      for (const fix of fixData.fixes) {
        const lineIndex = fix.lineNumber - 1;
        if (lineIndex >= 0 && lineIndex < fixedLines.length) {
          fixedLines[lineIndex] = fix.fixedLine;
          changedLineNumbers.push(fix.lineNumber);
        }
      }

      const result: FixResponse = {
        fixedCode: fixedLines.join('\n'),
        explanation: fixData.explanation || "Applied automatic fix",
        linesChanged: changedLineNumbers,
      };

      return Response.json(result);
    }

    // If no fixes found, return original code with message
    return Response.json({
      fixedCode: code,
      explanation: fixData.explanation || "No automatic fix available",
      linesChanged: [],
    });

  } catch (error) {
    console.error("Quick fix error:", error);
    return Response.json(
      { error: "Failed to apply quick fix" },
      { status: 500 }
    );
  }
}
