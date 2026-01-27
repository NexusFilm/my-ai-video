/**
 * Style Presets - Pre-made styles that enhance prompts with specific visual directions
 */

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  promptEnhancement: string;
  durationSuggestion: number; // in frames at 30fps
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "vox",
    name: "Vox Explainer",
    description: "Documentary-style with animated graphics, maps, charts, and text overlays",
    icon: "📊",
    promptEnhancement: `Style: Vox/explainer documentary format.

VISUAL STYLE:
- Clean, modern graphics with bold outlines (2-3px black strokes)
- Flat design with subtle shadows for depth
- Animated maps, charts, timelines, and infographics
- Text overlays with clear hierarchy (title, subtitle, body)
- Color palette: Use 2-3 bold accent colors + neutrals
- Icons and illustrations should be simple, recognizable
- Smooth transitions between scenes (fade, slide, zoom)

ANIMATION TECHNIQUES:
- Draw-on effects for lines, paths, and shapes
- Counter animations for numbers/statistics
- Zoom into specific areas of maps or images
- Highlight/circle important elements
- Text appears word-by-word or line-by-line
- Use arrows, brackets, and callouts to direct attention

PACING:
- Hold key information for 2-3 seconds
- Smooth, professional transitions (0.5-0.8s)
- Build complexity gradually (simple → detailed)
- Use visual hierarchy to guide viewer's eye

STORYTELLING:
- Start with context/setup
- Present data or information clearly
- Use visual metaphors and comparisons
- End with conclusion or key takeaway`,
    durationSuggestion: 450, // 15 seconds
  },
  {
    id: "modern",
    name: "Modern Minimal",
    description: "Clean, contemporary design with smooth animations",
    icon: "✨",
    promptEnhancement: `Style: Modern minimal design.

VISUAL STYLE:
- Generous white space and breathing room
- Sans-serif typography (Inter, Helvetica, SF Pro)
- Monochromatic or limited color palette
- Subtle gradients and soft shadows
- Grid-based layouts
- Geometric shapes and clean lines

ANIMATION:
- Smooth spring animations
- Fade and scale transitions
- Parallax effects for depth
- Micro-interactions and subtle movements
- Elegant easing curves`,
    durationSuggestion: 150, // 5 seconds
  },
  {
    id: "bold",
    name: "Bold & Energetic",
    description: "High-energy with vibrant colors and dynamic motion",
    icon: "⚡",
    promptEnhancement: `Style: Bold and energetic.

VISUAL STYLE:
- Vibrant, saturated colors
- Large, bold typography
- High contrast elements
- Dynamic angles and perspectives
- Overlapping layers

ANIMATION:
- Fast-paced movements
- Bounce and overshoot effects
- Rotation and scale transformations
- Staggered entrances
- Energetic transitions`,
    durationSuggestion: 120, // 4 seconds
  },
  {
    id: "corporate",
    name: "Corporate Professional",
    description: "Business-appropriate with data visualization",
    icon: "💼",
    promptEnhancement: `Style: Corporate professional.

VISUAL STYLE:
- Professional color scheme (blues, grays, whites)
- Clean data visualizations (charts, graphs)
- Structured layouts with clear hierarchy
- Professional typography
- Subtle, sophisticated animations

ANIMATION:
- Smooth, controlled movements
- Data-driven animations (bars growing, lines drawing)
- Professional transitions
- Emphasis on clarity and readability`,
    durationSuggestion: 180, // 6 seconds
  },
  {
    id: "retro",
    name: "Retro/Vintage",
    description: "Nostalgic design with vintage aesthetics",
    icon: "📼",
    promptEnhancement: `Style: Retro/vintage aesthetic.

VISUAL STYLE:
- Warm, muted color palette
- Vintage typography (serif, script fonts)
- Texture and grain effects
- Rounded corners and organic shapes
- Film-inspired elements

ANIMATION:
- Slightly imperfect, organic movements
- Fade and dissolve transitions
- Vintage film effects
- Nostalgic timing and pacing`,
    durationSuggestion: 150, // 5 seconds
  },
  {
    id: "kinetic-typography",
    name: "Kinetic Typography",
    description: "Text-focused with dynamic word animations",
    icon: "🔤",
    promptEnhancement: `Style: Kinetic typography.

VISUAL STYLE:
- Text as the primary visual element
- Bold, expressive typography
- Words that move, scale, and transform
- Minimal background elements
- Focus on readability and impact

ANIMATION:
- Words appear, move, and exit dynamically
- Letter-by-letter or word-by-word reveals
- Text follows paths and curves
- Scale, rotation, and position changes
- Rhythm and timing match the message`,
    durationSuggestion: 120, // 4 seconds
  },
  {
    id: "infographic",
    name: "Infographic",
    description: "Data-driven with charts, graphs, and statistics",
    icon: "📈",
    promptEnhancement: `Style: Infographic/data visualization.

VISUAL STYLE:
- Clear data presentation (bar charts, pie charts, line graphs)
- Icons and pictograms
- Color-coded information
- Grid layouts for organization
- Numbers and statistics prominently displayed

ANIMATION:
- Data reveals progressively
- Counters animate from 0 to target number
- Bars and lines draw on smoothly
- Pie charts fill in segments
- Icons pop in with emphasis`,
    durationSuggestion: 240, // 8 seconds
  },
  {
    id: "storytelling",
    name: "Visual Storytelling",
    description: "Narrative-driven with scene transitions",
    icon: "📖",
    promptEnhancement: `Style: Visual storytelling.

VISUAL STYLE:
- Scene-based structure (beginning, middle, end)
- Illustrated characters or objects
- Environmental context and backgrounds
- Visual metaphors and symbolism
- Cohesive color story throughout

ANIMATION:
- Scene transitions (wipes, fades, zooms)
- Character movements and actions
- Camera-like movements (pan, zoom, dolly)
- Progressive revelation of story elements
- Emotional pacing and timing`,
    durationSuggestion: 600, // 20 seconds
  },
];

export const getPresetById = (id: string): StylePreset | undefined => {
  return STYLE_PRESETS.find(preset => preset.id === id);
};

export const getPresetEnhancement = (presetIds: string[]): string => {
  const presets = presetIds
    .map(id => getPresetById(id))
    .filter(Boolean) as StylePreset[];
  
  if (presets.length === 0) return "";
  
  return presets.map(p => p.promptEnhancement).join("\n\n---\n\n");
};
