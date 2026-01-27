/**
 * Vox Mode - Specialist system for explainer/documentary style videos
 */

export const VOX_MODE_SYSTEM = `
## VOX MODE - EXPLAINER VIDEO SPECIALIST

Signature Vox visual style with grid backgrounds, bold outlines, and mixed media.

### KEY ELEMENTS
- Grid line backgrounds (always)
- Bold colored outlines (4-6px): Yellow #FFD700, Red #FF4444, Blue #4A90E2
- Hand-drawn circles, arrows, underlines
- Yellow text highlights
- Mixed media layering

### TIMING
- Setup: 2-3s, Main: 8-12s, Conclusion: 2-3s

Create educational content with signature Vox visual style.
`;

export const getVoxModePrompt = (userPrompt: string): string => {
  return `${VOX_MODE_SYSTEM}\n\n## USER REQUEST:\n${userPrompt}`;
};
