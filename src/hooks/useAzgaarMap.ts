import { useState, useEffect, useRef } from 'react';
import { buildDetailedAzgaarMapImage } from '@/lib/azgaarMapRenderer';

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

// Scale factor retained for legacy world-distance systems; map markers now use raw stored village coordinates
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
let _cachedMapData: Omit<AzgaarMapData, 'loading'> | null = null;

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
  const [data, setData] = useState<AzgaarMapData>(() => _cachedMapData
    ? { ..._cachedMapData, loading: false }
    : {
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

    if (_cachedMapData) {
      setData({ ..._cachedMapData, loading: false });
      setMapImageUrl(_mapImageUrl);
      return;
    }

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
      const mapVertices: number[][] = Array.isArray(cellsJson.vp) ? cellsJson.vp : [];
      const cellVertices: number[][] = Array.isArray(cellsJson.cv) ? cellsJson.cv : [];

      _stateColors = new Map();
      for (const s of states) {
        _stateColors.set(s.id, s.color);
      }

      _cellsData = cells;
      _cachedMapData = {
        cells,
        burgs,
        states,
        biomes,
        mapWidth,
        mapHeight,
      };

      setData({ ..._cachedMapData, loading: false });

      window.requestAnimationFrame(() => {
        const url = buildDetailedAzgaarMapImage(cells, states, mapVertices, cellVertices, mapWidth, mapHeight) || null;
        _mapImageUrl = url;
        setMapImageUrl(url);
      });
    }).catch(err => {
      console.error('Failed to load Azgaar map data:', err);
      setData(prev => ({ ...prev, loading: false }));
    });
  }, []);

  return { ...data, mapImageUrl };
}
