import { useRef, useEffect, useCallback } from 'react';
import type { TrajectoryPoint } from '../engine/physics';
import type { UnitSystem } from '../data/profile';

interface TrajectoryCanvasProps {
  width: number;
  height: number;
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number;
  apex: number; // in yards
  units: UnitSystem;
}

const M_TO_YARDS = 1.09361;
const YARDS_TO_METRES = 0.9144;

export default function TrajectoryCanvas({ width, height, trajectory, animationProgress, apex, units }: TrajectoryCanvasProps) {
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

    // Background: sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.55, '#132a45');
    skyGrad.addColorStop(0.7, '#1a3d55');
    skyGrad.addColorStop(0.8, '#0e3d1c');
    skyGrad.addColorStop(0.9, '#1a6b38');
    skyGrad.addColorStop(1, '#1e7a40');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground line (turf)
    const groundLineY = padT + plotH;
    ctx.fillStyle = '#2d8a4e';
    ctx.fillRect(padL, groundLineY - 1, plotW, 3);

    if (!trajectory || trajectory.length < 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const ySteps = 4;
    for (let i = 1; i <= ySteps; i++) {
      const yVal = (maxY * 1.15 * i) / ySteps;
      const py = padT + plotH - yVal * scaleY;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(yVal)}`, padL - 5, py + 3);
    }

    // === PREDICTED FULL TRAJECTORY (shown immediately, faded) ===
    if (animationProgress < 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 204, 51, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i < trajectory.length; i++) {
        const p = trajectory[i];
        const px = padL + p.x * M_TO_YARDS * scaleX;
        const py = padT + plotH - p.y * M_TO_YARDS * scaleY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Predicted landing marker
      const finalP = trajectory[trajectory.length - 1];
      const finalPx = padL + finalP.x * M_TO_YARDS * scaleX;
      const finalPy = padT + plotH;
      const pulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.3;

      ctx.strokeStyle = `rgba(255, 204, 51, ${0.4 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(finalPx, finalPy, 8, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 204, 51, ${0.15 * pulse})`;
      ctx.beginPath();
      ctx.arc(finalPx, finalPy, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Predicted distance label
      const predDist = units === 'metric'
        ? `${Math.round(finalP.x * M_TO_YARDS * YARDS_TO_METRES)}m`
        : `${Math.round(finalP.x * M_TO_YARDS)} yds`;
      ctx.font = '9px "DM Sans", system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 204, 51, ${0.6 * pulse})`;
      ctx.fillText(predDist, finalPx, finalPy + 14);
    }

    const pointCount = Math.floor(trajectory.length * animationProgress);
    if (pointCount < 2) return;

    // Gradient fill under curve
    const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradient.addColorStop(0, 'rgba(255, 204, 51, 0.12)');
    gradient.addColorStop(0.5, 'rgba(34, 139, 34, 0.08)');
    gradient.addColorStop(1, 'rgba(34, 139, 34, 0)');

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

    // Trajectory line (Toptracer style - gradient from red to yellow)
    ctx.shadowColor = 'rgba(255, 204, 51, 0.4)';
    ctx.shadowBlur = 6;
    for (let i = 1; i < pointCount; i++) {
      const p = trajectory[i];
      const prev = trajectory[i - 1];
      const px = padL + p.x * M_TO_YARDS * scaleX;
      const py = padT + plotH - p.y * M_TO_YARDS * scaleY;
      const ppx = padL + prev.x * M_TO_YARDS * scaleX;
      const ppy = padT + plotH - prev.y * M_TO_YARDS * scaleY;

      const t = i / trajectory.length;
      // Color gradient: red → yellow → white along trajectory
      const r = Math.round(255);
      const g = Math.round(80 + t * 175);
      const b = Math.round(t > 0.7 ? (t - 0.7) / 0.3 * 200 : 40);

      ctx.beginPath();
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = 2.5;
      ctx.moveTo(ppx, ppy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Current ball position
    if (pointCount > 0) {
      const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
      const bx = padL + current.x * M_TO_YARDS * scaleX;
      const by = padT + plotH - current.y * M_TO_YARDS * scaleY;

      // Glow
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 14);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      glow.addColorStop(0.3, 'rgba(255, 204, 51, 0.4)');
      glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      // Ball
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Apex marker
    if (apex > 0 && animationProgress > 0.4) {
      const apexPoint = trajectory.reduce((max, p) => p.y > max.y ? p : max, trajectory[0]);
      const apexIdx = trajectory.indexOf(apexPoint);
      if (apexIdx < pointCount) {
        const ax = padL + apexPoint.x * M_TO_YARDS * scaleX;
        const ay = padT + plotH - apexPoint.y * M_TO_YARDS * scaleY;

        // Dashed vertical line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 204, 51, 0.3)';
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

        // Label with background
        const apexDisplay = units === 'metric' ? Math.round(apex * YARDS_TO_METRES) : apex;
        const label = `${apexDisplay} ${units === 'metric' ? 'm' : 'yds'}`;
        ctx.font = '10px "DM Sans", system-ui';
        ctx.textAlign = 'center';
        const metrics = ctx.measureText(label);
        const lw = metrics.width + 8;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(ax - lw / 2, ay - 22, lw, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#ffcc33';
        ctx.fillText(label, ax, ay - 11);
      }
    }

    // X-axis label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '9px "DM Sans", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(units === 'metric' ? 'Distance (metres)' : 'Distance (yards)', width / 2, height - 5);
  }, [width, height, trajectory, animationProgress, apex, units]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-xl"
    />
  );
}
