import { useRef, useEffect, useCallback } from 'react';
import type { TrajectoryPoint } from '../engine/physics';

interface RangeCanvasProps {
  width: number;
  height: number;
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number; // 0 to 1
  shotLandings: Array<{ x: number; z: number; club: string }>;
}

const DISTANCE_ARCS = [50, 100, 150, 200, 250, 300]; // yards
const M_TO_YARDS = 1.09361;

export default function RangeCanvas({ width, height, trajectory, animationProgress, shotLandings }: RangeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, width, height);

    // Range grass texture (subtle lines)
    ctx.strokeStyle = 'rgba(20, 60, 20, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < height; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Origin point (tee position)
    const originX = width / 2;
    const originY = height - 30;
    const scale = (height - 60) / 300; // pixels per yard

    // Distance arcs
    for (const dist of DISTANCE_ARCS) {
      const r = dist * scale;
      ctx.beginPath();
      ctx.arc(originX, originY, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 204, 51, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Distance label
      ctx.fillStyle = 'rgba(255, 204, 51, 0.35)';
      ctx.font = '10px "DM Sans", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist}`, originX + r + 14, originY - 4);
    }

    // Previous shot landings
    for (const landing of shotLandings) {
      const lx = landing.x * M_TO_YARDS;
      const lz = landing.z * M_TO_YARDS;
      const px = originX + lz * scale;
      const py = originY - lx * scale;

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 204, 51, 0.25)';
      ctx.fill();
    }

    // Animated ball flight
    if (trajectory && animationProgress > 0) {
      const pointCount = Math.floor(trajectory.length * animationProgress);

      // Trail
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 204, 51, 0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < pointCount; i++) {
        const p = trajectory[i];
        const px = originX + (p.z * M_TO_YARDS) * scale;
        const py = originY - (p.x * M_TO_YARDS) * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current ball position
      if (pointCount > 0 && pointCount <= trajectory.length) {
        const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
        const bx = originX + (current.z * M_TO_YARDS) * scale;
        const by = originY - (current.x * M_TO_YARDS) * scale;

        // Glow
        const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, 8);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 204, 51, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 204, 51, 0)');
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Ball
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    // Tee marker
    ctx.beginPath();
    ctx.arc(originX, originY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffcc33';
    ctx.fill();
  }, [width, height, trajectory, animationProgress, shotLandings]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-lg border border-dark-border"
    />
  );
}
