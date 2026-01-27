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
import { setLastPrompt } from "@/lib/prompt-debug";

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
You are an expert in generating React components for Remotion animations. You have comprehensive knowledge of Remotion's capabilities including transforms, transitions, fonts, physics, randomness, noise, mapping, and advanced animation math.

## COMPONENT STRUCTURE

1. Start with ES6 imports
2. Export as: export const MyAnimation = () => { ... };
3. Component body order:
   - Multi-line comment description (2-3 sentences)
   - Hooks (useCurrentFrame, useVideoConfig, etc.)
   - Constants (COLORS, TEXT, TIMING, LAYOUT) - all UPPER_SNAKE_CASE
   - Calculations and derived values
   - return JSX

## TRANSFORMS (CSS-based property animations)

**5 Basic Transforms:**
- **Opacity**: 0 (invisible) to 1 (visible), semi-transparent in between
  \`\`\`jsx
  <div style={{ opacity: interpolate(frame, [0, 30], [0, 1]) }} />
  \`\`\`
- **Scale**: 1 = natural, 2 = double size, 0.5 = half, <0 = mirrored
  \`\`\`jsx
  <div style={{ scale: spring({ frame, from: 0, to: 1 }) }} />
  \`\`\`
- **Rotate**: rotate(45deg), rotateX(), rotateY(), rotateZ() with perspective for 3D
  \`\`\`jsx
  <div style={{ transform: \`rotate(\${frame * 2}deg)\` }} />
  \`\`\`
- **Translate**: translateX(px), translateY(px), translateZ(px) - moves without affecting layout
  \`\`\`jsx
  <div style={{ transform: \`translateY(\${interpolate(frame, [0, 60], [0, 100])}px)\` }} />
  \`\`\`
- **Skew**: skew(20deg), skewX(), skewY() - distorted appearance
  \`\`\`jsx
  <div style={{ transform: \`skew(\${interpolate(frame, [0, 30], [0, 20])}deg)\` }} />
  \`\`\`

**Combine Multiple Transforms:**
\`\`\`jsx
style={{ transform: \`translateX(100px) scale(2) rotate(45deg)\` }}
\`\`\`

**Helper for Type-Safe Transforms:**
\`\`\`jsx
import { makeTransform, rotate, translate } from '@remotion/animation-utils';
const transform = makeTransform([rotate(45), translate(50, 50)]);
\`\`\`

## TRANSITIONS (Scene-to-scene effects)

**TransitionSeries for multiple scenes:**
\`\`\`jsx
import { TransitionSeries, linearTiming, springTiming } from '@remotion/transitions';
import { fade, slide, wipe, flip, iris, clockWipe } from '@remotion/transitions';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={40}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={slide()}
    timing={linearTiming({ durationInFrames: 30 })}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>
\`\`\`

**Transition Presentations:**
- fade() - Opacity blend
- slide() - Slide in, push out previous
- wipe() - Slide over previous (like PowerPoint)
- flip() - Rotate previous scene
- clockWipe() - Circular reveal
- iris() - Circular mask from center

**Enter/Exit Animations:**
Put transition first (entry) or last (exit) in sequence.

## FONTS (Typography styling)

**Google Fonts (Recommended):**
\`\`\`jsx
import { loadFont } from '@remotion/google-fonts/TitanOne';
const { fontFamily } = loadFont();

<div style={{ fontFamily, fontSize: 48 }}>Hello, Google Fonts</div>
\`\`\`

**Local Fonts in /public/:**
\`\`\`jsx
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

loadFont({
  family: 'Inter',
  url: staticFile('Inter-Regular.woff2'),
  weight: '500',
}).then(() => console.log('Font loaded!'));

<div style={{ fontFamily: 'Inter' }}>Text here</div>
\`\`\`

**Manual FontFace Loading:**
\`\`\`jsx
import { delayRender, continueRender, staticFile } from 'remotion';

const handle = delayRender('Loading font...');
const font = new FontFace(
  'Bangers',
  \`url('\${staticFile('bangers.woff2')}') format('woff2')\`
);

font.load().then(() => {
  document.fonts.add(font);
  continueRender(handle);
});
\`\`\`

## MEASURING DOM NODES

**Using useCurrentScale():**
\`\`\`jsx
import { useCurrentScale } from 'remotion';
const ref = useRef<HTMLDivElement>(null);
const scale = useCurrentScale();

const rect = ref.current?.getBoundingClientRect();
const correctedWidth = rect.width / scale;
const correctedHeight = rect.height / scale;
\`\`\`

## ANIMATION MATH (Composing animations)

**Add/Subtract Springs for Complex Effects:**
\`\`\`jsx
const enter = spring({ fps, frame, config: { damping: 200 } });
const exit = spring({
  fps, frame,
  durationInFrames: 20,
  delay: durationInFrames - 20,
  config: { damping: 200 }
});
const scale = enter - exit; // Composite scale value
\`\`\`

## RANDOMNESS (Deterministic pseudo-random values)

**Use random() for deterministic values across threads:**
\`\`\`jsx
import { random } from 'remotion';

const randomX = random('x-seed-1'); // Always 0-1, same across renders
const randomY = random('y-seed-1');
const randomColor = random('color-' + index);

// Array of deterministic random values:
const positions = new Array(10).fill(true).map((_, i) => ({
  x: random(\`x-\${i}\`) * width,
  y: random(\`y-\${i}\`) * height,
}));
\`\`\`

**Use random(null) for true randomness (safe in calculateMetadata only).**

## NOISE VISUALIZATION (Procedural animation)

**Using @remotion/noise for organic, flowing animations:**
\`\`\`jsx
import { noise3D } from '@remotion/noise';
import { interpolate } from 'remotion';

const speed = 0.01; // Animation speed
const dx = noise3D('x', px, py, frame * speed) * maxOffset;
const dy = noise3D('y', px, py, frame * speed) * maxOffset;
const opacity = interpolate(
  noise3D('opacity', i, j, frame * speed),
  [-1, 1],
  [0, 1]
);

// Animate with noise-driven values:
<div style={{
  transform: \`translate(\${dx}px, \${dy}px)\`,
  opacity
}} />
\`\`\`

## MAPS (Geographic animations with Mapbox)

**Prerequisites:**
1. Install: \`npm i mapbox-gl @turf/turf\`
2. Add to .env: \`REMOTION_MAPBOX_TOKEN=pk.your-token\`

**Adding a Map:**
\`\`\`jsx
import { useDelayRender, useVideoConfig } from 'remotion';
import mapboxgl, { Map } from 'mapbox-gl';

mapboxgl.accessToken = process.env.REMOTION_MAPBOX_TOKEN;
const ref = useRef<HTMLDivElement>(null);
const { delayRender, continueRender } = useDelayRender();
const { width, height } = useVideoConfig();
const [handle] = useState(() => delayRender('Loading map...'));
const [map, setMap] = useState<Map | null>(null);

useEffect(() => {
  const _map = new Map({
    container: ref.current!,
    zoom: 11.53,
    center: [6.5615, 46.0598],
    pitch: 65,
    bearing: -180,
    style: 'mapbox://styles/mapbox/standard',
    interactive: false,
    fadeDuration: 0,
  });
  _map.on('load', () => {
    continueRender(handle);
    setMap(_map);
  });
}, [handle, continueRender]);

return <div ref={ref} style={{ width, height, position: 'absolute' }} />;
\`\`\`

**Animating Map Lines (with Turf.js):**
\`\`\`jsx
import * as turf from '@turf/turf';

const routeLine = turf.lineString(lineCoordinates);
const routeDistance = turf.length(routeLine);
const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1]);
const currentDistance = routeDistance * progress;
const slicedLine = turf.lineSliceAlong(routeLine, 0, currentDistance);

// Draw sliced line on map
const source = map?.getSource('route') as mapboxgl.GeoJSONSource;
source?.setData({
  type: 'Feature',
  properties: {},
  geometry: slicedLine.geometry,
});
\`\`\`

**Animating Camera Movement:**
\`\`\`jsx
const alongRoute = turf.along(turf.lineString(lineCoordinates), routeDistance * progress).geometry.coordinates;
const camera = map.getFreeCameraOptions();
camera.lookAtPoint({ lng: alongRoute[0], lat: alongRoute[1] });
map.setFreeCameraOptions(camera);
\`\`\`

## SHAPES LIBRARY (Primitive shapes with animation)

\`\`\`jsx
import { Circle, Rect, Triangle, Star, Ellipse, Pie } from '@remotion/shapes';

<Circle radius={50} fill="#ff0000" />
<Rect width={100} height={100} fill="#00ff00" />
<Triangle radius={50} fill="#0000ff" />
<Star points={5} radius={50} fill="#ffff00" />
<Ellipse rx={60} ry={40} fill="#ff00ff" />
<Pie radius={50} endAngle={interpolate(frame, [0, 30], [0, Math.PI * 2])} fill="#00ffff" />
\`\`\`

## LAYERS (Layering elements for depth)

**AbsoluteFill for layering:**
\`\`\`jsx
import { AbsoluteFill, Sequence } from 'remotion';

<AbsoluteFill>
  <AbsoluteFill>
    <Img src={staticFile('bg.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  </AbsoluteFill>
  
  <AbsoluteFill>
    <h1>Text on top</h1>
  </AbsoluteFill>
  
  <Sequence from={60} durationInFrames={40}>
    <Overlay text="Appears at frame 60" />
  </Sequence>
</AbsoluteFill>
\`\`\`

**Layer stacking:** Lower in tree = higher in z-index. Avoid z-index when possible.

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

## USING ASSETS & IMAGES (CRITICAL - DO NOT SKIP)

If you receive asset URLs in the prompt (look for "## REQUIRED ASSETS TO INTEGRATE" section):
1. **EXTRACT the URL values** - they are in format: data:image/... (base64 encoded) or https://...
2. **Import Remotion's Img** at the top:
   \`\`\`jsx
   import { Img } from 'remotion';
   \`\`\`
3. **Use Img component with data URLs**:
   - For uploaded assets: \`<Img src="data:image/jpeg;base64,..." style={{...}} />\`
   - For external URLs: \`<Img src="https://external-url.com/image.jpg" style={{...}} />\`
4. **Style with Remotion's Img component** (not plain <img>):
   \`\`\`jsx
   <Img 
     src="data:image/png;base64,iVBORw0KGgo..." 
     style={{
       width: '100%',
       height: 'auto',
       objectFit: 'cover',
       borderRadius: '10px'
     }} 
   />
   \`\`\`
5. **Position and animate assets prominently** - they are critical user content
6. **Do NOT ignore provided assets** - every asset listed must be used

WHAT DOES NOT WORK (DO NOT DO THIS):
- Not using Img component: \`<img src={...} />\` ❌ WRONG - use Remotion's <Img />
- Ignoring assets in the REQUIRED ASSETS section ❌ WRONG - use them all
- Marking images as "undefined" ❌ WRONG - use the provided URLs

WHAT WORKS (DO THIS):
- \`import { Img } from 'remotion';\` ✅ CORRECT
- \`<Img src="data:image/png;base64,..." style={{...}} />\` ✅ CORRECT
- \`<Img src="https://example.com/image.jpg" style={{...}} />\` ✅ CORRECT
- Position assets prominently in AbsoluteFill or Sequence ✅ CORRECT

EXAMPLE - If you receive:
\`\`\`
## REQUIRED ASSETS TO INTEGRATE (1 assets provided):
1. "logo.png" → data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
\`\`\`

Then your code must have:
\`\`\`tsx
import { AbsoluteFill, Img } from 'remotion';

export const MyAnimation = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Img 
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" 
        style={{
          width: 300,
          height: 300,
          objectFit: 'cover',
          borderRadius: '50%'
        }} 
      />
    </AbsoluteFill>
  );
};
\`\`\`

## CRITICAL RULE: ASSETS ARE REQUIRED

If the user provided images, they MUST appear in your animation visibly. Do not ignore them or mark them as "undefined".

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

  // Emergency kill switch to stop all outbound AI calls
  if (process.env.API_DISABLED === "true") {
    return new Response(
      JSON.stringify({ error: "API temporarily disabled", rateLimited: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

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

  // Validate the prompt first (using gpt-4o, not gpt-5.2)
  try {
    const validationResult = await generateObject({
      model: openai("gpt-4o"),
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

  // Detect which skills apply to this prompt (using gpt-4o, not gpt-5.2)
  let detectedSkills: SkillName[] = [];
  try {
    const skillResult = await generateObject({
      model: openai("gpt-4o"),
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

  // Save prompt for debugging
  setLastPrompt(prompt);
  console.log(`Saved prompt for debugging (length: ${prompt.length} chars)`);

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
      "Generating React component with prompt length:",
      prompt.length,
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
