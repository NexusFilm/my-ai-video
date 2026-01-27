/**
 * AI Video Hybrid System
 * 
 * Intelligently determines when to use AI video generation (Google Veo 3)
 * to enhance Remotion code with realistic elements that are hard to code.
 * 
 * Cost-conscious: Only uses AI video when necessary
 */

export interface AIVideoNeed {
  needed: boolean;
  reason?: string;
  elements: AIVideoElement[];
  estimatedCost: "low" | "medium" | "high";
}

export interface AIVideoElement {
  type: "character" | "realistic-motion" | "complex-scene" | "nature" | "crowd";
  description: string;
  duration: number; // seconds
  prompt: string; // What to generate
}

export const AI_VIDEO_DETECTION_PROMPT = `You are an AI video generation advisor for a motion graphics app using Google Veo 3.

Your job is to analyze user prompts and determine if AI video generation is needed to enhance the animation.

## WHEN AI VIDEO IS NEEDED:

**Realistic Human Characters:**
- Walking, running, gesturing people
- Facial expressions and emotions
- Complex human movements
- Multiple people interacting
- Crowds or groups

**Complex Realistic Motion:**
- Flowing water, fire, smoke
- Weather effects (rain, snow, wind)
- Organic movements (plants swaying, animals moving)
- Realistic physics that's hard to code

**Photorealistic Scenes:**
- Real-world environments
- Camera movements through spaces
- Cinematic shots
- Nature scenes with complex elements

## WHEN AI VIDEO IS NOT NEEDED (Use Code Instead):

**Simple Graphics:**
- Text animations
- Shape animations
- Icons and illustrations
- Data visualizations
- Charts and graphs
- Simple character illustrations (stick figures, icons)

**Stylized Animation:**
- Flat design animations
- Vector graphics
- Geometric patterns
- Abstract motion graphics
- Infographics

**UI Elements:**
- Buttons, cards, menus
- Progress bars
- Transitions and effects

## COST CONSIDERATIONS:

- Each AI video generation costs money
- Prefer code-based solutions when possible
- Only suggest AI video for elements that significantly improve quality
- Keep AI video clips short (2-5 seconds max)
- Combine multiple needs into single generations when possible

## OUTPUT FORMAT:

Return JSON:
{
  "needed": boolean,
  "reason": "Why AI video is/isn't needed",
  "elements": [
    {
      "type": "character" | "realistic-motion" | "complex-scene" | "nature" | "crowd",
      "description": "What this element is",
      "duration": 3,
      "prompt": "Detailed prompt for AI video generation"
    }
  ],
  "estimatedCost": "low" | "medium" | "high"
}

Analyze the user's prompt and determine if AI video generation would significantly enhance the result.`;

export const analyzeAIVideoNeed = async (userPrompt: string): Promise<AIVideoNeed> => {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: AI_VIDEO_DETECTION_PROMPT },
          { role: "user", content: `Analyze this prompt: "${userPrompt}"` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze AI video need");
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    
    return {
      needed: analysis.needed || false,
      reason: analysis.reason,
      elements: analysis.elements || [],
      estimatedCost: analysis.estimatedCost || "low",
    };
  } catch (error) {
    console.error("AI video analysis error:", error);
    // Default to not using AI video if analysis fails
    return {
      needed: false,
      elements: [],
      estimatedCost: "low",
    };
  }
};

export const HYBRID_SYSTEM_PROMPT = `
## HYBRID AI VIDEO SYSTEM

You can now enhance your Remotion code with AI-generated video clips when needed.

### WHEN TO USE AI VIDEO:

If the user requests realistic elements that are difficult to code:
- Realistic human characters (walking, gesturing, facial expressions)
- Complex natural motion (water, fire, smoke, weather)
- Photorealistic scenes or environments
- Crowds or groups of people
- Organic movements (animals, plants)

### HOW TO INTEGRATE AI VIDEO:

When AI video is needed, use the <Video> component from Remotion:

\`\`\`tsx
import { Video } from "remotion";

// In your component:
<Video
  src="{{AI_VIDEO_URL}}"
  startFrom={0}
  endAt={90} // 3 seconds at 30fps
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }}
/>
\`\`\`

### HYBRID APPROACH:

Combine code-based graphics with AI video:

\`\`\`tsx
// Example: Person walking with text overlay
<AbsoluteFill>
  {/* AI-generated video of person walking */}
  <Video src="{{AI_VIDEO_URL}}" />
  
  {/* Code-based text overlay */}
  <div style={{
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    textAlign: 'center',
  }}>
    <h1 style={{
      fontSize: 60,
      color: 'white',
      textShadow: '0 2px 10px rgba(0,0,0,0.5)',
    }}>
      {TITLE_TEXT}
    </h1>
  </div>
</AbsoluteFill>
\`\`\`

### COST-CONSCIOUS DESIGN:

- Keep AI video clips SHORT (2-5 seconds)
- Use AI video only for elements that can't be coded well
- Prefer code-based solutions when possible
- Reuse AI video clips when appropriate
- Combine multiple needs into single generations

### PLACEHOLDER HANDLING:

When AI video is needed, use placeholder:
- src="{{AI_VIDEO_URL}}" - will be replaced with actual video URL
- The system will generate the video based on the prompt
- Multiple placeholders can be used: {{AI_VIDEO_URL_1}}, {{AI_VIDEO_URL_2}}

### REMEMBER:

- AI video is a TOOL, not a replacement for code
- Use it strategically to enhance realism
- Keep costs down by being selective
- Code-based animations are preferred when they work well
`;

export const getHybridSystemPrompt = (basePrompt: string, aiVideoNeeded: boolean): string => {
  if (!aiVideoNeeded) {
    return basePrompt;
  }
  return `${basePrompt}\n\n${HYBRID_SYSTEM_PROMPT}`;
};
