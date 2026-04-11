import L from 'leaflet';

/**
 * Custom Leaflet GridLayer that renders Azgaar Voronoi polygons per-tile.
 * This gives crisp vector-quality rendering at ANY zoom level.
 */

type Vertex = [number, number];

interface CellData {
  height: number;
  stateId: number;
  polygon: Vertex[] | null;
  biomeId?: number;
}

interface VectorTileOptions extends L.GridLayerOptions {
  cells: CellData[];
  stateColors: Map<number, string>;
  hiddenStates?: Set<number>;
  showBorders?: boolean;
}

// Spatial index: grid of cell indices for fast lookup per tile
let _spatialGrid: Map<string, number[]> | null = null;
let _gridCellSize = 20; // spatial grid cell size in map units

function buildSpatialIndex(cells: CellData[]) {
  const grid = new Map<string, number[]>();
  for (let i = 0; i < cells.length; i++) {
    const poly = cells[i].polygon;
    if (!poly) continue;
    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of poly) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const gx0 = Math.floor(minX / _gridCellSize);
    const gy0 = Math.floor(minY / _gridCellSize);
    const gx1 = Math.floor(maxX / _gridCellSize);
    const gy1 = Math.floor(maxY / _gridCellSize);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        let list = grid.get(key);
        if (!list) { list = []; grid.set(key, list); }
        list.push(i);
      }
    }
  }
  return grid;
}

function getCellsInBounds(minX: number, minY: number, maxX: number, maxY: number): Set<number> {
  const result = new Set<number>();
  if (!_spatialGrid) return result;
  const gx0 = Math.floor(minX / _gridCellSize);
  const gy0 = Math.floor(minY / _gridCellSize);
  const gx1 = Math.floor(maxX / _gridCellSize);
  const gy1 = Math.floor(maxY / _gridCellSize);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      const list = _spatialGrid.get(`${gx},${gy}`);
      if (list) for (const idx of list) result.add(idx);
    }
  }
  return result;
}

// Color helpers
function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return [102, 140, 93];
  return [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)];
}

function landColor(baseHex: string, height: number): string {
  const [r, g, b] = hexToRgb(baseHex);
  const elev = Math.max(0, Math.min(1, (height - 20) / 54));
  // Mix with shadow and highlight based on elevation
  const sr = Math.round(r * (0.82 + elev * 0.18) + elev * 10);
  const sg = Math.round(g * (0.82 + elev * 0.18) + elev * 8);
  const sb = Math.round(b * (0.82 + elev * 0.18) + elev * 4);
  return `rgb(${Math.min(255, sr)},${Math.min(255, sg)},${Math.min(255, sb)})`;
}

function oceanColor(height: number): string {
  const depth = 1 - Math.max(0, Math.min(1, height / 20));
  const r = Math.round(49 - depth * 34);
  const g = Math.round(102 - depth * 58);
  const b = Math.round(142 - depth * 69);
  return `rgb(${r},${g},${b})`;
}

export function resolvePolygons(
  cellsRaw: number[][],
  vertices: number[][],
  cellVertices: number[][],
): CellData[] {
  return cellsRaw.map((c, i) => {
    const indices = cellVertices[i] || [];
    const poly: Vertex[] = [];
    for (const idx of indices) {
      const v = vertices[idx];
      if (v && v.length >= 2) poly.push([v[0], v[1]]);
    }
    return {
      height: c[2],
      stateId: c[3],
      biomeId: c[4] ?? 0,
      polygon: poly.length >= 3 ? poly : null,
    };
  });
}

export function createAzgaarVectorLayer(options: VectorTileOptions): L.GridLayer {
  const { cells, stateColors, hiddenStates, showBorders = true, ...gridOpts } = options;

  // Build spatial index once
  if (!_spatialGrid) {
    _spatialGrid = buildSpatialIndex(cells);
  }

  const Layer = L.GridLayer.extend({
    createTile(coords: L.Coords) {
      const tile = document.createElement('canvas');
      const tileSize = this.getTileSize();
      tile.width = tileSize.x;
      tile.height = tileSize.y;

      const ctx = tile.getContext('2d');
      if (!ctx) return tile;

      // Calculate the bounds of this tile in map coordinates
      // In CRS.Simple: latlng = pixel / 2^zoom, so pixel = latlng * 2^zoom
      const scale = Math.pow(2, coords.z);
      const tileMinX = coords.x * tileSize.x / scale;
      const tileMaxX = (coords.x + 1) * tileSize.x / scale;
      // Y is inverted in Leaflet CRS.Simple (lat = -y)
      const tileMinY = coords.y * tileSize.y / scale;
      const tileMaxY = (coords.y + 1) * tileSize.y / scale;

      // The map uses: lat = -azgaarY, lng = azgaarX
      // So azgaarX = lng, azgaarY = -lat
      // tileMinX..tileMaxX is lng range = azgaarX range
      // tileMinY..tileMaxY is lat range (but lat = -azgaarY, so azgaarY = -lat)
      const azMinX = tileMinX;
      const azMaxX = tileMaxX;
      const azMinY = tileMinY; // this is -azgaarY for the "top" of tile
      const azMaxY = tileMaxY;

      // Find cells that overlap this tile (with padding)
      const pad = 2;
      const candidateIndices = getCellsInBounds(
        azMinX - pad, -azMaxY - pad,
        azMaxX + pad, -azMinY + pad,
      );

      if (candidateIndices.size === 0) {
        // Fill with ocean
        ctx.fillStyle = 'rgb(24,62,96)';
        ctx.fillRect(0, 0, tileSize.x, tileSize.y);
        return tile;
      }

      // Transform: map coord -> tile pixel
      const toTileX = (mapX: number) => (mapX - azMinX) * scale;
      const toTileY = (mapY: number) => (-mapY - azMinY) * scale; // lat = -y

      // Fill background
      ctx.fillStyle = 'rgb(24,62,96)';
      ctx.fillRect(0, 0, tileSize.x, tileSize.y);

      // Draw polygons
      ctx.lineJoin = 'round';
      for (const idx of candidateIndices) {
        const cell = cells[idx];
        if (!cell.polygon) continue;
        if (hiddenStates && hiddenStates.has(cell.stateId)) continue;

        const fill = cell.stateId === 0
          ? oceanColor(cell.height)
          : landColor(stateColors.get(cell.stateId) || '#668c5d', cell.height);

        ctx.beginPath();
        const p0 = cell.polygon[0];
        ctx.moveTo(toTileX(p0[0]), toTileY(p0[1]));
        for (let j = 1; j < cell.polygon.length; j++) {
          const p = cell.polygon[j];
          ctx.lineTo(toTileX(p[0]), toTileY(p[1]));
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();

        // Anti-alias seam fix
        ctx.strokeStyle = fill;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw borders between different states
      if (showBorders) {
        ctx.lineWidth = 1.5 / Math.max(1, scale * 0.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';

        for (const idx of candidateIndices) {
          const cell = cells[idx];
          if (!cell.polygon || cell.stateId === 0) continue;
          if (hiddenStates && hiddenStates.has(cell.stateId)) continue;

          // Coastal or high elevation highlights
          const coastal = cell.height <= 24 && cell.height > 0;
          const mountainous = cell.height >= 58;

          if (coastal) {
            ctx.beginPath();
            const p0 = cell.polygon[0];
            ctx.moveTo(toTileX(p0[0]), toTileY(p0[1]));
            for (let j = 1; j < cell.polygon.length; j++) {
              ctx.lineTo(toTileX(cell.polygon[j][0]), toTileY(cell.polygon[j][1]));
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(235,223,186,0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (mountainous) {
            ctx.beginPath();
            const p0 = cell.polygon[0];
            ctx.moveTo(toTileX(p0[0]), toTileY(p0[1]));
            for (let j = 1; j < cell.polygon.length; j++) {
              ctx.lineTo(toTileX(cell.polygon[j][0]), toTileY(cell.polygon[j][1]));
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(245,241,228,0.2)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      return tile;
    },
  });

  return new (Layer as any)({
    tileSize: 256,
    ...gridOpts,
  });
}

// Invalidate spatial index when data changes
export function resetSpatialIndex() {
  _spatialGrid = null;
}
