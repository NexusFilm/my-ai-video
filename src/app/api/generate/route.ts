import { streamText, generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import {
  getCombinedSkillContent,
  SKILL_DETECTION_PROMPT,
  SKILL_NAMES,
  type SkillName,
} from "@/skills";
import { getEnhancedSystemPrompt } from "@/lib/nexus-flavor";
import { analyzeAIVideoNeed, getHybridSystemPrompt } from "@/lib/ai-video-hybrid";
import { checkRateLimit } from "@/lib/rate-limiter";
import { trackTokenUsage, estimateTokens } from "@/lib/token-tracker";

const VALIDATION_PROMPT = `You are a prompt classifier for a motion graphics generation tool.

Determine if the user's prompt is asking for motion graphics/animation content that can be created as a React/Remotion component.

VALID prompts include requests for:
- Animated text, titles, or typography
- Data visualizations (charts, graphs, progress bars)
- UI animations (buttons, cards, transitions)
- Logo animations or brand intros
- Social media content (stories, reels, posts)
- Explainer animations
- Kinetic typography
- Abstract motion graphics
- Animated illustrations
- Product showcases
- Countdown timers
- Loading animations
- Any visual/animated content

INVALID prompts include:
- Questions (e.g., "What is 2+2?", "How do I...")
- Requests for text/written content (poems, essays, stories, code explanations)
- Conversations or chat
- Non-visual tasks (calculations, translations, summaries)
- Requests completely unrelated to visual content

Return true if the prompt is valid for motion graphics generation, false otherwise.`;

const SYSTEM_PROMPT = `
You are an expert in generating React components for Remotion animations.

## COMPONENT STRUCTURE

1. Start with ES6 imports
2. Export as: export const MyAnimation = () => { ... };
3. Component body order:
   - Multi-line comment description (2-3 sentences)
   - Hooks (useCurrentFrame, useVideoConfig, etc.)
   - Constants (COLORS, TEXT, TIMING, LAYOUT) - all UPPER_SNAKE_CASE
   - Calculations and derived values
   - return JSX

## CONSTANTS RULES (CRITICAL)

ALL constants MUST be defined INSIDE the component body, AFTER hooks:
- Colors: const COLOR_TEXT = "#000000";
- Text: const TITLE_TEXT = "Hello World";
- Timing: const FADE_DURATION = 20;
- Layout: const PADDING = 40;

This allows users to easily customize the animation.

## LAYOUT RULES

- Use full width of container with appropriate padding
- Never constrain content to a small centered box
- Use Math.max(minValue, Math.round(width * percentage)) for responsive sizing
- RESPECT ASPECT RATIO: If the prompt mentions format (16:9 or 9:16), design accordingly
  - 16:9 (1920x1080): Landscape, horizontal layouts work well
  - 9:16 (1080x1920): Portrait, vertical stacking, mobile-first design

## PHYSICS & BOUNDARIES (CRITICAL)

When animating objects with physics (bouncing, falling, moving):
- ALWAYS respect canvas boundaries (0, 0, width, height)
- Bouncing balls should bounce off floor (height) and walls (0, width)
- Falling objects should stop at the bottom (height)
- Use realistic physics: gravity, velocity, acceleration
- Example bounce: if (y + radius > height) { velocity *= -0.8; y = height - radius; }

## ANIMATION RULES

- Prefer spring() for organic motion (entrances, bounces, scaling)
- Use interpolate() for linear progress (progress bars, opacity fades)
- Always use { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
- Add stagger delays for multiple elements
- For physics simulations, calculate position frame-by-frame

## AVAILABLE IMPORTS

\`\`\`tsx
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Sequence } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Circle, Rect, Triangle, Star, Ellipse, Pie } from "@remotion/shapes";
import { ThreeCanvas } from "@remotion/three";
import { useState, useEffect } from "react";
\`\`\`

## USING ASSETS & IMAGES (CRITICAL)

If you receive asset images in the prompt (between "## ASSET DATA" and output):
1. Data URLs are provided in format: ASSET: filename.png\nDATA_URL: data:image/png;base64,...
2. Extract the DATA_URL value and use it directly in your code
3. Create constants for your assets at the top of the component: \`const LOGO = "data:image/png;base64,...";\`
4. Display assets using: \`<img src={LOGO} style={getAssetStyle("contain")} />\`
5. You MUST actively incorporate them - do not ignore assets provided
6. Place them in meaningful positions within your animation layout
7. Animate them if appropriate (fade in, scale, move with transitions)
8. Use Sequence with timing to control when assets appear
9. Use helpers: AssetHelper.isDataUrl(src), AssetHelper.isImage(src), getAssetStyle("cover"|"contain")

EXAMPLE:
\`\`\`tsx
const LOGO = "data:image/png;base64,iVBORw0KGgoA...";
const BACKGROUND = "data:image/jpg;base64,/9j/4AA...";

return (
  <AbsoluteFill style={{ backgroundColor: "#fff" }}>
    <Sequence from={0} durationInFrames={30}>
      <img src={LOGO} style={{ ...getAssetStyle("contain"), opacity: interpolate(frame, [0, 20], [0, 1]) }} />
    </Sequence>
    <img src={BACKGROUND} style={{ ...getAssetStyle("cover"), position: "absolute", top: 0, left: 0 }} />
  </AbsoluteFill>
);
\`\`\`

ASSETS ARE NOT OPTIONAL - If the user uploaded images, they must appear in the final animation.

## RESERVED NAMES (CRITICAL)

NEVER use these as variable names - they shadow imports:
- spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence

## STYLING RULES

- Use inline styles only
- ALWAYS use fontFamily: 'Inter, sans-serif'
- Keep colors minimal (2-4 max)
- ALWAYS set backgroundColor on AbsoluteFill from frame 0 - never fade in backgrounds

## OUTPUT FORMAT (CRITICAL)

- Output ONLY code - no explanations, no questions
- Response must start with "import" and end with "};"
- If prompt is ambiguous, make a reasonable choice - do not ask for clarification

`;

export async function POST(req: Request) {
  const { prompt, model = "gpt-5-mini" } = await req.json();

  // Rate limit check
  const clientId = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
  const rateLimit = checkRateLimit(`generate:${clientId}`);
  
  if (!rateLimit.allowed) {
    console.log(`Rate limit hit for generate: ${rateLimit.reason}`);
    return new Response(
      JSON.stringify({ error: rateLimit.reason || "Rate limit exceeded", rateLimited: true }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  // Track estimated token usage (input tokens now, output estimated as ~2x input for code gen)
  const estimatedInputTokens = estimateTokens(prompt) + 2000; // +2000 for system prompt
  const estimatedOutputTokens = 1500; // Average code output
  const tokenUsage = trackTokenUsage(clientId, estimatedInputTokens, estimatedOutputTokens);
  
  if (tokenUsage.warning) {
    console.log(`Token usage warning for ${clientId}: ${tokenUsage.warning}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          'The environment variable "OPENAI_API_KEY" is not set. Add it to your .env file and try again.',
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Parse model ID - format can be "model-name" or "model-name:reasoning_effort"
  const [modelName, reasoningEffort] = model.split(":");

  const openai = createOpenAI({ apiKey });

  // Validate the prompt first
  try {
    const validationResult = await generateObject({
      model: openai("gpt-5.2"),
      system: VALIDATION_PROMPT,
      prompt: `User prompt: "${prompt}"`,
      schema: z.object({ valid: z.boolean() }),
    });

    if (!validationResult.object.valid) {
      return new Response(
        JSON.stringify({
          error:
            "No valid motion graphics prompt. Please describe an animation or visual content you'd like to create.",
          type: "validation",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch (validationError) {
    // On validation error, allow through rather than blocking
    console.error("Validation error:", validationError);
  }

  // Detect which skills apply to this prompt
  let detectedSkills: SkillName[] = [];
  try {
    const skillResult = await generateObject({
      model: openai("gpt-5.2"),
      system: SKILL_DETECTION_PROMPT,
      prompt: `User prompt: "${prompt}"`,
      schema: z.object({
        skills: z.array(z.enum(SKILL_NAMES)),
      }),
    });
    detectedSkills = skillResult.object.skills;
    console.log("Detected skills:", detectedSkills);
  } catch (skillError) {
    console.error("Skill detection error:", skillError);
  }

  // Load skill-specific content and enhance the system prompt
  const skillContent = getCombinedSkillContent(detectedSkills);
  let enhancedSystemPrompt = skillContent
    ? `${SYSTEM_PROMPT}\n\n## SKILL-SPECIFIC GUIDANCE\n${skillContent}`
    : SYSTEM_PROMPT;
  
  // Analyze if AI video generation is needed
  const aiVideoAnalysis = await analyzeAIVideoNeed(prompt);
  console.log("AI Video Analysis:", aiVideoAnalysis);
  
  // Apply hybrid system if AI video is needed
  if (aiVideoAnalysis.needed) {
    enhancedSystemPrompt = getHybridSystemPrompt(enhancedSystemPrompt, true);
    console.log("AI video will be used for:", aiVideoAnalysis.elements.map(e => e.description).join(", "));
  }
  
  // Apply Nexus Flavor enhancements
  enhancedSystemPrompt = getEnhancedSystemPrompt(enhancedSystemPrompt);

  try {
    const result = streamText({
      model: openai(modelName),
      system: enhancedSystemPrompt,
      prompt,
      ...(reasoningEffort && {
        providerOptions: {
          openai: {
            reasoningEffort: reasoningEffort,
          },
        },
      }),
    });

    console.log(
      "Generating React component with prompt:",
      prompt,
      "model:",
      modelName,
      "skills:",
      detectedSkills.length > 0 ? detectedSkills.join(", ") : "general",
      reasoningEffort ? `reasoning_effort: ${reasoningEffort}` : "",
    );

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    console.error("Error generating code:", error);
    return new Response(
      JSON.stringify({
        error: "Something went wrong while trying to reach OpenAI APIs.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
