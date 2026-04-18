import { CircleMarker, Polygon, Polyline } from 'react-leaflet';

type Props = {
  mapHeight: number;
  mapWidth: number;
};

export default function OuroborosBoundary({ mapHeight, mapWidth }: Props) {
  const inset = 12;
  const left = inset;
  const right = mapWidth - inset;
  const top = inset;
  const bottom = mapHeight - inset;
  const centerX = mapWidth / 2;
  const headY = top + 6;

  const ring = [
    [-top, centerX - 22],
    [-top, left + 34],
    [-(top + 4), left + 10],
    [-(top + 22), left],
    [-(mapHeight / 2), left],
    [-(bottom - 18), left + 4],
    [-bottom, left + 26],
    [-bottom, centerX],
    [-bottom, right - 26],
    [-(bottom - 18), right - 4],
    [-(mapHeight / 2), right],
    [-(top + 22), right],
    [-(top + 4), right - 10],
    [-top, right - 34],
    [-top, centerX + 8],
  ] as [number, number][];

  const head = [
    [-headY, centerX - 4],
    [-(headY - 10), centerX + 18],
    [-(headY + 10), centerX + 16],
  ] as [number, number][];

  return (
    <>
      <Polyline
        pathOptions={{ color: 'hsl(var(--primary))', dashArray: '16 10', lineCap: 'round', lineJoin: 'round', opacity: 0.82, weight: 5 }}
        positions={ring}
      />
      <Polyline
        pathOptions={{ color: 'hsl(var(--foreground))', dashArray: '2 12', lineCap: 'round', lineJoin: 'round', opacity: 0.35, weight: 1.4 }}
        positions={ring}
      />
      <Polygon pathOptions={{ color: 'hsl(var(--foreground))', fillColor: 'hsl(var(--primary))', fillOpacity: 0.88, opacity: 0.9, weight: 1.5 }} positions={head} />
      <CircleMarker center={[-headY, centerX + 4]} pathOptions={{ color: 'hsl(var(--background))', fillColor: 'hsl(var(--background))', fillOpacity: 1, opacity: 1, weight: 0.5 }} radius={1.8} />
      <CircleMarker center={[-top, centerX + 14]} pathOptions={{ color: 'hsl(var(--primary))', fillColor: 'hsl(var(--background))', fillOpacity: 1, opacity: 1, weight: 2 }} radius={4.2} />
    </>
  );
}