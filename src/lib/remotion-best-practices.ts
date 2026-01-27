// Remotion best practices extracted from skills for use with any AI model

export const REMOTION_BEST_PRACTICES = `
## Remotion Animation Best Practices

### Core Hooks
- useCurrentFrame() - Get current frame number
- useVideoConfig() - Get fps, width, height, durationInFrames
- interpolate(frame, inputRange, outputRange) - Map frame to values
- spring({ frame, fps, config }) - Physics-based animations

### Animation Patterns
1. Fade in: interpolate(frame, [0, 30], [0, 1])
2. Slide in: interpolate(frame, [0, 30], [-100, 0])
3. Scale: interpolate(frame, [0, 30], [0, 1])
4. Spring bounce: spring({ frame, fps, config: { damping: 10, stiffness: 100 } })

### Sequencing
- Use <Sequence from={30}> to delay elements
- Stagger animations with different "from" values
- Use durationInFrames to control sequence length

### Layout
- <AbsoluteFill> for full-screen positioning
- Use flexbox for centering: justifyContent: "center", alignItems: "center"
- Position elements with absolute positioning and transform

### Colors & Styling
- Use CSS-in-JS with style prop
- Prefer rgba() for colors with opacity
- Use consistent color schemes

### Performance
- Avoid heavy calculations in render
- Use useMemo for expensive computations
- Keep animations smooth (60fps target)

### Common Components
- AbsoluteFill - Full screen container
- Sequence - Timing control
- Img - Image with loading handling
- Video - Video playback
- Audio - Audio playback

### Asset & Image Handling
- Images provided as data URLs: <img src="data:image/..." style={{ width: "100%", height: "auto" }} />
- Always use assets when provided in the prompt - they are critical components
- Position assets meaningfully in the composition
- Animate assets when appropriate (fade in, scale, translate with Sequence)
- Multiple assets can be layered: use z-index styling or Sequence timing
- Example: <img src={assetUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />

### Code Structure
- Export component as: export const MyAnimation: React.FC = () => {}
- Import from "remotion": { AbsoluteFill, useCurrentFrame, interpolate, spring, Sequence, useVideoConfig }
- Keep all constants at top of file for easy editing
`;

export const getSystemPromptWithBestPractices = (basePrompt: string) => {
  return `${basePrompt}

${REMOTION_BEST_PRACTICES}

IMPORTANT RULES:
1. Always export the component with a clear name
2. Use TypeScript/TSX syntax
3. Include all necessary imports from "remotion"
4. Make animations smooth and professional
5. Use spring() for bouncy, natural animations
6. Use interpolate() for linear transitions
7. Keep code clean and well-organized
8. If assets/images are provided in the prompt, ALWAYS incorporate them actively into the animation
9. Never ignore provided assets - they are critical to the user's request
`;
};
