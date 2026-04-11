import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { createAzgaarVectorLayer, resetSpatialIndex } from '@/lib/azgaarVectorTileLayer';

type Vertex = [number, number];

interface CellData {
  height: number;
  stateId: number;
  polygon: Vertex[] | null;
  biomeId?: number;
}

interface Props {
  cells: CellData[];
  stateColors: Map<number, string>;
  hiddenStates?: Set<number>;
  showBorders?: boolean;
}

export default function AzgaarVectorLayer({ cells, stateColors, hiddenStates, showBorders = true }: Props) {
  const map = useMap();
  const layerRef = useRef<L.GridLayer | null>(null);

  useEffect(() => {
    if (!cells.length) return;

    // Remove old layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    resetSpatialIndex();

    const layer = createAzgaarVectorLayer({
      cells,
      stateColors,
      hiddenStates,
      showBorders,
      minZoom: -2,
      maxZoom: 10,
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, cells, stateColors, hiddenStates, showBorders]);

  return null;
}
