import { useRef, useEffect, useCallback } from 'react';
import type { TrajectoryPoint } from '../engine/physics';
import type { UnitSystem } from '../data/profile';

export type RangeViewType = 'ground' | 'birdseye';

interface RangeCanvasProps {
  width: number;
  height: number;
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number; // 0 to 1
  shotLandings: Array<{ x: number; z: number; club: string }>;
  units: UnitSystem;
  viewType: RangeViewType;
}

const DISTANCE_MARKERS = [50, 100, 150, 200, 250, 300]; // yards
const M_TO_YARDS = 1.09361;
const YARDS_TO_METRES = 0.9144;

// ==================== BIRDS-EYE (TOP-DOWN) VIEW ====================
function drawBirdsEye(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  trajectory: TrajectoryPoint[] | null,
  animationProgress: number,
  shotLandings: Array<{ x: number; z: number; club: string }>,
  units: UnitSystem,
) {
  const padB = 50;
  const padT = 20;
  const plotH = height - padT - padB;
  const cx = width / 2;

  const maxRange = 300;
  const yScale = plotH / maxRange;
  const xScale = yScale;

  const toY = (yds: number) => height - padB - yds * yScale;
  const toX = (lateralYds: number) => cx + lateralYds * xScale;

  // === FAIRWAY background ===
  const fairwayGrad = ctx.createLinearGradient(0, 0, 0, height);
  fairwayGrad.addColorStop(0, '#0e3d1c');
  fairwayGrad.addColorStop(0.5, '#14522e');
  fairwayGrad.addColorStop(1, '#1e7a40');
  ctx.fillStyle = fairwayGrad;
  ctx.fillRect(0, 0, width, height);

  for (let d = 0; d < maxRange; d += 15) {
    const y1 = toY(d);
    const y2 = toY(d + 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.fillRect(0, y2, width, y1 - y2);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toX(-35), toY(0));
  ctx.lineTo(toX(-20), toY(maxRange));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX(35), toY(0));
  ctx.lineTo(toX(20), toY(maxRange));
  ctx.stroke();

  for (const dist of DISTANCE_MARKERS) {
    const y = toY(dist);
    if (y < padT || y > height - padB) continue;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const greenR = 8;
    const greenGrad = ctx.createRadialGradient(cx, y, 0, cx, y, greenR);
    greenGrad.addColorStop(0, 'rgba(34, 200, 34, 0.5)');
    greenGrad.addColorStop(0.7, 'rgba(34, 139, 34, 0.25)');
    greenGrad.addColorStop(1, 'rgba(34, 139, 34, 0)');
    ctx.fillStyle = greenGrad;
    ctx.beginPath();
    ctx.arc(cx, y, greenR, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - 10);
    ctx.stroke();
    ctx.fillStyle = dist <= 150 ? 'rgba(255, 80, 80, 0.8)' : 'rgba(255, 200, 50, 0.7)';
    ctx.beginPath();
    ctx.moveTo(cx, y - 10);
    ctx.lineTo(cx + 5, y - 8);
    ctx.lineTo(cx, y - 6);
    ctx.closePath();
    ctx.fill();

    const label = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px "DM Sans", system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(label, width - 35, y + 3);
  }

  const teeY = toY(0);
  const teeW = 40, teeH = 16;
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, teeY - teeH / 2, teeW, teeH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, teeY - teeH / 2, teeW, teeH, 4);
  ctx.stroke();
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(cx - 8, teeY, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 8, teeY, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '9px "DM Sans", system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('TEE', cx, teeY + 22);

  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const sx = toX(lz);
    const sy = toY(lx);
    if (sy < padT || sy > height - padB) continue;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (trajectory && trajectory.length > 2 && animationProgress > 0) {
    const finalP = trajectory[trajectory.length - 1];
    const landX = finalP.x * M_TO_YARDS;
    const landZ = finalP.z * M_TO_YARDS;
    const sx = toX(landZ);
    const sy = toY(landX);
    const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;

    ctx.strokeStyle = `rgba(255, 204, 51, ${0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 204, 51, ${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
    ctx.fill();

    if (animationProgress < 1) {
      const distLabel = units === 'metric'
        ? `${Math.round(landX * YARDS_TO_METRES)}m`
        : `${Math.round(landX)} yds`;
      ctx.font = '10px "DM Sans", system-ui';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(distLabel).width + 10;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(sx - tw / 2, sy - 24, tw, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#ffcc33';
      ctx.fillText(distLabel, sx, sy - 12);
    }
  }

  if (trajectory && animationProgress > 0) {
    const pointCount = Math.floor(trajectory.length * animationProgress);

    if (pointCount > 1) {
      for (let i = 1; i < pointCount; i++) {
        const p = trajectory[i];
        const prev = trajectory[i - 1];
        const px = toX(p.z * M_TO_YARDS);
        const py = toY(p.x * M_TO_YARDS);
        const ppx = toX(prev.z * M_TO_YARDS);
        const ppy = toY(prev.x * M_TO_YARDS);

        const alpha = 0.1 + (i / pointCount) * 0.6;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.moveTo(ppx, ppy);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
      const bx = toX(current.z * M_TO_YARDS);
      const by = toY(current.x * M_TO_YARDS);

      const shadowAlpha = Math.min(0.3, current.y * M_TO_YARDS * 0.01);
      const shadowR = 3 + current.y * M_TO_YARDS * 0.05;
      ctx.beginPath();
      ctx.arc(bx, by, shadowR, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.fill();

      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 16);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      glow.addColorStop(0.3, 'rgba(255, 204, 51, 0.35)');
      glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}

// ==================== GROUND-LEVEL VIEW ====================
// All projection math is inline — no external imports.
// The ball flight uses simple screen-space mapping identical
// to how the bird's-eye view works: forward distance → Y,
// height → upward offset, lateral → X offset.

function drawGroundView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  trajectory: TrajectoryPoint[] | null,
  animationProgress: number,
  shotLandings: Array<{ x: number; z: number; club: string }>,
  units: UnitSystem,
) {
  // --- Layout constants ---
  const horizon = height * 0.35;         // sky/ground split
  const groundY = height - 16;           // bottom of playable area
  const groundH = groundY - horizon;     // pixels of fairway
  const FL = 60;                         // focal length (perspective strength)
  const cx = width / 2;

  // --- Inline perspective helpers (no imports) ---
  // Map forward yards to a screen-Y on the fairway between groundY and horizon
  const fwdToGndY = (fwd: number) => {
    const s = FL / (fwd + FL);            // 1 at tee, →0 at infinity
    return groundY - groundH * (1 - s);   // groundY at tee, horizon at ∞
  };
  // Perspective scale factor at a given forward distance
  const scaleAt = (fwd: number) => FL / (fwd + FL);

  // =================== BACKGROUND ===================

  // Full canvas fill (prevent black gaps)
  ctx.fillStyle = '#38c058';
  ctx.fillRect(0, 0, width, height);

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
  skyGrad.addColorStop(0, '#1a6bc4');
  skyGrad.addColorStop(0.25, '#2b80d4');
  skyGrad.addColorStop(0.5, '#4a9ae0');
  skyGrad.addColorStop(0.75, '#6db8ec');
  skyGrad.addColorStop(0.9, '#8ecdf2');
  skyGrad.addColorStop(1, '#b0dff8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizon);

  // Clouds
  const drawCloud = (cloudX: number, cloudY: number, size: number, alpha: number) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    for (const [ox, oy, r] of [
      [0, 0, size], [-size * 0.8, size * 0.1, size * 0.6],
      [size * 0.7, size * 0.12, size * 0.55], [-size * 0.35, -size * 0.35, size * 0.55],
      [size * 0.4, -size * 0.3, size * 0.5],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(cloudX + ox, cloudY + oy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  };
  drawCloud(width * 0.15, horizon * 0.3, 14, 0.35);
  drawCloud(width * 0.55, horizon * 0.2, 18, 0.3);
  drawCloud(width * 0.82, horizon * 0.4, 12, 0.25);
  drawCloud(width * 0.35, horizon * 0.55, 16, 0.2);

  // Mountains (far)
  ctx.fillStyle = '#5a8aaa';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 4) {
    const mh = Math.sin(x * 0.008) * 22 + Math.sin(x * 0.02) * 12 + Math.cos(x * 0.005) * 15 + 28;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // Mountains (near)
  ctx.fillStyle = '#3d6a4a';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 4) {
    const mh = Math.sin(x * 0.012 + 1) * 14 + Math.sin(x * 0.03) * 8 + Math.cos(x * 0.007 + 2) * 10 + 16;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // Tree line
  ctx.fillStyle = '#1a4a28';
  for (let tx = 0; tx < width; tx += 10) {
    const th = 5 + Math.sin(tx * 0.25) * 3 + Math.cos(tx * 0.15) * 2;
    ctx.beginPath();
    ctx.arc(tx, horizon, th, Math.PI, 0);
    ctx.fill();
  }

  // Fairway
  const fairwayGrad = ctx.createLinearGradient(0, horizon, 0, height);
  fairwayGrad.addColorStop(0, '#1a6630');
  fairwayGrad.addColorStop(0.3, '#228840');
  fairwayGrad.addColorStop(0.7, '#30b050');
  fairwayGrad.addColorStop(1, '#38c058');
  ctx.fillStyle = fairwayGrad;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Mowing stripes
  for (let d = 10; d < 320; d += 14) {
    const y1 = fwdToGndY(d);
    const y2 = fwdToGndY(d + 7);
    if (y1 < horizon) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    ctx.fillRect(0, y2, width, y1 - y2);
  }

  // =================== DISTANCE MARKERS ===================
  for (const dist of DISTANCE_MARKERS) {
    const y = fwdToGndY(dist);
    if (y < horizon + 2) continue;
    const s = scaleAt(dist);

    // Dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(cx - 80 * s, y);
    ctx.lineTo(cx + 80 * s, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Flag
    const fh = Math.max(6, 14 * s);
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + s * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - fh);
    ctx.stroke();
    ctx.fillStyle = dist <= 150 ? '#ee4444' : '#eecc33';
    ctx.beginPath();
    ctx.moveTo(cx, y - fh);
    ctx.lineTo(cx + Math.max(3, 5 * s), y - fh + 2.5);
    ctx.lineTo(cx, y - fh + 5);
    ctx.closePath();
    ctx.fill();

    // Label
    const dl = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + s * 0.4})`;
    ctx.font = `bold ${Math.max(8, Math.round(11 * s))}px "DM Sans", system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText(dl, cx + Math.max(6, 12 * s), y - 2);
  }

  // =================== TEE ===================
  const teeW = 50, teeH = 10;
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, groundY - teeH, teeW, teeH, 3);
  ctx.fill();
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(cx - 10, groundY - teeH / 2, 2.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 10, groundY - teeH / 2, 2.5, 0, 2 * Math.PI);
  ctx.fill();

  // Ball on tee when idle
  if (!trajectory || animationProgress === 0) {
    ctx.beginPath();
    ctx.arc(cx, groundY - teeH - 4, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // =================== PREVIOUS LANDINGS ===================
  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const ly = fwdToGndY(lx);
    if (ly < horizon) continue;
    const s = scaleAt(lx);
    const lsx = cx + lz * s * (width / 60);
    ctx.beginPath();
    ctx.arc(lsx, ly, Math.max(2, 4 * s), 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }

  // =================== BALL FLIGHT ===================
  if (!trajectory || trajectory.length < 3 || animationProgress <= 0) return;

  // Compute height scale: how many screen-px per yard of height.
  // We want the apex to reach ~10% from the top of the canvas.
  let maxH = 0;
  let apexFwd = 0;
  for (let i = 0; i < trajectory.length; i++) {
    const hy = trajectory[i].y * M_TO_YARDS;
    if (hy > maxH) { maxH = hy; apexFwd = trajectory[i].x * M_TO_YARDS; }
  }
  const apexGndY = fwdToGndY(apexFwd);
  const targetY = height * 0.10;
  const hScale = maxH > 0 ? Math.max((apexGndY - targetY) / maxH, 2) : 2;

  // Helper: trajectory point → screen {x, y}
  const toScreen = (p: TrajectoryPoint) => {
    const fwd = p.x * M_TO_YARDS;
    const h = p.y * M_TO_YARDS;
    const lat = p.z * M_TO_YARDS;
    const s = scaleAt(fwd);
    const sx = cx + lat * s * (width / 60);
    const sy = fwdToGndY(fwd) - h * hScale;
    return { x: sx, y: sy, s };
  };

  const pointCount = Math.floor(trajectory.length * animationProgress);
  if (pointCount < 1) return;

  // --- Landing zone (pulsing target) ---
  const finalPt = trajectory[trajectory.length - 1];
  const landFwd = finalPt.x * M_TO_YARDS;
  const landGndY = fwdToGndY(landFwd);
  const landS = scaleAt(landFwd);
  const landSx = cx + finalPt.z * M_TO_YARDS * landS * (width / 60);
  const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
  const landR = Math.max(4, 10 * landS);

  ctx.strokeStyle = `rgba(255, 220, 50, ${0.5 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(landSx, landGndY, landR, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 220, 50, ${0.12 * pulse})`;
  ctx.beginPath();
  ctx.arc(landSx, landGndY, landR, 0, 2 * Math.PI);
  ctx.fill();

  if (animationProgress < 1) {
    const dl = units === 'metric'
      ? `${Math.round(landFwd * YARDS_TO_METRES)}m`
      : `${Math.round(landFwd)} yds`;
    ctx.font = `bold ${Math.max(9, Math.round(11 * landS))}px "DM Sans", system-ui`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(dl).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(landSx - tw / 2, landGndY - landR - 20, tw, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(dl, landSx, landGndY - landR - 8);
  }

  // --- Trail (Toptracer-style gradient) ---
  // Outer glow
  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 50, 0.6)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i < pointCount; i++) {
    const sp = toScreen(trajectory[i]);
    if (i === 0) ctx.moveTo(sp.x, sp.y);
    else ctx.lineTo(sp.x, sp.y);
  }
  ctx.strokeStyle = 'rgba(255, 220, 80, 0.5)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Inner color gradient trail
  for (let i = 1; i < pointCount; i++) {
    const prev = toScreen(trajectory[i - 1]);
    const cur = toScreen(trajectory[i]);
    const t = i / trajectory.length;
    const r = 255;
    const g = Math.round(80 + t * 175);
    const b = Math.round(t > 0.7 ? (t - 0.7) / 0.3 * 200 : 40);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // --- Landing vertical line ---
  if (animationProgress >= 1) {
    const lastSp = toScreen(trajectory[trajectory.length - 1]);
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(lastSp.x, lastSp.y);
    ctx.lineTo(landSx, landGndY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- Current ball ---
  const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
  const bp = toScreen(current);
  const ballSize = Math.max(5, 8 * bp.s);

  // Drop line to ground
  const curGndY = fwdToGndY(current.x * M_TO_YARDS);
  if (current.y * M_TO_YARDS > 1) {
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(bp.x, bp.y);
    ctx.lineTo(bp.x, curGndY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ground shadow
    ctx.beginPath();
    ctx.arc(bp.x, curGndY, Math.max(2, 4 * bp.s), 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();
  }

  // Glow
  const glow = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, ballSize * 3);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.25, 'rgba(255, 220, 80, 0.6)');
  glow.addColorStop(0.6, 'rgba(255, 200, 50, 0.15)');
  glow.addColorStop(1, 'rgba(255, 200, 50, 0)');
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize * 3, 0, 2 * Math.PI);
  ctx.fillStyle = glow;
  ctx.fill();

  // Ball
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Distance label
  if (animationProgress < 1) {
    const dist = current.x * M_TO_YARDS;
    const label = units === 'metric'
      ? `${Math.round(dist * YARDS_TO_METRES)}m`
      : `${Math.round(dist)} yds`;
    ctx.font = 'bold 10px "DM Sans", system-ui';
    ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(bp.x + ballSize + 6, bp.y - 8, tw, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(label, bp.x + ballSize + 10, bp.y + 4);
  }
}

// ==================== MAIN COMPONENT ====================
export default function RangeCanvas({ width, height, trajectory, animationProgress, shotLandings, units, viewType }: RangeCanvasProps) {
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

    if (viewType === 'birdseye') {
      drawBirdsEye(ctx, width, height, trajectory, animationProgress, shotLandings, units);
    } else {
      drawGroundView(ctx, width, height, trajectory, animationProgress, shotLandings, units);
    }
  }, [width, height, trajectory, animationProgress, shotLandings, units, viewType]);

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
