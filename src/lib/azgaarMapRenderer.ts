type RenderCell = {
  height: number;
  stateId: number;
};

type RenderState = {
  id: number;
  color: string;
};

type Vertex = [number, number];

type Rgb = {
  r: number;
  g: number;
  b: number;
};

const DEFAULT_LAND: Rgb = { r: 102, g: 140, b: 93 };
const DEEP_OCEAN: Rgb = { r: 15, g: 44, b: 73 };
const SHALLOW_OCEAN: Rgb = { r: 49, g: 102, b: 142 };
const COAST_HIGHLIGHT: Rgb = { r: 235, g: 223, b: 186 };
const RIDGE_HIGHLIGHT: Rgb = { r: 245, g: 241, b: 228 };
const TERRAIN_SHADOW: Rgb = { r: 37, g: 41, b: 31 };

export function buildDetailedAzgaarMapImage(
  cells: RenderCell[],
  states: RenderState[],
  vertices: number[][],
  cellVertices: number[][],
  mapWidth: number,
  mapHeight: number,
): string {
  const scale = getRenderScale();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(mapWidth * scale);
  canvas.height = Math.ceil(mapHeight * scale);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const oceanGradient = ctx.createLinearGradient(0, 0, 0, mapHeight);
  oceanGradient.addColorStop(0, rgbToCss({ r: 34, g: 83, b: 120 }));
  oceanGradient.addColorStop(0.55, rgbToCss({ r: 24, g: 62, b: 96 }));
  oceanGradient.addColorStop(1, rgbToCss(DEEP_OCEAN));
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, mapWidth, mapHeight);

  const polygons = cellVertices.map((indices) => resolvePolygon(indices, vertices));
  const stateColors = new Map<number, Rgb>(states.map((state) => [state.id, hexToRgb(state.color)]));

  // Pass 1: fill cells only (no per-cell stroke — eliminates fat seams)
  for (let index = 0; index < cells.length; index += 1) {
    const polygon = polygons[index];
    if (!polygon) continue;

    const cell = cells[index];
    const fill = cell.stateId === 0
      ? oceanFill(cell.height)
      : landFill(stateColors.get(cell.stateId) ?? DEFAULT_LAND, cell.height);

    tracePolygon(ctx, polygon);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // Pass 2: ultra-thin state border outlines — only stroke edges between
  // cells of DIFFERENT states (true political borders). This avoids drawing
  // the dense interior cell mesh that creates the "fat lines" effect.
  ctx.strokeStyle = 'rgba(25, 25, 30, 0.55)';
  ctx.lineWidth = 1 / scale; // exactly 1 device pixel — true hairline at any zoom
  // Build a quick lookup: edge "ax,ay|bx,by" → first cell index that owns it
  const edgeOwner = new Map<string, number>();
  const edgeKey = (a: Vertex, b: Vertex) => {
    const k1 = `${a[0].toFixed(3)},${a[1].toFixed(3)}`;
    const k2 = `${b[0].toFixed(3)},${b[1].toFixed(3)}`;
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  };
  for (let i = 0; i < cells.length; i++) {
    const poly = polygons[i];
    if (!poly) continue;
    for (let v = 0; v < poly.length; v++) {
      const a = poly[v];
      const b = poly[(v + 1) % poly.length];
      const key = edgeKey(a, b);
      const other = edgeOwner.get(key);
      if (other === undefined) {
        edgeOwner.set(key, i);
      } else {
        const sA = cells[i].stateId;
        const sB = cells[other].stateId;
        if (sA !== sB && sA !== 0 && sB !== 0) {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }
    }
  }

  // Pass 3: crisp coastline — only the edge between land and ocean cells
  ctx.strokeStyle = 'rgba(15, 20, 30, 0.95)';
  ctx.lineWidth = 1.6 / scale;
  edgeOwner.clear();
  for (let i = 0; i < cells.length; i++) {
    const poly = polygons[i];
    if (!poly) continue;
    for (let v = 0; v < poly.length; v++) {
      const a = poly[v];
      const b = poly[(v + 1) % poly.length];
      const key = edgeKey(a, b);
      const other = edgeOwner.get(key);
      if (other === undefined) {
        edgeOwner.set(key, i);
      } else {
        const landA = cells[i].stateId !== 0;
        const landB = cells[other].stateId !== 0;
        if (landA !== landB) {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }
    }
  }

  return canvas.toDataURL('image/png');
}

function getRenderScale() {
  // Much higher resolution texture so the map stays crisp at full Leaflet zoom.
  // Capped to avoid blowing past browser canvas limits (~16k px).
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(48, Math.max(32, Math.ceil(dpr * 24)));
}

function resolvePolygon(indices: number[] = [], vertices: number[][]): Vertex[] | null {
  const polygon: Vertex[] = [];

  for (const index of indices) {
    const vertex = vertices[index];
    if (!vertex || vertex.length < 2) continue;
    polygon.push([vertex[0], vertex[1]]);
  }

  return polygon.length >= 3 ? polygon : null;
}

function tracePolygon(ctx: CanvasRenderingContext2D, polygon: Vertex[]) {
  ctx.beginPath();
  ctx.moveTo(polygon[0][0], polygon[0][1]);

  for (let index = 1; index < polygon.length; index += 1) {
    ctx.lineTo(polygon[index][0], polygon[index][1]);
  }

  ctx.closePath();
}

function oceanFill(height: number) {
  const depth = 1 - normalize(height, 0, 20);
  return rgbToCss(mixRgb(SHALLOW_OCEAN, DEEP_OCEAN, depth));
}

function landFill(base: Rgb, height: number) {
  const elevation = normalize(height, 20, 74);
  const shaded = mixRgb(base, TERRAIN_SHADOW, 0.18 - elevation * 0.08);
  const lit = mixRgb(shaded, RIDGE_HIGHLIGHT, elevation * 0.22);

  return rgbToCss({
    r: clamp(lit.r + elevation * 10),
    g: clamp(lit.g + elevation * 8),
    b: clamp(lit.b + elevation * 4),
  });
}

function normalize(value: number, min: number, max: number) {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const clampedAmount = Math.max(0, Math.min(1, amount));

  return {
    r: clamp(from.r + (to.r - from.r) * clampedAmount),
    g: clamp(from.g + (to.g - from.g) * clampedAmount),
    b: clamp(from.b + (to.b - from.b) * clampedAmount),
  };
}

function rgbToCss(rgb: Rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function rgbaToCss(rgb: Rgb, alpha: number) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hexToRgb(hex: string): Rgb {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  if (!result) return DEFAULT_LAND;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}