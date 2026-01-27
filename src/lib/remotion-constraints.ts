/**
 * Remotion Constraints - What Remotion CAN and CANNOT do
 * This is injected into AI prompts to prevent generating unsupported code
 */

export const REMOTION_CONSTRAINTS = `
## CRITICAL: REMOTION LIMITATIONS (READ CAREFULLY)

Remotion is a React-based video framework. It renders frames as images, NOT a real browser.

### ❌ WHAT REMOTION CANNOT DO (NEVER USE THESE):

**Audio:**
- ❌ NO <Audio> component for sound effects or music
- ❌ NO new Audio() constructor
- ❌ NO Web Audio API (AudioContext, oscillators, etc.)
- ❌ NO audio playback of any kind in the preview
- If user asks for audio/sound, explain it's not supported in preview

**Video:**
- ❌ NO <Video> component for video playback in generated code
- ❌ NO video embedding or playback

**Browser APIs that don't work:**
- ❌ NO window.addEventListener for user interaction
- ❌ NO click handlers, hover effects, or user input
- ❌ NO localStorage, sessionStorage
- ❌ NO fetch() or API calls during render
- ❌ NO setTimeout, setInterval (use frame-based timing instead)
- ❌ NO CSS animations or @keyframes (use interpolate/spring instead)
- ❌ NO CSS transitions
- ❌ NO requestAnimationFrame

**Effects that don't exist:**
- ❌ NO "shake" effect built-in (must be manually coded with Math.sin)
- ❌ NO "blur" animation (static blur only via filter)
- ❌ NO "glow" animation (static only)
- ❌ NO particle systems (must be manually coded)
- ❌ NO physics engine (must calculate manually)

**Other limitations:**
- ❌ NO external fonts without proper loading (use @remotion/google-fonts)
- ❌ NO SVG animations via SMIL
- ❌ NO canvas 2D/WebGL without special setup
- ❌ NO iframes or external content

### ✅ WHAT REMOTION CAN DO (USE THESE):

**Core Animation:**
- ✅ useCurrentFrame() - get current frame number
- ✅ useVideoConfig() - get width, height, fps, durationInFrames
- ✅ interpolate() - map frame to any value (position, opacity, scale, etc.)
- ✅ spring() - physics-based easing for natural motion
- ✅ Sequence - show content at specific frame ranges
- ✅ AbsoluteFill - full-screen container for layering

**Visual Effects (manual implementation):**
- ✅ Shake effect: Use Math.sin(frame * speed) * amplitude for x/y offset
- ✅ Bounce: Calculate position with velocity and gravity per frame
- ✅ Pulse: Use interpolate with sine wave for scale
- ✅ Wiggle: Use noise3D from @remotion/noise
- ✅ Particles: Create array of objects, update positions per frame

**Styling:**
- ✅ Inline CSS styles (transform, opacity, filter, etc.)
- ✅ Static CSS filters (blur, brightness, contrast, etc.)
- ✅ Google Fonts via @remotion/google-fonts
- ✅ SVG elements (static or animated via props)

**Shapes:**
- ✅ @remotion/shapes: Circle, Rect, Triangle, Star, Ellipse, Pie

**Images:**
- ✅ <img> tag with src (use lowercase, not <Img>)
- ✅ External URLs (https://...)
- ✅ Data URLs (data:image/...)
- ✅ staticFile() for local assets

**Transitions:**
- ✅ @remotion/transitions: fade, slide, wipe, flip, clockWipe

### EXAMPLE: How to implement "shake" effect

WRONG (doesn't exist):
\`\`\`tsx
// ❌ This doesn't exist in Remotion
<div shake={true} />
\`\`\`

CORRECT (manual implementation):
\`\`\`tsx
const frame = useCurrentFrame();
const shakeX = Math.sin(frame * 0.5) * 5; // 5px amplitude
const shakeY = Math.cos(frame * 0.7) * 3; // 3px amplitude

<div style={{ transform: \`translate(\${shakeX}px, \${shakeY}px)\` }}>
  Content
</div>
\`\`\`

### EXAMPLE: How to implement "bounce" effect

\`\`\`tsx
const frame = useCurrentFrame();
const { height } = useVideoConfig();

// Simple bounce physics
const gravity = 0.5;
const initialVelocity = -15;
const bounceDecay = 0.7;

// Calculate position (simplified)
let y = 0;
let velocity = initialVelocity;
for (let f = 0; f < frame; f++) {
  velocity += gravity;
  y += velocity;
  if (y > height - 50) { // Hit floor
    y = height - 50;
    velocity *= -bounceDecay;
  }
}

<div style={{ transform: \`translateY(\${y}px)\` }}>
  Bouncing Ball
</div>
\`\`\`

### WHEN USER ASKS FOR UNSUPPORTED FEATURES:

If user asks for audio, video, or other unsupported features:
1. Do NOT include them in the code
2. Create a visual-only animation that represents the concept
3. For "audio visualizer" → create animated bars/waves without actual audio
4. For "video player" → create a static frame or placeholder
`;

export const AUDIO_WARNING = `
⚠️ AUDIO NOT SUPPORTED: Remotion preview cannot play audio. 
The generated animation will be visual-only. Audio can be added during final video export.
`;

export const getConstraintsForError = (error: string): string => {
  const lowerError = error.toLowerCase();

  if (lowerError.includes("audio") || lowerError.includes("sound")) {
    return `
The error is related to audio. Remember:
- Remotion CANNOT play audio in preview
- Do NOT use <Audio>, new Audio(), or Web Audio API
- Create visual-only animations instead
- Remove all audio-related code
`;
  }

  if (lowerError.includes("video")) {
    return `
The error is related to video. Remember:
- Do NOT use <Video> component in generated code
- Create static or animated placeholders instead
`;
  }

  if (lowerError.includes("shake") || lowerError.includes("wiggle")) {
    return `
The error is related to shake/wiggle effects. Remember:
- There is NO built-in shake effect
- Implement manually: Math.sin(frame * speed) * amplitude
- Apply to transform: translate(\${shakeX}px, \${shakeY}px)
`;
  }

  if (
    lowerError.includes("cannot find") ||
    lowerError.includes("is not defined")
  ) {
    return `
The error indicates a missing import or undefined variable.
- Check all imports are from valid Remotion packages
- Ensure all variables are defined before use
- Common imports: useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Sequence
`;
  }

  return "";
};
