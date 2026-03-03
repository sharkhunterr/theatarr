/**
 * Color palette extraction utility using canvas-based color analysis.
 * Provides client-side palette extraction from images for dynamic theming.
 */

export interface ColorPalette {
  primary: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  vibrant?: string;
  muted?: string;
  cssVars?: Record<string, string>;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Extract dominant colors from an image URL.
 * Uses canvas to sample colors and k-means-like clustering.
 */
export async function extractPalette(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const palette = extractColorsFromImage(img);
        resolve(palette);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
}

/**
 * Extract colors from a loaded image element.
 */
function extractColorsFromImage(img: HTMLImageElement): ColorPalette {
  // Create a small canvas for sampling
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return getDefaultPalette();
  }

  // Scale down for performance
  const maxSize = 100;
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Sample colors
  const colors: RGB[] = [];
  const sampleRate = 4; // Sample every 4th pixel

  for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Skip transparent pixels
    if (a < 128) continue;

    // Skip very dark or very light pixels
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || brightness > 235) continue;

    colors.push({ r, g, b });
  }

  if (colors.length === 0) {
    return getDefaultPalette();
  }

  // Find dominant colors using simple clustering
  const clusters = findColorClusters(colors, 6);

  // Sort by saturation and brightness to find vibrant/muted
  const sorted = clusters.sort((a, b) => {
    const satA = getSaturation(a);
    const satB = getSaturation(b);
    return satB - satA;
  });

  const vibrant = sorted[0];
  const muted = sorted[sorted.length - 1] || sorted[0];

  // Find colors by brightness for background/text
  const byBrightness = [...clusters].sort((a, b) => {
    const brightA = (a.r + a.g + a.b) / 3;
    const brightB = (b.r + b.g + b.b) / 3;
    return brightA - brightB;
  });

  const darkest = byBrightness[0];
  const lightest = byBrightness[byBrightness.length - 1];

  // Create palette
  const primary = rgbToHex(vibrant);
  const secondary = clusters[1] ? rgbToHex(clusters[1]) : undefined;
  const accent = clusters[2] ? rgbToHex(clusters[2]) : undefined;
  const background = darkenColor(darkest, 0.3);
  const text = lightenColor(lightest, 0.2);

  const palette: ColorPalette = {
    primary,
    secondary,
    accent,
    background,
    text,
    vibrant: rgbToHex(vibrant),
    muted: rgbToHex(muted),
  };

  palette.cssVars = paletteToCssVars(palette);

  return palette;
}

/**
 * Simple k-means-like clustering for colors.
 */
function findColorClusters(colors: RGB[], k: number): RGB[] {
  if (colors.length <= k) {
    return colors;
  }

  // Initialize centroids with evenly spaced colors
  const step = Math.floor(colors.length / k);
  let centroids = Array.from({ length: k }, (_, i) => ({ ...colors[i * step] }));

  // Iterate to refine clusters
  for (let iter = 0; iter < 10; iter++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => []);

    // Assign each color to nearest centroid
    for (const color of colors) {
      let minDist = Infinity;
      let minIdx = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }

      clusters[minIdx].push(color);
    }

    // Update centroids
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) {
        return centroids[i];
      }

      return {
        r: Math.round(cluster.reduce((sum, c) => sum + c.r, 0) / cluster.length),
        g: Math.round(cluster.reduce((sum, c) => sum + c.g, 0) / cluster.length),
        b: Math.round(cluster.reduce((sum, c) => sum + c.b, 0) / cluster.length),
      };
    });
  }

  return centroids;
}

/**
 * Calculate distance between two colors in RGB space.
 */
function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2)
  );
}

/**
 * Calculate saturation of an RGB color.
 */
function getSaturation(color: RGB): number {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  const delta = max - min;

  if (max === 0) return 0;
  return delta / max;
}

/**
 * Convert RGB to hex string.
 */
function rgbToHex(color: RGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Darken a color by a percentage.
 */
function darkenColor(color: RGB, amount: number): string {
  return rgbToHex({
    r: Math.round(color.r * (1 - amount)),
    g: Math.round(color.g * (1 - amount)),
    b: Math.round(color.b * (1 - amount)),
  });
}

/**
 * Lighten a color by a percentage.
 */
function lightenColor(color: RGB, amount: number): string {
  return rgbToHex({
    r: Math.round(color.r + (255 - color.r) * amount),
    g: Math.round(color.g + (255 - color.g) * amount),
    b: Math.round(color.b + (255 - color.b) * amount),
  });
}

/**
 * Convert palette to CSS variables.
 */
function paletteToCssVars(palette: ColorPalette): Record<string, string> {
  const vars: Record<string, string> = {};

  if (palette.primary) vars['--palette-primary'] = palette.primary;
  if (palette.secondary) vars['--palette-secondary'] = palette.secondary;
  if (palette.accent) vars['--palette-accent'] = palette.accent;
  if (palette.background) vars['--palette-background'] = palette.background;
  if (palette.text) vars['--palette-text'] = palette.text;
  if (palette.vibrant) vars['--palette-vibrant'] = palette.vibrant;
  if (palette.muted) vars['--palette-muted'] = palette.muted;

  return vars;
}

/**
 * Get default palette when extraction fails.
 */
function getDefaultPalette(): ColorPalette {
  return {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    background: '#0a0a0f',
    text: '#ffffff',
    vibrant: '#6366f1',
    muted: '#4b5563',
    cssVars: {
      '--palette-primary': '#6366f1',
      '--palette-secondary': '#8b5cf6',
      '--palette-accent': '#f59e0b',
      '--palette-background': '#0a0a0f',
      '--palette-text': '#ffffff',
      '--palette-vibrant': '#6366f1',
      '--palette-muted': '#4b5563',
    },
  };
}

/**
 * Apply palette CSS variables to an element.
 */
export function applyPaletteToElement(
  element: HTMLElement,
  palette: ColorPalette
): void {
  const vars = palette.cssVars || paletteToCssVars(palette);

  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
}

/**
 * Apply palette CSS variables to the document root.
 */
export function applyPaletteGlobally(palette: ColorPalette): void {
  applyPaletteToElement(document.documentElement, palette);
}
