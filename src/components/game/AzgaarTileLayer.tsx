import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOverlay } from 'react-leaflet';
import type L from 'leaflet';
import { buildDetailedAzgaarMapTile, prepareAzgaarTileData } from '@/lib/azgaarMapTiles';
import type { AzgaarCell, AzgaarState } from '@/hooks/useAzgaarMap';

type Props = {
  cells: AzgaarCell[];
  cellVertices: number[][];
  mapHeight: number;
  mapWidth: number;
  states: AzgaarState[];
  vertices: number[][];
  viewportBounds: L.LatLngBounds | null;
  zoom: number;
};

const TILE_SIZE = 96;
const TILE_OVERSCAN = 48;

export default function AzgaarTileLayer({
  cells,
  cellVertices,
  mapHeight,
  mapWidth,
  states,
  vertices,
  viewportBounds,
  zoom,
}: Props) {
  const [version, setVersion] = useState(0);
  const tileCacheRef = useRef(new Map<string, string>());

  const prepared = useMemo(() => {
    if (cells.length === 0 || vertices.length === 0 || cellVertices.length === 0) return null;
    return prepareAzgaarTileData(cells, states, vertices, cellVertices, mapWidth, mapHeight, TILE_SIZE);
  }, [cellVertices, cells, mapHeight, mapWidth, states, vertices]);

  const visibleTiles = useMemo(() => {
    if (!viewportBounds) return [] as Array<{ bounds: [[number, number], [number, number]]; key: string; scale: number; tileX: number; tileY: number }>;

    const west = Math.max(0, viewportBounds.getWest() - TILE_OVERSCAN);
    const east = Math.min(mapWidth, viewportBounds.getEast() + TILE_OVERSCAN);
    const north = Math.max(0, -viewportBounds.getNorth() - TILE_OVERSCAN);
    const south = Math.min(mapHeight, -viewportBounds.getSouth() + TILE_OVERSCAN);
    const startTileX = Math.max(0, Math.floor(west / TILE_SIZE));
    const endTileX = Math.max(startTileX, Math.floor(Math.max(west, east - 0.001) / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(north / TILE_SIZE));
    const endTileY = Math.max(startTileY, Math.floor(Math.max(north, south - 0.001) / TILE_SIZE));
    const scale = getTileScale(zoom);
    const tiles = [] as Array<{ bounds: [[number, number], [number, number]]; key: string; scale: number; tileX: number; tileY: number }>;

    for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
      for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
        const tileLeft = tileX * TILE_SIZE;
        const tileTop = tileY * TILE_SIZE;
        const tileRight = Math.min(tileLeft + TILE_SIZE, mapWidth);
        const tileBottom = Math.min(tileTop + TILE_SIZE, mapHeight);
        tiles.push({
          bounds: [[-tileBottom, tileLeft], [-tileTop, tileRight]],
          key: `${tileX}:${tileY}:${scale}`,
          scale,
          tileX: tileLeft,
          tileY: tileTop,
        });
      }
    }

    return tiles;
  }, [mapHeight, mapWidth, viewportBounds, zoom]);

  useEffect(() => {
    if (!prepared || visibleTiles.length === 0) return;

    const missing = visibleTiles.filter((tile) => !tileCacheRef.current.has(tile.key));
    if (missing.length === 0) return;

    let cancelled = false;
    let raf = 0;
    const queue = [...missing];

    const processNext = () => {
      if (cancelled) return;
      const nextTile = queue.shift();
      if (!nextTile) return;
      tileCacheRef.current.set(nextTile.key, buildDetailedAzgaarMapTile(prepared, nextTile.tileX, nextTile.tileY, nextTile.scale));
      setVersion((current) => current + 1);
      if (queue.length > 0) raf = window.requestAnimationFrame(processNext);
    };

    raf = window.requestAnimationFrame(processNext);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [prepared, visibleTiles]);

  return (
    <>
      {visibleTiles.map((tile) => {
        const url = tileCacheRef.current.get(tile.key);
        if (!url) return null;
        return <ImageOverlay key={`${tile.key}-${version}`} bounds={tile.bounds} opacity={1} url={url} />;
      })}
    </>
  );
}

function getTileScale(zoom: number) {
  if (zoom <= 1) return 8;
  if (zoom <= 3) return 12;
  if (zoom <= 5) return 16;
  if (zoom <= 7) return 22;
  return 28;
}