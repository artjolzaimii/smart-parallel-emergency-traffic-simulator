import { Polyline, Tooltip } from 'react-leaflet';
import type { CongestionSegmentData } from '@/src/types/map';

interface CongestionLayerProps {
  segments: CongestionSegmentData[];
}

function densityToColor(density: number): string {
  if (density < 0.3) return '#22c55e';
  if (density < 0.55) return '#f59e0b';
  if (density < 0.75) return '#f97316';
  return '#ef4444';
}

function densityLabel(density: number): string {
  if (density < 0.3) return 'Free flow';
  if (density < 0.55) return 'Moderate';
  if (density < 0.75) return 'Heavy';
  return 'Gridlock';
}

export function CongestionLayer({ segments }: CongestionLayerProps) {
  return (
    <>
      {segments.map((seg) => {
        const positions = seg.points.map(
          (p) => [p.lat, p.lng] as [number, number],
        );
        const color = densityToColor(seg.density);

        return (
          <Polyline
            key={seg.id}
            positions={positions}
            pathOptions={{
              color,
              weight: 7,
              opacity: 0.65,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Tooltip sticky>
              <span className="font-mono text-xs">
                {seg.label ?? seg.id}: {densityLabel(seg.density)} (
                {Math.round(seg.density * 100)}%)
              </span>
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}
