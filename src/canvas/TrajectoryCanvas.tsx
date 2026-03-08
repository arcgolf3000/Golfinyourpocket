import { useRef, useEffect, useCallback } from 'react';
import type { TrajectoryPoint } from '../engine/physics';

interface TrajectoryCanvasProps {
  width: number;
  height: number;
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number;
  apex: number; // in yards
}

const M_TO_YARDS = 1.09361;

export default function TrajectoryCanvas({ width, height, trajectory, animationProgress, apex }: TrajectoryCanvasProps) {
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

    const padL = 40, padR = 15, padT = 20, padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    if (!trajectory || trajectory.length < 2) {
      ctx.fillStyle = '#8b9ab5';
      ctx.font = '12px "DM Sans", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Take a shot to see trajectory', width / 2, height / 2);
      return;
    }

    // Find max values for scaling
    const maxX = trajectory[trajectory.length - 1].x * M_TO_YARDS;
    const maxY = Math.max(...trajectory.map(p => p.y)) * M_TO_YARDS;
    const scaleX = plotW / Math.max(maxX, 1);
    const scaleY = plotH / Math.max(maxY * 1.15, 1);

    // Grid lines
    ctx.strokeStyle = 'rgba(30, 42, 56, 0.5)';
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const yVal = (maxY * 1.15 * i) / ySteps;
      const py = padT + plotH - yVal * scaleY;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();

      ctx.fillStyle = '#8b9ab5';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(yVal)}`, padL - 5, py + 3);
    }

    // Ground line
    ctx.strokeStyle = '#1a472a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    const pointCount = Math.floor(trajectory.length * animationProgress);
    if (pointCount < 2) return;

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradient.addColorStop(0, 'rgba(255, 204, 51, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 204, 51, 0)');

    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    for (let i = 0; i < pointCount; i++) {
      const p = trajectory[i];
      const px = padL + p.x * M_TO_YARDS * scaleX;
      const py = padT + plotH - p.y * M_TO_YARDS * scaleY;
      ctx.lineTo(px, py);
    }
    const lastP = trajectory[pointCount - 1];
    ctx.lineTo(padL + lastP.x * M_TO_YARDS * scaleX, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Trajectory line
    ctx.beginPath();
    ctx.strokeStyle = '#ffcc33';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < pointCount; i++) {
      const p = trajectory[i];
      const px = padL + p.x * M_TO_YARDS * scaleX;
      const py = padT + plotH - p.y * M_TO_YARDS * scaleY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Apex marker (only show when animation is past apex)
    if (apex > 0 && animationProgress > 0.4) {
      const apexPoint = trajectory.reduce((max, p) => p.y > max.y ? p : max, trajectory[0]);
      const apexIdx = trajectory.indexOf(apexPoint);
      if (apexIdx < pointCount) {
        const ax = padL + apexPoint.x * M_TO_YARDS * scaleX;
        const ay = padT + plotH - apexPoint.y * M_TO_YARDS * scaleY;

        // Dashed vertical line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 204, 51, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Apex dot
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffcc33';
        ctx.fill();

        // Label
        ctx.fillStyle = '#ffcc33';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${apex} yds`, ax, ay - 10);
      }
    }

    // X-axis label
    ctx.fillStyle = '#8b9ab5';
    ctx.font = '9px "DM Sans", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Distance (yards)', width / 2, height - 5);
  }, [width, height, trajectory, animationProgress, apex]);

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
