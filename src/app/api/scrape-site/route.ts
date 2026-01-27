import { NextRequest, NextResponse } from "next/server";

/**
 * Scrape a website and extract content for animation generation
 * Extracts: title, headings, key text, images, colors, and structure
 */

interface ScrapedContent {
  url: string;
  title: string;
  description: string;
  headings: string[];
  keyPoints: string[];
  images: { src: string; alt: string }[];
  colors: string[];
  brandName?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AnimationBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: 400 },
      );
    }

    const html = await response.text();

    // Extract content using regex (simple approach without heavy dependencies)
    const scraped: ScrapedContent = {
      url: parsedUrl.toString(),
      title: extractTitle(html),
      description: extractMetaDescription(html),
      headings: extractHeadings(html),
      keyPoints: extractKeyPoints(html),
      images: extractImages(html, parsedUrl),
      colors: extractColors(html),
      brandName: extractBrandName(html, parsedUrl),
    };

    // Generate animation prompt from scraped content
    const animationPrompt = generateAnimationPrompt(scraped);

    return NextResponse.json({
      scraped,
      animationPrompt,
      success: true,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Failed to scrape website" },
      { status: 500 },
    );
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractMetaDescription(html: string): string {
  const match = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
  );
  if (match) return decodeHtmlEntities(match[1].trim());

  // Try og:description
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  );
  return ogMatch ? decodeHtmlEntities(ogMatch[1].trim()) : "";
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];

  // Use exec in a loop instead of matchAll for better compatibility
  const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
  const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/gi;

  let match;
  while ((match = h1Regex.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text && text.length > 3 && text.length < 200) {
      headings.push(text);
    }
  }

  while ((match = h2Regex.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text && text.length > 3 && text.length < 200) {
      headings.push(text);
    }
  }

  return headings.slice(0, 10); // Limit to 10 headings
}

function extractKeyPoints(html: string): string[] {
  const points: string[] = [];

  // Extract list items - use exec instead of matchAll
  const liRegex = /<li[^>]*>([^<]+)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text && text.length > 10 && text.length < 150) {
      points.push(text);
    }
  }

  // Extract strong/bold text
  const strongRegex = /<(?:strong|b)[^>]*>([^<]+)<\/(?:strong|b)>/gi;
  while ((match = strongRegex.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text && text.length > 5 && text.length < 100) {
      points.push(text);
    }
  }

  return [...new Set(points)].slice(0, 8); // Unique, limit to 8
}

function extractImages(
  html: string,
  baseUrl: URL,
): { src: string; alt: string }[] {
  const images: { src: string; alt: string }[] = [];
  const imgRegex =
    /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;

  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];
    const alt = match[2] || "";

    // Skip tiny images, icons, tracking pixels
    if (
      src.includes("1x1") ||
      src.includes("pixel") ||
      src.includes("tracking") ||
      src.includes(".svg") ||
      src.includes("icon")
    ) {
      continue;
    }

    // Make absolute URL
    if (src.startsWith("//")) {
      src = `https:${src}`;
    } else if (src.startsWith("/")) {
      src = `${baseUrl.origin}${src}`;
    } else if (!src.startsWith("http")) {
      src = `${baseUrl.origin}/${src}`;
    }

    images.push({ src, alt });
  }

  return images.slice(0, 5); // Limit to 5 images
}

function extractColors(html: string): string[] {
  const colors: string[] = [];

  // Extract hex colors from inline styles - use exec instead of matchAll
  const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  let match;
  while ((match = hexRegex.exec(html)) !== null) {
    const color = `#${match[1].toUpperCase()}`;
    if (!colors.includes(color)) {
      colors.push(color);
    }
  }

  // Extract rgb colors
  const rgbRegex = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi;
  while ((match = rgbRegex.exec(html)) !== null) {
    const hex = rgbToHex(
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3]),
    );
    if (!colors.includes(hex)) {
      colors.push(hex);
    }
  }

  // Filter out common boring colors
  const filtered = colors.filter(
    (c) =>
      c !== "#FFFFFF" &&
      c !== "#FFF" &&
      c !== "#000000" &&
      c !== "#000" &&
      c !== "#333333",
  );

  return filtered.slice(0, 5); // Limit to 5 colors
}

function extractBrandName(html: string, url: URL): string {
  // Try og:site_name
  const ogMatch = html.match(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogMatch) return decodeHtmlEntities(ogMatch[1].trim());

  // Fall back to domain name
  const domain = url.hostname.replace("www.", "");
  const parts = domain.split(".");
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

function generateAnimationPrompt(scraped: ScrapedContent): string {
  const parts: string[] = [];

  parts.push(
    `Create an animated explainer video about "${scraped.brandName || scraped.title}".`,
  );

  if (scraped.description) {
    parts.push(`\nMain message: ${scraped.description}`);
  }

  if (scraped.headings.length > 0) {
    parts.push(`\nKey sections to highlight:`);
    scraped.headings.slice(0, 5).forEach((h, i) => {
      parts.push(`${i + 1}. ${h}`);
    });
  }

  if (scraped.keyPoints.length > 0) {
    parts.push(`\nKey points to animate:`);
    scraped.keyPoints.slice(0, 5).forEach((p) => {
      parts.push(`• ${p}`);
    });
  }

  if (scraped.colors.length > 0) {
    parts.push(`\nUse these brand colors: ${scraped.colors.join(", ")}`);
  }

  if (scraped.images.length > 0) {
    parts.push(`\nInclude these images:`);
    scraped.images.slice(0, 3).forEach((img) => {
      parts.push(`- ${img.src}${img.alt ? ` (${img.alt})` : ""}`);
    });
  }

  parts.push(`\nStyle: Professional, clean, modern motion graphics.`);
  parts.push(`Duration: 15-20 seconds.`);

  return parts.join("\n");
}

// Helper functions
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
      .toUpperCase()
  );
}
