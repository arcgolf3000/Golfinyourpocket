import { useRef, useEffect, useCallback } from 'react';
import type { TrajectoryPoint } from '../engine/physics';
import type { UnitSystem } from '../data/profile';

interface RangeCanvasProps {
  width: number;
  height: number;
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number; // 0 to 1
  shotLandings: Array<{ x: number; z: number; club: string }>;
  units: UnitSystem;
}

const DISTANCE_MARKERS = [50, 100, 150, 200, 250, 300]; // yards
const M_TO_YARDS = 1.09361;
const YARDS_TO_METRES = 0.9144;

// Perspective projection: project a 3D point (forward, height, lateral) to 2D screen
function project(
  forwardYards: number,
  heightYards: number,
  lateralYards: number,
  width: number,
  height: number,
  horizon: number,
  focalLength: number,
): { x: number; y: number; scale: number } | null {
  const depth = forwardYards + focalLength;
  if (depth <= 0) return null;
  const scale = focalLength / depth;
  const cx = width / 2;
  const groundY = height - 40; // tee position on screen
  const screenX = cx + lateralYards * scale * 3.5;
  const screenY = groundY - (groundY - horizon) * (1 - scale) - heightYards * scale * 3.5;
  return { x: screenX, y: screenY, scale };
}

export default function RangeCanvas({ width, height, trajectory, animationProgress, shotLandings, units }: RangeCanvasProps) {
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

    const horizon = height * 0.22;
    const groundY = height - 40;
    const focalLength = 60;

    // === SKY ===
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon + 20);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.5, '#132a45');
    skyGrad.addColorStop(1, '#1a3d55');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizon + 20);

    // === FAIRWAY (perspective ground) ===
    const fairwayGrad = ctx.createLinearGradient(0, horizon, 0, height);
    fairwayGrad.addColorStop(0, '#0e3d1c');
    fairwayGrad.addColorStop(0.3, '#14522e');
    fairwayGrad.addColorStop(0.7, '#1a6b38');
    fairwayGrad.addColorStop(1, '#1e7a40');
    ctx.fillStyle = fairwayGrad;
    ctx.fillRect(0, horizon, width, height - horizon);

    // Tree line at horizon
    ctx.fillStyle = '#0b2e15';
    for (let tx = 0; tx < width; tx += 18) {
      const th = 8 + Math.sin(tx * 0.3) * 4 + Math.cos(tx * 0.17) * 3;
      ctx.beginPath();
      ctx.arc(tx, horizon + 2, th, Math.PI, 0);
      ctx.fill();
    }

    // === MOWING STRIPES (perspective) ===
    for (let d = 10; d < 320; d += 15) {
      const p = project(d, 0, 0, width, height, horizon, focalLength);
      if (!p || p.y < horizon) continue;
      const stripe = project(d + 7, 0, 0, width, height, horizon, focalLength);
      if (!stripe) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(0, p.y, width, stripe.y - p.y);
    }

    // === PERSPECTIVE LANE LINES ===
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (const offset of [-40, -20, 20, 40]) {
      ctx.beginPath();
      const start = project(0, 0, offset, width, height, horizon, focalLength);
      const end = project(300, 0, offset, width, height, horizon, focalLength);
      if (start && end) {
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    }

    // === DISTANCE MARKERS & TARGET GREENS ===
    for (const dist of DISTANCE_MARKERS) {
      const p = project(dist, 0, 0, width, height, horizon, focalLength);
      if (!p || p.y < horizon + 5) continue;

      // Distance line across fairway
      const pLeft = project(dist, 0, -50, width, height, horizon, focalLength);
      const pRight = project(dist, 0, 50, width, height, horizon, focalLength);
      if (pLeft && pRight) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Target green
      const greenR = Math.max(3, 14 * p.scale);
      const greenGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, greenR);
      greenGrad.addColorStop(0, 'rgba(34, 180, 34, 0.6)');
      greenGrad.addColorStop(0.6, 'rgba(34, 139, 34, 0.3)');
      greenGrad.addColorStop(1, 'rgba(34, 139, 34, 0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, greenR, 0, 2 * Math.PI);
      ctx.fillStyle = greenGrad;
      ctx.fill();

      // Flag pin
      const flagHeight = Math.max(4, 12 * p.scale);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + p.scale * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - flagHeight);
      ctx.stroke();

      // Flag
      ctx.fillStyle = dist <= 150 ? 'rgba(255, 80, 80, 0.8)' : 'rgba(255, 200, 50, 0.7)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - flagHeight);
      ctx.lineTo(p.x + 4 * p.scale + 2, p.y - flagHeight + 2);
      ctx.lineTo(p.x, p.y - flagHeight + 4);
      ctx.closePath();
      ctx.fill();

      // Distance label
      const distLabel = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + p.scale * 0.3})`;
      ctx.font = `${Math.max(8, Math.round(11 * p.scale))}px "DM Sans", system-ui`;
      ctx.textAlign = 'right';
      const labelP = project(dist, 0, 30, width, height, horizon, focalLength);
      if (labelP && labelP.x < width - 5) {
        ctx.fillText(distLabel, labelP.x, labelP.y - 2);
      }
    }

    // === TEE BOX ===
    const teeW = 44, teeH = 14;
    const teeGrad = ctx.createLinearGradient(
      width / 2 - teeW / 2, groundY - teeH / 2,
      width / 2 + teeW / 2, groundY + teeH / 2,
    );
    teeGrad.addColorStop(0, '#2d8a4e');
    teeGrad.addColorStop(1, '#1f6b38');
    ctx.fillStyle = teeGrad;
    ctx.beginPath();
    ctx.roundRect(width / 2 - teeW / 2, groundY - teeH / 2, teeW, teeH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(width / 2 - teeW / 2, groundY - teeH / 2, teeW, teeH, 4);
    ctx.stroke();

    // Tee markers
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(width / 2 - 10, groundY, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width / 2 + 10, groundY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // TEE label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '9px "DM Sans", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('TEE', width / 2, groundY + 20);

    // === PREVIOUS SHOT LANDINGS ===
    for (const landing of shotLandings) {
      const lx = landing.x * M_TO_YARDS;
      const lz = landing.z * M_TO_YARDS;
      const lp = project(lx, 0, lz, width, height, horizon, focalLength);
      if (!lp || lp.y < horizon) continue;

      const r = Math.max(2, 4 * lp.scale);
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, r * 2, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // === PREDICTIVE LANDING ZONE (Toptracer style) ===
    if (trajectory && trajectory.length > 2 && animationProgress > 0) {
      const finalPoint = trajectory[trajectory.length - 1];
      const landX = finalPoint.x * M_TO_YARDS;
      const landZ = finalPoint.z * M_TO_YARDS;
      const landP = project(landX, 0, landZ, width, height, horizon, focalLength);

      if (landP && landP.y > horizon) {
        // Pulsing ring
        const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
        const landR = Math.max(4, 12 * landP.scale);

        // Outer ring
        ctx.strokeStyle = `rgba(255, 204, 51, ${0.3 * pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(landP.x, landP.y, landR * 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        // Inner target
        ctx.beginPath();
        ctx.arc(landP.x, landP.y, landR, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 204, 51, ${0.15 * pulse})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 204, 51, ${0.6 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Landing distance label
        if (animationProgress < 1) {
          const landDist = units === 'metric'
            ? `${Math.round(landX * YARDS_TO_METRES)}m`
            : `${Math.round(landX)} yds`;
          ctx.font = `${Math.max(9, Math.round(11 * landP.scale))}px "DM Sans", system-ui`;
          ctx.textAlign = 'center';
          const tw = ctx.measureText(landDist).width + 10;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.roundRect(landP.x - tw / 2, landP.y - landR * 2 - 18, tw, 16, 3);
          ctx.fill();
          ctx.fillStyle = '#ffcc33';
          ctx.fillText(landDist, landP.x, landP.y - landR * 2 - 6);
        }
      }
    }

    // === ANIMATED BALL FLIGHT (3D perspective) ===
    if (trajectory && animationProgress > 0) {
      const pointCount = Math.floor(trajectory.length * animationProgress);

      // Trail
      if (pointCount > 1) {
        for (let i = 1; i < pointCount; i++) {
          const p = trajectory[i];
          const prev = trajectory[i - 1];
          const pp = project(p.x * M_TO_YARDS, p.y * M_TO_YARDS, p.z * M_TO_YARDS, width, height, horizon, focalLength);
          const prevP = project(prev.x * M_TO_YARDS, prev.y * M_TO_YARDS, prev.z * M_TO_YARDS, width, height, horizon, focalLength);
          if (!pp || !prevP) continue;

          const alpha = 0.1 + (i / pointCount) * 0.5;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = Math.max(1, 2 * pp.scale);
          ctx.moveTo(prevP.x, prevP.y);
          ctx.lineTo(pp.x, pp.y);
          ctx.stroke();
        }

        // Shadow on ground
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < pointCount; i++) {
          const p = trajectory[i];
          const sp = project(p.x * M_TO_YARDS, 0, p.z * M_TO_YARDS, width, height, horizon, focalLength);
          if (!sp) continue;
          if (i === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
      }

      // Current ball position
      if (pointCount > 0 && pointCount <= trajectory.length) {
        const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
        const bp = project(
          current.x * M_TO_YARDS,
          current.y * M_TO_YARDS,
          current.z * M_TO_YARDS,
          width, height, horizon, focalLength,
        );
        if (bp) {
          const ballSize = Math.max(3, 6 * bp.scale);

          // Glow
          const glow = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, ballSize * 4);
          glow.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          glow.addColorStop(0.3, 'rgba(255, 204, 51, 0.3)');
          glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, ballSize * 4, 0, 2 * Math.PI);
          ctx.fillStyle = glow;
          ctx.fill();

          // Ball
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, ballSize, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Vertical line to shadow (ball to ground)
          const shadowP = project(current.x * M_TO_YARDS, 0, current.z * M_TO_YARDS, width, height, horizon, focalLength);
          if (shadowP && current.y * M_TO_YARDS > 3) {
            ctx.strokeStyle = 'rgba(255, 204, 51, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(bp.x, bp.y);
            ctx.lineTo(shadowP.x, shadowP.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    }
  }, [width, height, trajectory, animationProgress, shotLandings, units]);

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
