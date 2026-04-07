import { useState, useEffect, useRef } from 'react';

export interface AzgaarCell {
  x: number;
  y: number;
  height: number;
  stateId: number;
  cultureId: number;
  burgId: number;
}

export interface AzgaarBurg {
  id: number;
  name: string;
  x: number;
  y: number;
  state: number;
  culture: number;
  population: number;
  capital: boolean;
  port: boolean;
  citadel: boolean;
  walls: boolean;
  temple: boolean;
  type: string;
  group: string;
}

export interface AzgaarState {
  id: number;
  name: string;
  color: string;
  capital: number;
  culture: number;
  type: string;
}

export interface AzgaarBiome {
  id: number;
  name: string;
  color: string;
}

export interface AzgaarMapData {
  cells: AzgaarCell[];
  burgs: AzgaarBurg[];
  states: AzgaarState[];
  biomes: AzgaarBiome[];
  mapWidth: number;
  mapHeight: number;
  loading: boolean;
}

// Scale factor: Azgaar pixels -> world coordinates
export const AZGAAR_SCALE = 1000;

export function azgaarToWorld(ax: number, ay: number): { x: number; y: number } {
  return { x: ax * AZGAAR_SCALE, y: ay * AZGAAR_SCALE };
}

export function worldToAzgaar(wx: number, wy: number): { x: number; y: number } {
  return { x: wx / AZGAAR_SCALE, y: wy / AZGAAR_SCALE };
}

// Offscreen canvas data URL for Leaflet ImageOverlay
let _mapImageUrl: string | null = null;
let _stateColors: Map<number, string> = new Map();
let _cellsData: AzgaarCell[] = [];

export function getMapImageUrl() {
  return _mapImageUrl;
}

export function getStateColors() {
  return _stateColors;
}

export function getCellsData() {
  return _cellsData;
}

export function useAzgaarMap(): AzgaarMapData & { mapImageUrl: string | null } {
  const [data, setData] = useState<AzgaarMapData>({
    cells: [],
    burgs: [],
    states: [],
    biomes: [],
    mapWidth: 384,
    mapHeight: 697,
    loading: true,
  });
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(_mapImageUrl);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    Promise.all([
      fetch('/map_cells.json').then(r => r.json()),
      fetch('/world_data.json').then(r => r.json()),
    ]).then(([cellsJson, worldJson]) => {
      const cells: AzgaarCell[] = cellsJson.cells.map((c: number[]) => ({
        x: c[0],
        y: c[1],
        height: c[2],
        stateId: c[3],
        cultureId: c[4],
        burgId: c[5],
      }));

      const burgs: AzgaarBurg[] = (worldJson.burgs || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        x: b.x,
        y: b.y,
        state: b.state,
        culture: b.culture,
        population: b.population,
        capital: b.capital === 1,
        port: b.port === 1,
        citadel: b.citadel === 1,
        walls: b.walls === 1,
        temple: b.temple === 1,
        type: b.type,
        group: b.group,
      }));

      const states: AzgaarState[] = (worldJson.states || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        capital: s.capital,
        culture: s.culture,
        type: s.type,
      }));

      const biomes: AzgaarBiome[] = (worldJson.biomes || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        color: b.color,
      }));

      const mapWidth = worldJson.info?.width || 384;
      const mapHeight = worldJson.info?.height || 697;

      _stateColors = new Map();
      for (const s of states) {
        _stateColors.set(s.id, s.color);
      }

      _cellsData = cells;

      // Build offscreen canvas and convert to data URL
      const url = buildMapImage(cells, states, mapWidth, mapHeight);
      _mapImageUrl = url;
      setMapImageUrl(url);

      setData({
        cells,
        burgs,
        states,
        biomes,
        mapWidth,
        mapHeight,
        loading: false,
      });
    }).catch(err => {
      console.error('Failed to load Azgaar map data:', err);
      setData(prev => ({ ...prev, loading: false }));
    });
  }, []);

  return { ...data, mapImageUrl };
}

function buildMapImage(cells: AzgaarCell[], states: AzgaarState[], mapWidth: number, mapHeight: number): string {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = mapWidth * scale;
  canvas.height = mapHeight * scale;
  const ctx = canvas.getContext('2d')!;

  // Ocean background
  ctx.fillStyle = '#1a3a5c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stateColorMap = new Map<number, string>();
  for (const s of states) {
    stateColorMap.set(s.id, s.color);
  }

  const cellSize = 2.2 * scale;
  for (const cell of cells) {
    const cx = cell.x * scale;
    const cy = cell.y * scale;

    if (cell.stateId === 0) {
      const depth = Math.max(0, 20 - cell.height) / 20;
      const r = Math.floor(20 + depth * 10);
      const g = Math.floor(45 + depth * 20);
      const b = Math.floor(80 + depth * 30);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
    } else {
      const baseColor = stateColorMap.get(cell.stateId) || '#4a7c59';
      const rgb = hexToRgb(baseColor);
      const hMod = (cell.height - 20) / 54;
      const brightness = 0.7 + hMod * 0.4;
      ctx.fillStyle = `rgb(${clamp(rgb.r * brightness)},${clamp(rgb.g * brightness)},${clamp(rgb.b * brightness)})`;
    }

    ctx.fillRect(cx - cellSize / 2, cy - cellSize / 2, cellSize, cellSize);
  }

  return canvas.toDataURL('image/png');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 100, g: 140, b: 100 };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
