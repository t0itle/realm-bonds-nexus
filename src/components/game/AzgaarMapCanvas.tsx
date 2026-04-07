import { useRef, useEffect, memo } from 'react';
import { getOffscreenCanvas, AZGAAR_SCALE } from '@/hooks/useAzgaarMap';

interface AzgaarMapCanvasProps {
  camera: { cx: number; cy: number; ppu: number };
  containerWidth: number;
  containerHeight: number;
}

/**
 * Renders the pre-built Azgaar map cells canvas as the world background.
 * Efficiently blits the relevant portion of the offscreen canvas based on camera.
 */
function AzgaarMapCanvasInner({ camera, containerWidth, containerHeight }: AzgaarMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const offscreen = getOffscreenCanvas();
    if (!canvas || !offscreen || containerWidth === 0 || containerHeight === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Clear
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    // The offscreen canvas is at 2x Azgaar resolution
    const offscreenScale = 2;

    // Camera is in world coords. World coords = Azgaar * AZGAAR_SCALE
    // So Azgaar coords = world / AZGAAR_SCALE
    // Offscreen canvas pixel = Azgaar * offscreenScale

    // What world region is visible?
    const viewWorldW = containerWidth / camera.ppu;
    const viewWorldH = containerHeight / camera.ppu;
    const worldLeft = camera.cx - viewWorldW / 2;
    const worldTop = camera.cy - viewWorldH / 2;

    // Convert to offscreen canvas pixels
    const srcX = (worldLeft / AZGAAR_SCALE) * offscreenScale;
    const srcY = (worldTop / AZGAAR_SCALE) * offscreenScale;
    const srcW = (viewWorldW / AZGAAR_SCALE) * offscreenScale;
    const srcH = (viewWorldH / AZGAAR_SCALE) * offscreenScale;

    // Draw the relevant portion of the offscreen canvas to fill the screen
    ctx.imageSmoothingEnabled = camera.ppu < 0.005; // smooth when zoomed out, crisp when zoomed in
    ctx.drawImage(
      offscreen,
      srcX, srcY, srcW, srcH,
      0, 0, containerWidth, containerHeight
    );
  }, [camera.cx, camera.cy, camera.ppu, containerWidth, containerHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

export const AzgaarMapCanvas = memo(AzgaarMapCanvasInner);
