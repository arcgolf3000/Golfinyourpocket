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

    // Origin point (tee position)
    const originX = width / 2;
    const originY = height - 40;
    const scale = (height - 70) / 300; // pixels per yard

    // === BACKGROUND: gradient sky to fairway green ===
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0b2e1a');    // dark green (far end)
    bgGrad.addColorStop(0.6, '#14522e');  // mid green
    bgGrad.addColorStop(0.85, '#1a6b38'); // brighter near tee
    bgGrad.addColorStop(1, '#1e7a40');    // brightest at bottom
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // === MOWING STRIPES (alternating lighter/darker) ===
    const stripeHeight = 12;
    for (let i = 0; i < height; i += stripeHeight * 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(0, i, width, stripeHeight);
    }

    // === RANGE BOUNDARY LINES (subtle side lines) ===
    const boundaryInset = width * 0.08;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    // Left boundary
    ctx.beginPath();
    ctx.moveTo(boundaryInset, 0);
    ctx.lineTo(originX - 20, originY);
    ctx.stroke();
    // Right boundary
    ctx.beginPath();
    ctx.moveTo(width - boundaryInset, 0);
    ctx.lineTo(originX + 20, originY);
    ctx.stroke();

    // === DISTANCE ARCS & TARGET GREENS ===
    for (const dist of DISTANCE_ARCS) {
      const r = dist * scale;

      // Target green circle at each distance
      const targetY = originY - r;
      if (targetY > 5) {
        // Green circle (target)
        const greenR = Math.max(6, 18 - dist * 0.04);
        const greenGrad = ctx.createRadialGradient(originX, targetY, 0, originX, targetY, greenR);
        greenGrad.addColorStop(0, 'rgba(34, 139, 34, 0.5)');
        greenGrad.addColorStop(0.7, 'rgba(34, 139, 34, 0.25)');
        greenGrad.addColorStop(1, 'rgba(34, 139, 34, 0)');
        ctx.beginPath();
        ctx.arc(originX, targetY, greenR, 0, 2 * Math.PI);
        ctx.fillStyle = greenGrad;
        ctx.fill();

        // Flag pin
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(originX, targetY);
        ctx.lineTo(originX, targetY - 10);
        ctx.stroke();

        // Flag
        ctx.fillStyle = dist <= 150 ? 'rgba(255, 80, 80, 0.7)' : 'rgba(255, 200, 50, 0.6)';
        ctx.beginPath();
        ctx.moveTo(originX, targetY - 10);
        ctx.lineTo(originX + 6, targetY - 7);
        ctx.lineTo(originX, targetY - 4);
        ctx.closePath();
        ctx.fill();
      }

      // Distance arc (subtle)
      ctx.beginPath();
      ctx.arc(originX, originY, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Distance label (on right side)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '10px "DM Sans", system-ui';
      ctx.textAlign = 'left';
      const labelX = originX + r * 0.7 + 8;
      const labelY = originY - r * 0.7;
      if (labelY > 10 && labelX < width - 20) {
        ctx.fillText(`${dist}`, labelX, labelY);
      }
    }

    // === TEE BOX ===
    const teeW = 40;
    const teeH = 16;
    const teeGrad = ctx.createLinearGradient(
      originX - teeW / 2, originY - teeH / 2,
      originX + teeW / 2, originY + teeH / 2
    );
    teeGrad.addColorStop(0, '#2d8a4e');
    teeGrad.addColorStop(1, '#1f6b38');
    ctx.fillStyle = teeGrad;
    ctx.beginPath();
    ctx.roundRect(originX - teeW / 2, originY - teeH / 2, teeW, teeH, 4);
    ctx.fill();

    // Tee box outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(originX - teeW / 2, originY - teeH / 2, teeW, teeH, 4);
    ctx.stroke();

    // Tee markers (two small colored markers)
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(originX - 10, originY, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(originX + 10, originY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // === PREVIOUS SHOT LANDINGS ===
    for (const landing of shotLandings) {
      const lx = landing.x * M_TO_YARDS;
      const lz = landing.z * M_TO_YARDS;
      const px = originX + lz * scale;
      const py = originY - lx * scale;

      // Divot/landing mark
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // === ANIMATED BALL FLIGHT ===
    if (trajectory && animationProgress > 0) {
      const pointCount = Math.floor(trajectory.length * animationProgress);

      // Shadow on ground (gets lighter as ball goes higher)
      if (pointCount > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 2;
        for (let i = 0; i < pointCount; i++) {
          const p = trajectory[i];
          const px = originX + (p.z * M_TO_YARDS) * scale;
          const py = originY - (p.x * M_TO_YARDS) * scale;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Trail (fading from dim to bright)
      for (let i = 1; i < pointCount; i++) {
        const p = trajectory[i];
        const prev = trajectory[i - 1];
        const px = originX + (p.z * M_TO_YARDS) * scale;
        const py = originY - (p.x * M_TO_YARDS) * scale;
        const ppx = originX + (prev.z * M_TO_YARDS) * scale;
        const ppy = originY - (prev.x * M_TO_YARDS) * scale;

        const alpha = 0.15 + (i / pointCount) * 0.65;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 1.5 + (i / pointCount) * 1;
        ctx.moveTo(ppx, ppy);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      // Current ball position
      if (pointCount > 0 && pointCount <= trajectory.length) {
        const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
        const bx = originX + (current.z * M_TO_YARDS) * scale;
        const by = originY - (current.x * M_TO_YARDS) * scale;

        // Outer glow
        const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 12);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        glow.addColorStop(0.3, 'rgba(255, 204, 51, 0.3)');
        glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
        ctx.beginPath();
        ctx.arc(bx, by, 12, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();

        // Ball
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    // === "TEE" label ===
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '9px "DM Sans", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('TEE', originX, originY + 22);
  }, [width, height, trajectory, animationProgress, shotLandings]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-xl"
    />
  );
}
